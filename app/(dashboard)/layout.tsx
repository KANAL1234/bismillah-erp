import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sidebar } from '@/components/dashboard/sidebar'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    async function signOut() {
        'use server'
        const supabase = await createClient()
        await supabase.auth.signOut()
        redirect('/login')
    }

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Left Sidebar */}
            <Sidebar />

            {/* Main Content Area */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Top Header */}
                <header className="flex h-16 items-center justify-between border-b bg-white px-6">
                    <h2 className="text-lg font-semibold text-slate-900">Bismillah Oil Agency</h2>
                    <div className="flex items-center space-x-4">
                        <span className="text-sm text-slate-600">{user.email}</span>
                        <form action={signOut}>
                            <Button variant="outline" size="sm">
                                Sign Out
                            </Button>
                        </form>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    )
}
