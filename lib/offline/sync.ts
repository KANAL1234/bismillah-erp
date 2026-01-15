// lib/offline/sync.ts
'use client'

import { useEffect, useState } from 'react'
import { processQueue, getQueueStats, resetQueueRetries } from './queue'
import { toast } from 'sonner'

// Check if online
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof window !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
      toast.success('Back online! Syncing data...')
      // Trigger sync when back online
      syncNow()
    }

    function handleOffline() {
      setIsOnline(false)
      toast.warning('You are offline. Data will be saved locally.')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

// Sync now
export async function syncNow(): Promise<boolean> {
  if (!navigator.onLine) {
    console.log('⚠️ Cannot sync: offline')
    return false
  }

  try {
    const result = await processQueue()

    if (result.processed > 0) {
      toast.success(`✅ Synced ${result.processed} items`)
    }

    if (result.failed > 0) {
      toast.error(`❌ Failed to sync ${result.failed} items`)
    }

    return result.remaining === 0
  } catch (error) {
    console.error('Sync error:', error)
    toast.error('Sync failed. Will retry later.')
    return false
  }
}

// Auto-sync hook
export function useAutoSync(intervalMs: number = 30000) {
  const isOnline = useOnlineStatus()
  const [isSyncing, setIsSyncing] = useState(false)
  const [stats, setStats] = useState({ total: 0, pending: 0, retrying: 0, failed: 0 })

  // Update stats
  useEffect(() => {
    async function updateStats() {
      const queueStats = await getQueueStats()
      setStats(queueStats)
    }

    updateStats()
    const interval = setInterval(updateStats, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [])

  // Auto-sync when online
  useEffect(() => {
    if (!isOnline) return

    async function sync() {
      if (isSyncing) return

      const queueStats = await getQueueStats()
      if (queueStats.total === 0) return

      setIsSyncing(true)
      await syncNow()
      setIsSyncing(false)
    }

    // Sync immediately when coming online
    sync()

    // Then sync at intervals
    const interval = setInterval(sync, intervalMs)

    return () => clearInterval(interval)
  }, [isOnline, intervalMs, isSyncing])

  return { isOnline, isSyncing, stats, syncNow, resetQueueRetries }
}

// Background sync (using Service Worker)
export function registerBackgroundSync() {
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    navigator.serviceWorker.ready.then((registration) => {
      if ('sync' in registration) {
        // @ts-ignore - SyncManager is not in default TS types
        return (registration as any).sync.register('sync-queue')
      }
      // If 'sync' is not in registration (shouldn't happen given the outer check),
      // return a resolved promise to avoid breaking the chain.
      return Promise.resolve()
    }).then(() => {
      console.log('✅ Background sync registered')
    }).catch((error) => {
      console.error('❌ Background sync registration failed:', error)
    })
  }
}

// Request persistent storage
export async function requestPersistentStorage(): Promise<boolean> {
  if ('storage' in navigator && 'persist' in navigator.storage) {
    const isPersisted = await navigator.storage.persist()

    if (isPersisted) {
      console.log('✅ Persistent storage granted')
      toast.success('Offline data will be preserved')
    } else {
      console.log('⚠️ Persistent storage not granted')
    }

    return isPersisted
  }
  return false
}
