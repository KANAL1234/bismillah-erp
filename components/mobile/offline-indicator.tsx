// components/mobile/offline-indicator.tsx
'use client'

import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { useAutoSync } from '@/lib/offline/sync'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function OfflineIndicator() {
  const { isOnline, isSyncing, stats, syncNow } = useAutoSync()

  return (
    <div className="sticky top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="pointer-events-auto">
        {/* Offline Banner */}
        {!isOnline && (
          <div className="bg-amber-500 text-white px-4 py-2 text-center text-sm font-medium animate-in slide-in-from-top">
            <div className="flex items-center justify-center gap-2">
              <WifiOff className="w-4 h-4" />
              <span>You are offline. Changes will be saved locally.</span>
            </div>
          </div>
        )}

        {/* Syncing Banner */}
        {isOnline && isSyncing && (
          <div className="bg-blue-500 text-white px-4 py-2 text-center text-sm font-medium animate-in slide-in-from-top">
            <div className="flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Syncing data...</span>
            </div>
          </div>
        )}

        {/* Pending Items Banner */}
        {isOnline && !isSyncing && stats.total > 0 && (
          <div className="bg-orange-500 text-white px-4 py-2 text-sm font-medium animate-in slide-in-from-top">
            <div className="flex items-center justify-between max-w-md mx-auto">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                <span>{stats.total} items pending sync</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => syncNow()}
                className="text-white hover:bg-white/20 h-7"
              >
                Sync Now
              </Button>
            </div>
          </div>
        )}

        {/* Back Online Success */}
        {isOnline && !isSyncing && stats.total === 0 && (
          <div className="bg-green-600 text-white px-4 py-1 text-center text-xs font-medium animate-in slide-in-from-top shadow-sm">
            <div className="flex items-center justify-center gap-2">
              <Wifi className="w-3 h-3" />
              <span>Online & Synced</span>
            </div>
          </div>
        )}
      </div>
    </div>

  )
}

// Compact sync status for mobile header
export function SyncStatus() {
  const { isOnline, isSyncing, stats } = useAutoSync()

  return (
    <div className="flex items-center gap-2">
      {!isOnline && (
        <div className="flex items-center gap-1 text-amber-600">
          <WifiOff className="w-4 h-4" />
          <span className="text-xs font-medium">Offline</span>
        </div>
      )}

      {isOnline && isSyncing && (
        <div className="flex items-center gap-1 text-blue-600">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-xs font-medium">Syncing...</span>
        </div>
      )}

      {isOnline && !isSyncing && stats.total > 0 && (
        <div className="flex items-center gap-1 text-orange-600">
          <RefreshCw className="w-4 h-4" />
          <span className="text-xs font-medium">{stats.total} pending</span>
        </div>
      )}

      {isOnline && !isSyncing && stats.total === 0 && (
        <div className="flex items-center gap-1 text-green-600">
          <Wifi className="w-4 h-4" />
        </div>
      )}
    </div>
  )
}
