'use client'

import { useAuth } from '@/components/providers/auth-provider'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LogOut, User, RefreshCw, Shield } from 'lucide-react'
import { useAutoSync } from '@/lib/offline/sync'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

export default function MobileProfilePage() {
    const { user, roles } = useAuth()
    const { isOnline, isSyncing, stats, syncNow, resetQueueRetries } = useAutoSync()
    const router = useRouter()
    const supabase = createClient()

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        toast.success('Logged out successfully')
    }

    return (
        <div className="p-4 space-y-6">
            <h1 className="text-2xl font-bold">My Profile</h1>

            {/* User Info Card */}
            <Card className="p-6">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                        <User className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">{user?.full_name || 'User'}</h2>
                        <p className="text-sm text-gray-500">{user?.email}</p>
                        <div className="flex gap-2 mt-2">
                            {roles?.map(role => (
                                <Badge key={role.id} variant="secondary" className="text-xs">
                                    {role.role_name}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Sync Status Card */}
            <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    Sync Status
                </h3>

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-600">Connection</span>
                        <Badge variant={isOnline ? 'default' : 'destructive'} className={isOnline ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-red-100 text-red-700 hover:bg-red-100'}>
                            {isOnline ? 'Online' : 'Offline'}
                        </Badge>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Pending Items</span>
                        <span className="font-medium text-blue-600">{stats.pending}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Retrying</span>
                        <span className="font-medium text-amber-600">{stats.retrying}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Failed</span>
                        <span className="font-medium text-rose-600">{stats.failed}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant="outline"
                            onClick={async () => {
                                await resetQueueRetries()
                                toast.success('Retries reset. Syncing now...')
                                syncNow()
                            }}
                            disabled={!isOnline || isSyncing || stats.failed === 0}
                            className="text-xs"
                        >
                            Retry Failed
                        </Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 text-xs"
                            onClick={syncNow}
                            disabled={!isOnline || isSyncing || stats.total === 0}
                        >
                            {isSyncing ? 'Syncing...' : 'Sync Now'}
                        </Button>
                    </div>
                </div>
            </Card>

            {/* App Info */}
            <Card className="p-6">
                <div className="space-y-4">
                    <div className="flex justify-between">
                        <span className="text-gray-600">App Version</span>
                        <span className="font-medium">1.0.0 (PWA)</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-600">Build</span>
                        <span className="font-medium">Production</span>
                    </div>
                </div>
            </Card>

            <Button variant="destructive" className="w-full" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
            </Button>

            <p className="text-center text-xs text-muted-foreground pt-4">
                Bismillah ERP Mobile • {new Date().getFullYear()}
            </p>
        </div>
    )
}
