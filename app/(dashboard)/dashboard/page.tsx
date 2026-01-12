import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, Users, MapPin } from 'lucide-react'

export default async function DashboardPage() {
    const supabase = await createClient()

    // Get counts
    const { count: productCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })

    const { count: customerCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })

    const { count: locationCount } = await supabase
        .from('locations')
        .select('*', { count: 'exact', head: true })

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-slate-900">Dashboard Overview</h2>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                        <Package className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{productCount || 0}</div>
                        <p className="text-xs text-slate-500">Items in catalog</p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Customers</CardTitle>
                        <Users className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{customerCount || 0}</div>
                        <p className="text-xs text-slate-500">Registered customers</p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Locations</CardTitle>
                        <MapPin className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{locationCount || 0}</div>
                        <p className="text-xs text-slate-500">Warehouses & vehicles</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Welcome to Bismillah Oil Agency ERP</CardTitle>
                    <CardDescription>Your complete business management system</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-slate-600">
                        Navigate using the menu above to manage products, inventory, sales, and more.
                        This dashboard provides a high-level view of your business operations.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
