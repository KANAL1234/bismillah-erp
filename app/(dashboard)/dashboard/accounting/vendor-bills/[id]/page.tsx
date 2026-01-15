'use client'

import React, { use } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { PermissionGuard } from '@/components/permission-guard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { useVendorBill } from '@/lib/queries/vendor-bills'

function VendorBillDetailContent({ id }: { id: string }) {
    const { data: bill, isLoading } = useVendorBill(id)

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            draft: 'bg-yellow-100 text-yellow-800',
            approved: 'bg-blue-100 text-blue-800',
            posted: 'bg-blue-100 text-blue-800',
            goods_received: 'bg-green-100 text-green-800',
            cancelled: 'bg-red-100 text-red-800',
        }
        return colors[status] || 'bg-gray-100 text-gray-800'
    }

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            draft: 'Draft',
            approved: 'Approved',
            posted: 'Posted',
            goods_received: 'Goods Received',
            cancelled: 'Cancelled',
        }
        return labels[status] || status
    }

    const getPaymentStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            unpaid: 'bg-red-100 text-red-800',
            partial: 'bg-yellow-100 text-yellow-800',
            paid: 'bg-green-100 text-green-800',
            overdue: 'bg-red-100 text-red-800',
        }
        return colors[status] || 'bg-gray-100 text-gray-800'
    }

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading details...</div>
    if (!bill) return <div className="p-8 text-center text-red-500">Vendor bill not found</div>

    const items = (bill as any).vendor_bill_items || []

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/accounting/vendor-bills">
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            {bill.bill_number}
                            <Badge className={getStatusBadge(bill.status)} variant="outline">
                                {getStatusLabel(bill.status)}
                            </Badge>
                        </h1>
                        <p className="text-muted-foreground">
                            Vendor: <span className="font-medium text-foreground">{(bill as any).vendors?.name}</span>
                        </p>
                    </div>
                </div>
                <Badge className={getPaymentStatusBadge(bill.payment_status)} variant="outline">
                    {bill.payment_status}
                </Badge>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Bill Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                            <div className="text-muted-foreground">Bill Date</div>
                            <div className="font-medium">{format(new Date(bill.bill_date), 'MMM dd, yyyy')}</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground">Due Date</div>
                            <div className="font-medium">{format(new Date(bill.due_date), 'MMM dd, yyyy')}</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground">Reference</div>
                            <div className="font-medium">{bill.reference_number || '-'}</div>
                        </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <div className="text-muted-foreground">Subtotal</div>
                            <div className="font-semibold">PKR {bill.subtotal.toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground">Tax</div>
                            <div className="font-semibold">PKR {bill.tax_amount.toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground">WHT</div>
                            <div className="font-semibold">PKR {bill.wht_amount.toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground">Total</div>
                            <div className="font-semibold">PKR {bill.total_amount.toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground">Amount Paid</div>
                            <div className="font-semibold">PKR {bill.amount_paid.toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground">Amount Due</div>
                            <div className="font-semibold">PKR {bill.amount_due.toLocaleString()}</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Line Items</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead className="text-right">Unit Price</TableHead>
                                <TableHead className="text-right">Line Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                                        No items found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                items.map((item: any) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            {item.products?.name || item.description || 'Item'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {Number(item.quantity).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            PKR {Number(item.unit_price).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            PKR {Number(item.line_total).toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}

export default function VendorBillDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    return (
        <PermissionGuard permission="accounting.vendor_bills.read">
            <VendorBillDetailContent id={id} />
        </PermissionGuard>
    )
}
