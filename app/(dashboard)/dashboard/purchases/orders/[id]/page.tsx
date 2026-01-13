'use client'

import { useParams } from 'next/navigation'
import { usePurchaseOrder, useUpdatePOStatus } from '@/lib/queries/purchase-orders'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { ArrowLeft, Check, X, Send, Printer } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

export default function PurchaseOrderDetailPage() {
    const params = useParams()
    const id = params.id as string
    const { data: order, isLoading } = usePurchaseOrder(id)
    const updateStatus = useUpdatePOStatus()

    const handleStatusChange = async (newStatus: string) => {
        try {
            await updateStatus.mutateAsync({ id, status: newStatus })
            toast.success('Success', {
                description: `Purchase order ${newStatus.toLowerCase()}`,
            })
        } catch (error: any) {
            toast.error('Error', {
                description: error.message,
            })
        }
    }

    const handlePrint = () => {
        window.print()
    }

    if (isLoading) {
        return <div className="flex items-center justify-center h-64">Loading...</div>
    }

    if (!order) {
        return <div className="flex items-center justify-center h-64">Order not found</div>
    }

    return (
        <div className="px-4 sm:px-0">
            <div className="flex items-center justify-between mb-6 no-print">
                <div className="flex items-center">
                    <Link href="/dashboard/purchases/orders">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back
                        </Button>
                    </Link>
                    <h2 className="text-3xl font-bold text-gray-900 ml-4">
                        {order.po_number}
                    </h2>
                    <Badge className="ml-4" variant="outline">
                        {order.status.replace('_', ' ')}
                    </Badge>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                    </Button>

                    {order.status === 'DRAFT' && (
                        <Button onClick={() => handleStatusChange('PENDING_APPROVAL')}>
                            Submit for Approval
                        </Button>
                    )}

                    {order.status === 'PENDING_APPROVAL' && (
                        <>
                            <Button variant="destructive" onClick={() => handleStatusChange('CANCELLED')}>
                                <X className="mr-2 h-4 w-4" />
                                Reject
                            </Button>
                            <Button onClick={() => handleStatusChange('APPROVED')}>
                                <Check className="mr-2 h-4 w-4" />
                                Approve
                            </Button>
                        </>
                    )}

                    {order.status === 'APPROVED' && (
                        <>
                            <Button onClick={() => handleStatusChange('SENT_TO_VENDOR')}>
                                <Send className="mr-2 h-4 w-4" />
                                Mark Sent
                            </Button>
                            <Link href={`/dashboard/purchases/grn/new?po=${order.id}`}>
                                <Button variant="secondary">
                                    Receive Goods
                                </Button>
                            </Link>
                        </>
                    )}

                    {['SENT_TO_VENDOR', 'PARTIALLY_RECEIVED'].includes(order.status) && (
                        <Link href={`/dashboard/purchases/grn/new?po=${order.id}`}>
                            <Button variant="secondary">
                                Receive Goods
                            </Button>
                        </Link>
                    )}
                </div>
            </div>

            <div className="grid gap-6">
                {/* Header Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Vendor Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg font-semibold">{order.vendors.name}</div>
                            <div className="text-gray-500">{order.vendors.address}</div>
                            <div className="text-gray-500">{order.vendors.phone}</div>
                            <div className="text-gray-500">{order.vendors.email}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Order Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-between py-1">
                                <span className="text-gray-500">PO Date:</span>
                                <span className="font-medium">{format(new Date(order.po_date), 'MMM dd, yyyy')}</span>
                            </div>
                            <div className="flex justify-between py-1">
                                <span className="text-gray-500">Expected Delivery:</span>
                                <span className="font-medium">
                                    {order.expected_delivery_date ? format(new Date(order.expected_delivery_date), 'MMM dd, yyyy') : '-'}
                                </span>
                            </div>
                            <div className="flex justify-between py-1">
                                <span className="text-gray-500">Location:</span>
                                <span className="font-medium">{order.locations.name} ({order.locations.code})</span>
                            </div>
                            <div className="flex justify-between py-1">
                                <span className="text-gray-500">Requested By:</span>
                                <span className="font-medium">{order.requested_by_user?.full_name || '-'}</span>
                            </div>
                            <div className="flex justify-between py-1">
                                <span className="text-gray-500">Approved By:</span>
                                <span className="font-medium">{order.approved_by_user?.full_name || '-'}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Items Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead className="text-right">Quantity</TableHead>
                                    <TableHead className="text-right">Received</TableHead>
                                    <TableHead className="text-right">Unit Price</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {order.purchase_order_items.map((item: any) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.products.name}</TableCell>
                                        <TableCell>{item.products.sku}</TableCell>
                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                        <TableCell className="text-right">
                                            <span className={item.quantity_received < item.quantity ? 'text-orange-500' : 'text-green-600'}>
                                                {item.quantity_received}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">Rs. {item.unit_price.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">Rs. {item.line_total.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Totals */}
                <div className="flex justify-end">
                    <Card className="w-full md:w-1/3">
                        <CardContent className="pt-6">
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Subtotal:</span>
                                    <span>Rs. {order.subtotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Tax:</span>
                                    <span>Rs. {order.tax_amount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Discount:</span>
                                    <span>Rs. {order.discount_amount.toLocaleString()}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between font-bold text-lg">
                                    <span>Total:</span>
                                    <span>Rs. {order.total_amount.toLocaleString()}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Notes */}
                {(order.notes || order.terms_and_conditions) && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Additional Info</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {order.notes && (
                                <div>
                                    <h4 className="font-semibold mb-1">Notes</h4>
                                    <p className="text-gray-600">{order.notes}</p>
                                </div>
                            )}
                            {order.terms_and_conditions && (
                                <div>
                                    <h4 className="font-semibold mb-1">Terms & Conditions</h4>
                                    <p className="text-gray-600">{order.terms_and_conditions}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
