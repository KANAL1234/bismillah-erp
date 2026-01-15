'use client'

import { useState } from 'react'
import { usePOSSales } from '@/lib/queries/pos-sales'
import { useLocations } from '@/lib/queries/locations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Receipt as ReceiptComponent } from '@/components/pos/receipt'
import { ArrowLeft, Receipt, Search, Calendar, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { formatDate } from '@/lib/utils'
import { useLocation } from '@/components/providers/location-provider'
import { PermissionGuard } from '@/components/permission-guard'
import { toast } from 'sonner'

export default function SalesHistoryPage() {
    return (
        <PermissionGuard permission="pos.sales.view">
            <SalesHistoryContent />
        </PermissionGuard>
    )
}

function SalesHistoryContent() {
    // Default to last 30 days to show mobile app sales
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)
    const { allowedLocationIds, currentLocationId } = useLocation()

    const { data: locations } = useLocations()
    const { data: sales, isLoading } = usePOSSales(currentLocationId || undefined, startDate, endDate)

    // Filter locations by LBAC
    const allowedLocations = locations?.filter(loc => allowedLocationIds.includes(loc.id))

    // Filter sales by LBAC - only show sales from allowed locations
    const accessibleSales = sales?.filter(sale =>
        allowedLocationIds.includes(sale.location_id)
    )

    // Filter by search
    const filteredSales = accessibleSales?.filter(sale => {
        const query = searchQuery.toLowerCase()
        return (
            sale.sale_number.toLowerCase().includes(query) ||
            sale.customers?.name.toLowerCase().includes(query) ||
            sale.cashier?.full_name.toLowerCase().includes(query)
        )
    })

    // Calculate summary
    const totalSales = filteredSales?.length || 0
    const totalAmount = filteredSales?.reduce((sum, s) => sum + s.total_amount, 0) || 0
    const totalCash = filteredSales?.filter(s => s.payment_method === 'CASH')
        .reduce((sum, s) => sum + s.amount_paid, 0) || 0
    const totalCredit = filteredSales?.filter(s => s.payment_method === 'CREDIT')
        .reduce((sum, s) => sum + s.total_amount, 0) || 0

    return (
        <div className="px-4 sm:px-0">
            <div className="flex items-center mb-6">
                <Link href="/dashboard/pos">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to POS
                    </Button>
                </Link>
                <h2 className="text-3xl font-bold text-gray-900 ml-4">Sales History</h2>
            </div>

            {/* Location Context Alert */}
            {currentLocationId && (
                <Alert className="mb-6 bg-blue-50 border-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="flex items-center justify-between">
                        <span>
                            Showing sales for: <strong>{locations?.find(l => l.id === currentLocationId)?.name || 'Selected Location'}</strong>
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                // This will be handled by changing the location selector in the header
                                toast.info('To view all locations, change the location selector in the header to "All Locations"')
                            }}
                        >
                            View All Locations
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {/* Debug Info */}
            <Card className="mb-6 bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                    <div className="text-sm space-y-2">
                        <p><strong>Debug Info:</strong></p>
                        <p>• Total sales fetched: {sales?.length || 0}</p>
                        <p>• After LBAC filter: {accessibleSales?.length || 0}</p>
                        <p>• After search filter: {filteredSales?.length || 0}</p>
                        <p>• Current Location ID: {currentLocationId || 'All Locations'}</p>
                        <p>• Allowed Location IDs: {allowedLocationIds.join(', ')}</p>
                        <p>• Date Range: {startDate} to {endDate}</p>
                        <p>• Loading: {isLoading ? 'Yes' : 'No'}</p>
                    </div>
                </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalSales}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Rs. {totalAmount.toLocaleString()}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Cash Sales</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            Rs. {totalCash.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Credit Sales</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">
                            Rs. {totalCredit.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card className="mb-6">
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Start Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">End Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium">Search</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Search by sale #, customer, cashier..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Sales Table */}
            <Card>
                <CardContent className="pt-6">
                    {isLoading ? (
                        <div className="text-center py-8">Loading sales...</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Sale #</TableHead>
                                    <TableHead>Date/Time</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Items</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Payment</TableHead>
                                    <TableHead>Cashier</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredSales?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center text-gray-500">
                                            No sales found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredSales?.map((sale) => (
                                        <TableRow key={sale.id}>
                                            <TableCell className="font-medium">
                                                {sale.sale_number}
                                            </TableCell>
                                            <TableCell>
                                                {formatDate(sale.sale_date)}
                                                <div className="text-xs text-gray-500">
                                                    {format(new Date(sale.sale_date), 'hh:mm a')}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {sale.customers?.name || 'Walk-in'}
                                            </TableCell>
                                            <TableCell>
                                                {sale.pos_sale_items?.length || 0} items
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">
                                                Rs. {sale.total_amount.toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        sale.payment_method === 'CASH'
                                                            ? 'default'
                                                            : 'secondary'
                                                    }
                                                >
                                                    {sale.payment_method}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {sale.cashier?.full_name || '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setSelectedSaleId(sale.id)}
                                                >
                                                    <Receipt className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Receipt Dialog */}
            <Dialog open={!!selectedSaleId} onOpenChange={() => setSelectedSaleId(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Sale Receipt</DialogTitle>
                    </DialogHeader>
                    {selectedSaleId && (
                        <ReceiptComponent
                            saleId={selectedSaleId}
                            onClose={() => setSelectedSaleId(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
