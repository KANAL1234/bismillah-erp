'use client'

import { useState } from 'react'
import { usePurchaseOrders, useUpdatePOStatus, useDeletePurchaseOrder } from '@/lib/queries/purchase-orders'
import { PermissionGuard } from '@/components/permission-guard'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Plus, Check, X, Trash2, Send } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

export default function PurchaseOrdersPage() {
    return (
        <PermissionGuard permission="procurement.purchase_orders.read">
            <PurchaseOrdersContent />
        </PermissionGuard>
    )
}

function PurchaseOrdersContent() {
    const { data: allOrders, isLoading } = usePurchaseOrders()
    const updateStatus = useUpdatePOStatus()
    const deletePO = useDeletePurchaseOrder()

    const getStatusColor = (status: string) => {
        const colors = {
            DRAFT: 'secondary',
            PENDING_APPROVAL: 'default',
            APPROVED: 'default',
            SENT_TO_VENDOR: 'default',
            PARTIALLY_RECEIVED: 'default',
            RECEIVED: 'default',
            CANCELLED: 'destructive',
        }
        return colors[status as keyof typeof colors] || 'secondary'
    }

    const handleStatusChange = async (id: string, newStatus: string) => {
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

    const handleDelete = async (id: string, poNumber: string) => {
        if (!confirm(`Delete purchase order ${poNumber}?`)) return

        try {
            await deletePO.mutateAsync(id)
            toast.success('Success', {
                description: 'Purchase order deleted',
            })
        } catch (error: any) {
            toast.error('Error', {
                description: error.message,
            })
        }
    }

    if (isLoading) {
        return <div className="flex items-center justify-center h-64">Loading...</div>
    }

    const draftOrders = allOrders?.filter(o => o.status === 'DRAFT')
    const pendingOrders = allOrders?.filter(o => o.status === 'PENDING_APPROVAL')
    const approvedOrders = allOrders?.filter(o => ['APPROVED', 'SENT_TO_VENDOR'].includes(o.status))
    const receivedOrders = allOrders?.filter(o => ['PARTIALLY_RECEIVED', 'RECEIVED'].includes(o.status))

    return (
        <div className="px-4 sm:px-0">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-900">Purchase Orders</h2>
                <Link href="/dashboard/purchases/orders/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        New Purchase Order
                    </Button>
                </Link>
            </div>

            <Tabs defaultValue="all" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="all">All ({allOrders?.length || 0})</TabsTrigger>
                    <TabsTrigger value="draft">Draft ({draftOrders?.length || 0})</TabsTrigger>
                    <TabsTrigger value="pending">Pending ({pendingOrders?.length || 0})</TabsTrigger>
                    <TabsTrigger value="approved">Approved ({approvedOrders?.length || 0})</TabsTrigger>
                    <TabsTrigger value="received">Received ({receivedOrders?.length || 0})</TabsTrigger>
                </TabsList>

                {['all', 'draft', 'pending', 'approved', 'received'].map(tab => {
                    const orders =
                        tab === 'all' ? allOrders :
                            tab === 'draft' ? draftOrders :
                                tab === 'pending' ? pendingOrders :
                                    tab === 'approved' ? approvedOrders :
                                        receivedOrders

                    return (
                        <TabsContent key={tab} value={tab}>
                            <Card>
                                <CardContent className="pt-6">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>PO #</TableHead>
                                                <TableHead>Vendor</TableHead>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Expected Delivery</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {orders?.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center text-gray-500">
                                                        No purchase orders found
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                orders?.map((order) => (
                                                    <TableRow key={order.id}>
                                                        <TableCell className="font-medium">
                                                            {order.po_number}
                                                        </TableCell>
                                                        <TableCell>{order.vendors?.name}</TableCell>
                                                        <TableCell>
                                                            {format(new Date(order.po_date), 'MMM dd, yyyy')}
                                                        </TableCell>
                                                        <TableCell>
                                                            {order.expected_delivery_date
                                                                ? format(new Date(order.expected_delivery_date), 'MMM dd, yyyy')
                                                                : '-'
                                                            }
                                                        </TableCell>
                                                        <TableCell className="text-right font-semibold">
                                                            Rs. {order.total_amount.toLocaleString()}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={getStatusColor(order.status) as any}>
                                                                {order.status.replace('_', ' ')}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Link href={`/dashboard/purchases/orders/${order.id}`}>
                                                                    <Button variant="ghost" size="sm">
                                                                        View
                                                                    </Button>
                                                                </Link>

                                                                {order.status === 'DRAFT' && (
                                                                    <>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleStatusChange(order.id, 'PENDING_APPROVAL')}
                                                                        >
                                                                            Submit
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleDelete(order.id, order.po_number)}
                                                                        >
                                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                                        </Button>
                                                                    </>
                                                                )}

                                                                {order.status === 'PENDING_APPROVAL' && (
                                                                    <>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleStatusChange(order.id, 'APPROVED')}
                                                                        >
                                                                            <Check className="h-4 w-4 text-green-500" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleStatusChange(order.id, 'CANCELLED')}
                                                                        >
                                                                            <X className="h-4 w-4 text-red-500" />
                                                                        </Button>
                                                                    </>
                                                                )}

                                                                {order.status === 'APPROVED' && (
                                                                    <>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleStatusChange(order.id, 'SENT_TO_VENDOR')}
                                                                        >
                                                                            <Send className="h-4 w-4" />
                                                                        </Button>
                                                                        <Link href={`/dashboard/purchases/grn/new?po=${order.id}`}>
                                                                            <Button variant="ghost" size="sm">
                                                                                Receive
                                                                            </Button>
                                                                        </Link>
                                                                    </>
                                                                )}

                                                                {order.status === 'SENT_TO_VENDOR' && (
                                                                    <Link href={`/dashboard/purchases/grn/new?po=${order.id}`}>
                                                                        <Button variant="ghost" size="sm">
                                                                            Receive
                                                                        </Button>
                                                                    </Link>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    )
                })}
            </Tabs>
        </div>
    )
}
