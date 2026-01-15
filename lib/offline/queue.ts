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
          // Check if items already exist for this sale to avoid duplicates on retry
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

        console.log(`✅ Synced POS sale and items: ${item.id}`)
        return true
      }

      case 'CREATE_FUEL_LOG': {
        const { error } = await supabase
          .rpc('record_fuel_entry', item.data)

        if (error) throw error
        console.log(`✅ Synced fuel log: ${item.id}`)
        return true
      }

      case 'UPDATE_ODOMETER': {
        const { error } = await supabase
          .from('fleet_vehicles')
          .update({ current_mileage: item.data.odometer })
          .eq('id', item.data.vehicle_id)

        if (error) throw error
        console.log(`✅ Synced odometer: ${item.id}`)
        return true
      }

      case 'CREATE_TRIP': {
        const { error } = await supabase
          .from('fleet_trips')
          .insert(item.data)

        if (error) throw error
        console.log(`✅ Synced trip start: ${item.id}`)
        return true
      }

      case 'UPDATE_TRIP': {
        const { error } = await supabase
          .from('fleet_trips')
          .update(item.data)
          .eq('id', item.data.id)

        if (error) throw error
        console.log(`✅ Synced trip update: ${item.id}`)
        return true
      }

      case 'SAVE_LOCATION': {
        const { error } = await supabase
          .from('fleet_trip_locations')
          .insert(item.data)

        if (error) throw error
        console.log(`✅ Synced location: ${item.id}`)
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
