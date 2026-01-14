'use client'

import { useEffect, useState } from 'react'
import { PermissionGuard } from '@/components/permission-guard'
import { createClient } from '@/lib/supabase/client'
import { useLocation } from '@/components/providers/location-provider'
import { useAuth } from '@/components/providers/auth-provider'
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
    Calculator,
    BarChart3,
    Lock
} from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
    return (
        <PermissionGuard
            permission="dashboard.overview.view"
            fallback={
                <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Welcome to Bismillah ERP</h2>
                    <p className="mt-2 text-slate-600">Please select a module from the sidebar to get started.</p>
                </div>
            }
        >
            <DashboardContent />
        </PermissionGuard>
    )
}

function DashboardContent() {
    const { allowedLocationIds, currentLocationId } = useLocation()
    const { hasPermission } = useAuth()
    const [metrics, setMetrics] = useState<any>({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (allowedLocationIds.length === 0) return
        loadDashboardData()
    }, [allowedLocationIds, currentLocationId])

    const loadDashboardData = async () => {
        const supabase = createClient()

        // Determine which locations to query
        const locationsToQuery = currentLocationId ? [currentLocationId] : allowedLocationIds

        // Get current date for filtering
        const today = new Date().toISOString().split('T')[0]
        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

        // === INVENTORY METRICS (LBAC Filtered) ===
        const { count: productCount } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })

        const { data: stockData } = await supabase
            .from('inventory_stock')
            .select('quantity_on_hand, location_id, products(cost_price)')
            .in('location_id', locationsToQuery)

        const lowStockCount = stockData?.filter(s => s.quantity_on_hand < 10).length || 0

        const inventoryValue = stockData?.reduce((sum, item: any) => {
            return sum + (item.quantity_on_hand * (item.products?.cost_price || 0))
        }, 0) || 0

        // === SALES METRICS (LBAC Filtered) ===
        const { count: customerCount } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })

        // Today's POS Sales (filtered by location)
        const { data: todaySales } = await supabase
            .from('pos_sales')
            .select('total_amount, location_id')
            .gte('sale_date', today)
            .in('location_id', locationsToQuery)

        const todaySalesTotal = todaySales?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0

        // This Month's POS Sales (filtered by location)
        const { data: monthSales } = await supabase
            .from('pos_sales')
            .select('total_amount, location_id')
            .gte('sale_date', firstDayOfMonth)
            .in('location_id', locationsToQuery)

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
        const { data: bankAccounts } = await supabase
            .from('bank_accounts')
            .select('current_balance')

        const totalBankBalance = bankAccounts?.reduce((sum, acc) => sum + acc.current_balance, 0) || 0

        const { count: unpaidInvoicesCount } = await supabase
            .from('customer_invoices_accounting')
            .select('*', { count: 'exact', head: true })
            .in('status', ['draft', 'posted'])

        // === ANALYTICS ===
        const { data: creditRiskData } = await supabase.rpc('get_customers_near_credit_limit', {
            p_threshold_pct: 0.7
        })

        const { data: topProducts } = await supabase.rpc('get_sales_by_product', {
            p_start_date: firstDayOfMonth,
            p_end_date: today
        })

        // === HR METRICS ===
        const { count: activeEmployeeCount } = await supabase
            .from('employees')
            .select('*', { count: 'exact', head: true })
            .eq('employment_status', 'ACTIVE')

        const { count: todayAttendanceCount } = await supabase
            .from('attendance')
            .select('*', { count: 'exact', head: true })
            .eq('attendance_date', today)
            .eq('status', 'PRESENT')
            .in('location_id', locationsToQuery)

        const { count: pendingLeavesCount } = await supabase
            .from('leave_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'PENDING')

        const displayProducts = (topProducts || [])
            .sort((a: any, b: any) => b.total_sales - a.total_sales)
            .slice(0, 5)

        // === LOCATION INFO ===
        const { data: userLocations } = await supabase
            .from('locations')
            .select('id, name, code')
            .in('id', allowedLocationIds)

        setMetrics({
            productCount,
            lowStockCount,
            inventoryValue,
            customerCount,
            todaySalesTotal,
            todaySalesCount: todaySales?.length || 0,
            monthSalesTotal,
            monthSalesCount: monthSales?.length || 0,
            pendingOrdersCount,
            vendorCount,
            pendingPOCount,
            approvedPOCount,
            totalBankBalance,
            bankAccountsCount: bankAccounts?.length || 0,
            unpaidInvoicesCount,
            creditRiskData,
            displayProducts,
            userLocations,
            locationsCount: userLocations?.length || 0,
            activeEmployeeCount: activeEmployeeCount || 0,
            todayAttendanceCount: todayAttendanceCount || 0,
            pendingLeavesCount: pendingLeavesCount || 0
        })

        setLoading(false)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-slate-600">Loading dashboard...</p>
                </div>
            </div>
        )
    }

    const locationContext = currentLocationId
        ? metrics.userLocations?.find((l: any) => l.id === currentLocationId)?.name
        : `All ${metrics.locationsCount} Locations`

    return (
        <div className="space-y-6">
            {/* Header with Location Context */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">Dashboard Overview</h2>
                    <p className="text-slate-600 mt-1 flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Showing data for: <span className="font-semibold text-blue-600">{locationContext}</span>
                    </p>
                </div>
                <Link href="/dashboard/accounting/reports/financial">
                    <Badge variant="outline" className="gap-2 px-4 py-2 cursor-pointer hover:bg-blue-50">
                        <BarChart3 className="h-4 w-4" />
                        Financial Reports
                    </Badge>
                </Link>
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
                        <div className="text-2xl font-bold text-green-600">PKR {metrics.todaySalesTotal?.toLocaleString()}</div>
                        <p className="text-xs text-slate-500 mt-1">{metrics.todaySalesCount} transactions</p>
                    </CardContent>
                </Card>

                {/* Month's Sales */}
                <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-blue-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">This Month</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">PKR {metrics.monthSalesTotal?.toLocaleString()}</div>
                        <p className="text-xs text-slate-500 mt-1">{metrics.monthSalesCount} sales</p>
                    </CardContent>
                </Card>

                {/* Inventory Value */}
                <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-purple-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
                        <Package className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-600">PKR {metrics.inventoryValue?.toLocaleString()}</div>
                        <p className="text-xs text-slate-500 mt-1">{metrics.productCount || 0} products</p>
                    </CardContent>
                </Card>

                {/* Bank Balance */}
                <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-orange-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Bank Balance</CardTitle>
                        <Calculator className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">PKR {metrics.totalBankBalance?.toLocaleString()}</div>
                        <p className="text-xs text-slate-500 mt-1">{metrics.bankAccountsCount} accounts</p>
                    </CardContent>
                </Card>
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Customers</CardTitle>
                        <Users className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.customerCount || 0}</div>
                        <p className="text-xs text-slate-500">Registered</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Vendors</CardTitle>
                        <Truck className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.vendorCount || 0}</div>
                        <p className="text-xs text-slate-500">Suppliers</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
                        <Users className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{metrics.activeEmployeeCount}</div>
                        <p className="text-xs text-slate-500">Staff members</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Attendance</CardTitle>
                        <Clock className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">{metrics.todayAttendanceCount}</div>
                        <p className="text-xs text-slate-500">Present today</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{metrics.lowStockCount || 0}</div>
                        <p className="text-xs text-slate-500">Need reorder</p>
                    </CardContent>
                </Card>
            </div>

            {/* Analytics Grid */}
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
                        {metrics.creditRiskData && metrics.creditRiskData.length > 0 ? (
                            metrics.creditRiskData.map((risk: any) => (
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

                {/* Top Products */}
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
                            {metrics.displayProducts?.length > 0 ? (
                                metrics.displayProducts.map((p: any, i: number) => (
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
                                    {metrics.pendingPOCount || 0}
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
                                    {metrics.approvedPOCount || 0}
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
                                    {metrics.pendingOrdersCount || 0}
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
                                    {metrics.unpaidInvoicesCount || 0}
                                </Badge>
                            </div>
                        </Link>

                        <Link href="/dashboard/hr/leaves" className="block p-3 rounded-lg hover:bg-slate-50 transition-colors border">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-slate-900">Leave Requests</p>
                                    <p className="text-sm text-slate-500">Pending approval</p>
                                </div>
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                    {metrics.pendingLeavesCount || 0}
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

                        <Link href="/dashboard/hr/payroll" className="block p-3 rounded-lg hover:bg-emerald-50 transition-colors border border-emerald-200">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 rounded-lg">
                                    <DollarSign className="h-5 w-5 text-emerald-700" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-900">Payroll Management</p>
                                    <p className="text-sm text-slate-500">Process monthly salaries</p>
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
        </div>
    )
}
