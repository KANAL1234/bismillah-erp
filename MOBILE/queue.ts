// lib/offline/queue.ts
import { syncQueueStore } from './storage'
import { createClient } from '@/lib/supabase/client'

export type SyncAction = 
  | 'CREATE_POS_SALE'
  | 'CREATE_FUEL_LOG'
  | 'UPDATE_ODOMETER'

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
        const { error } = await supabase
          .from('pos_sales')
          .insert(item.data)
        
        if (error) throw error
        console.log(`✅ Synced POS sale: ${item.id}`)
        return true
      }

      case 'CREATE_FUEL_LOG': {
        const { data, error } = await supabase
          .rpc('record_fuel_entry', item.data)
        
        if (error) throw error
        console.log(`✅ Synced fuel log: ${item.id}`)
        return true
      }

      case 'UPDATE_ODOMETER': {
        const { error } = await supabase
          .from('vehicles')
          .update({ current_odometer: item.data.odometer })
          .eq('id', item.data.vehicle_id)
        
        if (error) throw error
        console.log(`✅ Synced odometer: ${item.id}`)
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
    // Skip items that exceeded max retries
    if (item.retryCount >= MAX_RETRIES) {
      console.error(`❌ Max retries exceeded for ${item.id}, skipping`)
      failed++
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
