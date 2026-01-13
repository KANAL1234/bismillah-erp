import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Package,
    Users,
    MapPin,
    TrendingUp,
    ShoppingCart,
    Truck,
    DollarSign,
    AlertCircle,
    CheckCircle,
    Clock,
    Calculator
} from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
    const supabase = await createClient()

    // Get current date for filtering
    const today = new Date().toISOString().split('T')[0]
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

    // === INVENTORY METRICS ===
    const { count: productCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })

    const { count: lowStockCount } = await supabase
        .from('inventory_stock')
        .select('product_id', { count: 'exact', head: true })
        .lt('quantity_on_hand', 10)

    const { data: totalInventoryValue } = await supabase
        .from('inventory_stock')
        .select('quantity_on_hand, products(cost_price)')

    const inventoryValue = totalInventoryValue?.reduce((sum, item: any) => {
        return sum + (item.quantity_on_hand * (item.products?.cost_price || 0))
    }, 0) || 0

    // === SALES METRICS ===
    const { count: customerCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })

    // Today's POS Sales
    const { data: todaySales } = await supabase
        .from('pos_sales')
        .select('total_amount')
        .gte('sale_date', today)

    const todaySalesTotal = todaySales?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0

    // This Month's POS Sales
    const { data: monthSales } = await supabase
        .from('pos_sales')
        .select('total_amount')
        .gte('sale_date', firstDayOfMonth)

    const monthSalesTotal = monthSales?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0

    // Pending Sales Orders
    const { count: pendingOrdersCount } = await supabase
        .from('sales_orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['confirmed', 'processing'])

    // === PURCHASE METRICS ===
    const { count: vendorCount } = await supabase
        .from('vendors')
        .select('*', { count: 'exact', head: true })

    const { count: pendingPOCount } = await supabase
        .from('purchase_orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['DRAFT', 'PENDING_APPROVAL'])

    const { count: approvedPOCount } = await supabase
        .from('purchase_orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'APPROVED')

    // === ACCOUNTING METRICS ===
    const { data: accountsData } = await supabase
        .from('chart_of_accounts')
        .select('account_type, current_balance')

    const cashBalance = accountsData?.find(a => a.account_type === 'ASSET')?.current_balance || 0

    const { data: bankAccounts } = await supabase
        .from('bank_accounts')
        .select('current_balance')

    const totalBankBalance = bankAccounts?.reduce((sum, acc) => sum + acc.current_balance, 0) || 0

    const { count: unpaidInvoicesCount } = await supabase
        .from('customer_invoices_accounting')
        .select('*', { count: 'exact', head: true })
        .in('status', ['draft', 'posted'])

    // === NEW ANALYTICS (Guide v2) ===
    // 1. Credit Risk Monitor (Customers near limit)
    const { data: creditRiskData } = await supabase.rpc('get_customers_near_credit_limit', {
        p_threshold_pct: 0.7 // Show customers using > 70% of credit
    })

    // 2. Transaction Register Summary (Monthly)
    const { data: salesSummary } = await supabase.rpc('get_sales_register_summary', {
        p_start_date: firstDayOfMonth,
        p_end_date: today
    })

    // 3. Top Products
    const { data: topProducts } = await supabase.rpc('get_sales_by_product', {
        p_start_date: firstDayOfMonth,
        p_end_date: today
    })
    const displayProducts = (topProducts || [])
        .sort((a: any, b: any) => b.total_sales - a.total_sales)
        .slice(0, 5)

    // === LOCATIONS ===
    const { count: locationCount } = await supabase
        .from('locations')
        .select('*', { count: 'exact', head: true })

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-3xl font-bold text-slate-900">Dashboard Overview</h2>
                <p className="text-slate-600 mt-1">Welcome to Bismillah Oil Agency ERP - Your complete business management system</p>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Today's Sales */}
                <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-green-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">PKR {todaySalesTotal.toLocaleString()}</div>
                        <p className="text-xs text-slate-500 mt-1">POS transactions</p>
                    </CardContent>
                </Card>

                {/* Month's Sales */}
                <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-blue-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">This Month</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">PKR {monthSalesTotal.toLocaleString()}</div>
                        <p className="text-xs text-slate-500 mt-1">{monthSales?.length || 0} sales</p>
                    </CardContent>
                </Card>

                {/* Inventory Value */}
                <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-purple-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
                        <Package className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-600">PKR {inventoryValue.toLocaleString()}</div>
                        <p className="text-xs text-slate-500 mt-1">{productCount || 0} products</p>
                    </CardContent>
                </Card>

                {/* Bank Balance */}
                <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-orange-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Bank Balance</CardTitle>
                        <Calculator className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">PKR {totalBankBalance.toLocaleString()}</div>
                        <p className="text-xs text-slate-500 mt-1">{bankAccounts?.length || 0} accounts</p>
                    </CardContent>
                </Card>
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Customers</CardTitle>
                        <Users className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{customerCount || 0}</div>
                        <p className="text-xs text-slate-500">Registered</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Vendors</CardTitle>
                        <Truck className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{vendorCount || 0}</div>
                        <p className="text-xs text-slate-500">Suppliers</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Locations</CardTitle>
                        <MapPin className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{locationCount || 0}</div>
                        <p className="text-xs text-slate-500">Warehouses</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{lowStockCount || 0}</div>
                        <p className="text-xs text-slate-500">Need reorder</p>
                    </CardContent>
                </Card>
            </div>

            {/* New Analytics Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Credit Risk Monitor */}
                <Card className="border-l-4 border-l-red-500">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-red-600" />
                            Credit Risk Monitor
                        </CardTitle>
                        <CardDescription>Customers exceeding 70% credit utilization</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {creditRiskData && creditRiskData.length > 0 ? (
                            creditRiskData.map((risk: any) => (
                                <div key={risk.customer_id} className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100">
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="font-semibold text-slate-900">{risk.customer_name}</p>
                                            <Badge variant="destructive" className="bg-red-600">
                                                {Math.round(risk.utilization_pct)}% Limit
                                            </Badge>
                                        </div>
                                        <div className="w-full bg-red-200 rounded-full h-1.5 mb-1">
                                            <div
                                                className="bg-red-600 h-1.5 rounded-full"
                                                style={{ width: `${Math.min(risk.utilization_pct, 100)}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[11px] text-red-700">
                                            <span>Used: PKR {risk.current_balance.toLocaleString()}</span>
                                            <span>Limit: PKR {risk.credit_limit.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-6 text-slate-500 italic border rounded-lg border-dashed">
                                No customers currently in high-risk credit zone
                            </div>
                        )}
                        <Link href="/dashboard/customers" className="block text-center text-xs text-blue-600 hover:underline mt-2">
                            Manage All Customers
                        </Link>
                    </CardContent>
                </Card>

                {/* Top Products Analytics */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-blue-600" />
                            Top Performing Products
                        </CardTitle>
                        <CardDescription>Highest revenue generators this month</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {displayProducts.length > 0 ? (
                                displayProducts.map((p: any, i: number) => (
                                    <div key={p.product_id} className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold text-xs shrink-0">
                                            #{i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="font-medium text-slate-900 truncate">{p.product_name}</p>
                                                <span className="text-sm font-bold text-slate-900">PKR {p.total_sales.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs text-slate-500">
                                                <span>{p.total_quantity} units sold</span>
                                                <span className="text-blue-600 font-medium">{p.transaction_count} sales</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-6 text-slate-500 italic border rounded-lg border-dashed">
                                    No sales data available for this month
                                </div>
                            )}
                        </div>
                        <Link href="/dashboard/accounting/reports/registers" className="block text-center text-xs text-blue-600 hover:underline mt-6">
                            View Full Transaction Register
                        </Link>
                    </CardContent>
                </Card>
            </div>

            {/* Operational Alerts & Quick Actions */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Pending Actions */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-orange-600" />
                            Operational Alerts
                        </CardTitle>
                        <CardDescription>Workflow tasks requiring attention</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Link href="/dashboard/purchases/orders" className="block p-3 rounded-lg hover:bg-slate-50 transition-colors border">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-slate-900">Purchase Orders</p>
                                    <p className="text-sm text-slate-500">Pending approval</p>
                                </div>
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                    {pendingPOCount || 0}
                                </Badge>
                            </div>
                        </Link>

                        <Link href="/dashboard/purchases/orders" className="block p-3 rounded-lg hover:bg-slate-50 transition-colors border">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-slate-900">Approved POs</p>
                                    <p className="text-sm text-slate-500">Ready to send to vendor</p>
                                </div>
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                    {approvedPOCount || 0}
                                </Badge>
                            </div>
                        </Link>

                        <Link href="/dashboard/sales/orders" className="block p-3 rounded-lg hover:bg-slate-50 transition-colors border">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-slate-900">Sales Orders</p>
                                    <p className="text-sm text-slate-500">In progress</p>
                                </div>
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    {pendingOrdersCount || 0}
                                </Badge>
                            </div>
                        </Link>

                        <Link href="/dashboard/sales/invoices" className="block p-3 rounded-lg hover:bg-slate-50 transition-colors border">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-slate-900">Unpaid Invoices</p>
                                    <p className="text-sm text-slate-500">Awaiting payment</p>
                                </div>
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                    {unpaidInvoicesCount || 0}
                                </Badge>
                            </div>
                        </Link>
                    </CardContent>
                </Card>

                {/* Quick Links */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            Quick Actions
                        </CardTitle>
                        <CardDescription>Frequently used features</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Link href="/dashboard/pos" className="block p-3 rounded-lg hover:bg-green-50 transition-colors border border-green-200">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <ShoppingCart className="h-5 w-5 text-green-700" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-900">POS Terminal</p>
                                    <p className="text-sm text-slate-500">Make a sale</p>
                                </div>
                            </div>
                        </Link>

                        <Link href="/dashboard/inventory" className="block p-3 rounded-lg hover:bg-purple-50 transition-colors border border-purple-200">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-100 rounded-lg">
                                    <Package className="h-5 w-5 text-purple-700" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-900">Stock Overview</p>
                                    <p className="text-sm text-slate-500">Check inventory</p>
                                </div>
                            </div>
                        </Link>

                        <Link href="/dashboard/accounting/reports/registers" className="block p-3 rounded-lg hover:bg-blue-50 transition-colors border border-blue-200">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <Calculator className="h-5 w-5 text-blue-700" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-900">Transaction Registers</p>
                                    <p className="text-sm text-slate-500">Sales & Purchase registers</p>
                                </div>
                            </div>
                        </Link>

                        <Link href="/system-health" className="block p-3 rounded-lg hover:bg-orange-50 transition-colors border border-orange-200">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-100 rounded-lg">
                                    <AlertCircle className="h-5 w-5 text-orange-700" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-900">System Health</p>
                                    <p className="text-sm text-slate-500">Run diagnostics</p>
                                </div>
                            </div>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </div >
    )
}
