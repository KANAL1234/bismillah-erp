// lib/offline/queue.ts
import { syncQueueStore } from './storage'
import { createClient } from '@/lib/supabase/client'

export type SyncAction =
  | 'CREATE_POS_SALE'
  | 'CREATE_FUEL_LOG'
  | 'UPDATE_ODOMETER'
  | 'CREATE_TRIP'
  | 'UPDATE_TRIP'
  | 'SAVE_LOCATION'

export interface QueueItem {
  id: string
  action: SyncAction
  data: any
  timestamp: number
  retryCount: number
  lastError?: string
}

const QUEUE_KEY = 'sync_queue'
const MAX_RETRIES = 3

// Add item to sync queue
export async function addToQueue(action: SyncAction, data: any): Promise<string> {
  const item: QueueItem = {
    id: `${action}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    action,
    data,
    timestamp: Date.now(),
    retryCount: 0
  }

  const queue = await getQueue()
  queue.push(item)
  await syncQueueStore.setItem(QUEUE_KEY, queue)

  console.log(`✅ Added to queue: ${action}`, item.id)
  return item.id
}

// Get current queue
export async function getQueue(): Promise<QueueItem[]> {
  const queue = await syncQueueStore.getItem<QueueItem[]>(QUEUE_KEY)
  return queue || []
}

// Remove item from queue
export async function removeFromQueue(itemId: string): Promise<void> {
  const queue = await getQueue()
  const filtered = queue.filter(item => item.id !== itemId)
  await syncQueueStore.setItem(QUEUE_KEY, filtered)
  console.log(`🗑️ Removed from queue: ${itemId}`)
}

// Update item retry count
async function updateRetryCount(itemId: string, error: string): Promise<void> {
  const queue = await getQueue()
  const updated = queue.map(item => {
    if (item.id === itemId) {
      return {
        ...item,
        retryCount: item.retryCount + 1,
        lastError: error
      }
    }
    return item
  })
  await syncQueueStore.setItem(QUEUE_KEY, updated)
}

// Process a single queue item
async function processQueueItem(item: QueueItem): Promise<boolean> {
  const supabase = createClient()

  // Helper to resolve driver_id from auth ID to fleet_drivers ID
  const resolveDriverId = async (authId: string) => {
    // 1. Check if authId is already a fleet_driver ID
    const { data: d1 } = await supabase.from('fleet_drivers').select('id').eq('id', authId).maybeSingle()
    if (d1) return d1.id

    // 2. Check if authId is the employee_id
    const { data: d2 } = await supabase.from('fleet_drivers').select('id').eq('employee_id', authId).maybeSingle()
    if (d2) return d2.id

    return authId // Fallback to original
  }

  try {
    switch (item.action) {
      case 'CREATE_POS_SALE': {
        const { items, ...saleData } = item.data

        // 1. Check if sale already exists (Idempotency check)
        const { data: existingSale } = await supabase
          .from('pos_sales')
          .select('id')
          .eq('sale_number', saleData.sale_number)
          .maybeSingle()

        let saleId = existingSale?.id

        if (!saleId) {
          // Insert the main sale record
          const { data: sale, error: saleError } = await supabase
            .from('pos_sales')
            .insert(saleData)
            .select()
            .single()

          if (saleError) throw saleError
          saleId = sale.id
        }

        // 2. Insert/Check sale items
        if (items && items.length > 0) {
          const { data: existingItems } = await supabase
            .from('pos_sale_items')
            .select('id')
            .eq('sale_id', saleId)

          if (!existingItems || existingItems.length === 0) {
            const saleItems = items.map((line: any) => ({
              sale_id: saleId,
              product_id: line.product_id,
              quantity: line.quantity,
              unit_price: line.unit_price,
              discount_percentage: 0
            }))

            const { error: itemsError } = await supabase
              .from('pos_sale_items')
              .insert(saleItems)

            if (itemsError) throw itemsError
          }
        }
        return true
      }

      case 'CREATE_FUEL_LOG': {
        // Try RPC first
        const { error: rpcError } = await supabase.rpc('record_fuel_entry', item.data)

        if (!rpcError) return true

        // If RPC fails (e.g. function missing), try manual insert as fallback
        if (rpcError.code === 'P0001' || rpcError.message.includes('function') || rpcError.message.includes('not found')) {
          console.log('Falling back to manual fuel log insert...')

          const driverId = await resolveDriverId(item.data.p_driver_id)

          // Try inserting into fleet_fuel_logs first
          const { error: fleetError } = await supabase
            .from('fleet_fuel_logs')
            .insert({
              vehicle_id: item.data.p_vehicle_id,
              liters: item.data.p_quantity_liters,
              cost_per_liter: item.data.p_price_per_liter,
              total_cost: item.data.p_quantity_liters * item.data.p_price_per_liter,
              odometer_reading: item.data.p_odometer_reading,
              log_date: item.data.p_fuel_date || new Date().toISOString()
            })

          if (!fleetError) {
            // Also update vehicle odometer
            await supabase
              .from('fleet_vehicles')
              .update({ current_mileage: item.data.p_odometer_reading })
              .eq('id', item.data.p_vehicle_id)
            return true
          }

          // Last resort: try public.fuel_logs
          const { error: fuelError } = await supabase
            .from('fuel_logs')
            .insert({
              vehicle_id: item.data.p_vehicle_id,
              log_date: item.data.p_fuel_date || new Date().toISOString(),
              odometer_reading: item.data.p_odometer_reading,
              fuel_quantity: item.data.p_quantity_liters,
              fuel_rate: item.data.p_price_per_liter,
              filled_by: item.data.p_driver_id, // Usually matches employee_id/auth_id
              station_name: item.data.p_fuel_station
            })

          if (fuelError) throw fuelError
          return true
        }

        throw rpcError
      }

      case 'UPDATE_ODOMETER': {
        const { error } = await supabase
          .from('fleet_vehicles')
          .update({ current_mileage: item.data.odometer })
          .eq('id', item.data.vehicle_id)

        if (error) throw error
        return true
      }

      case 'CREATE_TRIP': {
        // Idempotency check
        const { data: existing } = await supabase
          .from('fleet_trips')
          .select('id')
          .eq('id', item.data.id)
          .maybeSingle()

        if (existing) return true

        const driverId = await resolveDriverId(item.data.driver_id)
        const { error } = await supabase
          .from('fleet_trips')
          .insert({
            ...item.data,
            driver_id: driverId
          })

        if (error) throw error
        return true
      }

      case 'UPDATE_TRIP': {
        const { error } = await supabase
          .from('fleet_trips')
          .update(item.data)
          .eq('id', item.data.id)

        if (error) throw error
        return true
      }

      case 'SAVE_LOCATION': {
        const { error } = await supabase
          .from('fleet_trip_locations')
          .insert(item.data)

        if (error) throw error
        return true
      }

      default:
        console.error(`Unknown action: ${item.action}`)
        return false
    }
  } catch (error: any) {
    console.error(`❌ Error syncing ${item.action}:`, error.message)

    // Update retry count
    await updateRetryCount(item.id, error.message)

    return false
  }
}

// Process entire queue
export async function processQueue(): Promise<{
  processed: number
  failed: number
  remaining: number
}> {
  console.log('🔄 Starting queue sync...')

  const queue = await getQueue()
  let processed = 0
  let failed = 0

  for (const item of queue) {
    // Skip items that exceeded max retries (they are already in a permanent failed state)
    if (item.retryCount >= MAX_RETRIES) {
      continue
    }

    const success = await processQueueItem(item)

    if (success) {
      await removeFromQueue(item.id)
      processed++
    } else {
      failed++
    }
  }

  const remaining = (await getQueue()).length

  console.log(`📊 Sync complete: ${processed} processed, ${failed} failed, ${remaining} remaining`)

  return { processed, failed, remaining }
}

// Clear failed items
export async function clearFailedItems(): Promise<void> {
  const queue = await getQueue()
  const filtered = queue.filter(item => item.retryCount < MAX_RETRIES)
  await syncQueueStore.setItem(QUEUE_KEY, filtered)
}

// Reset all retries (for manual retry)
export async function resetQueueRetries(): Promise<void> {
  const queue = await getQueue()
  const updated = queue.map(item => ({ ...item, retryCount: 0 }))
  await syncQueueStore.setItem(QUEUE_KEY, updated)
  console.log('🔄 All queue retry counts reset to 0')
}

// Get queue statistics
export async function getQueueStats() {
  const queue = await getQueue()
  return {
    total: queue.length,
    pending: queue.filter(item => item.retryCount === 0).length,
    retrying: queue.filter(item => item.retryCount > 0 && item.retryCount < MAX_RETRIES).length,
    failed: queue.filter(item => item.retryCount >= MAX_RETRIES).length
  }
}
