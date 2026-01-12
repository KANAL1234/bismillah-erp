'use client'

import { useState } from 'react'
import { useStockTransfers, useUpdateTransferStatus, useDeleteTransfer } from '@/lib/queries/stock-transfers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Plus, ArrowRight, Check, X, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { format } from 'date-fns'

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function StockTransfersPage() {
    const { data: allTransfers, isLoading } = useStockTransfers()
    const updateStatus = useUpdateTransferStatus()
    const deleteTransfer = useDeleteTransfer()
    const [itemToDelete, setItemToDelete] = useState<{ id: string, number: string } | null>(null)

    const getStatusColor = (status: string) => {
        const colors = {
            DRAFT: 'secondary' as const,
            PENDING_APPROVAL: 'default' as const,
            APPROVED: 'default' as const,
            IN_TRANSIT: 'default' as const,
            COMPLETED: 'default' as const,
            CANCELLED: 'destructive' as const,
        }
        return colors[status as keyof typeof colors] || 'secondary'
    }

    const handleStatusChange = async (id: string, newStatus: string) => {
        console.log(`🎯 UI: handleStatusChange called - ID: ${id}, New Status: ${newStatus}`)
        try {
            await updateStatus.mutateAsync({ id, status: newStatus })
            console.log(`✅ UI: Status change successful`)
            toast.success('Success', {
                description: `Transfer ${newStatus.toLowerCase()}`,
            })
        } catch (error: any) {
            console.error(`❌ UI: Status change failed:`, error)
            toast.error('Error', {
                description: error.message,
            })
        }
    }

    const handleDelete = (id: string, transferNumber: string) => {
        setItemToDelete({ id, number: transferNumber })
    }

    const confirmDelete = async () => {
        if (!itemToDelete) return

        try {
            await deleteTransfer.mutateAsync(itemToDelete.id)
            toast.success('Success', {
                description: 'Transfer deleted',
            })
            setItemToDelete(null)
        } catch (error: any) {
            toast.error('Error', {
                description: error.message,
            })
        }
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                <p className="text-slate-500 font-medium">Loading transfers...</p>
            </div>
        )
    }

    const draftTransfers = allTransfers?.filter(t => t.status === 'DRAFT')
    const pendingTransfers = allTransfers?.filter(t => t.status === 'PENDING_APPROVAL')
    const inProgressTransfers = allTransfers?.filter(t => ['APPROVED', 'IN_TRANSIT'].includes(t.status))
    const completedTransfers = allTransfers?.filter(t => t.status === 'COMPLETED')

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">Stock Transfers</h2>
                    <p className="text-slate-500">Manage movement of goods between locations.</p>
                </div>
                <Link href="/dashboard/inventory/transfers/new">
                    <Button className="w-full md:w-auto">
                        <Plus className="mr-2 h-4 w-4" />
                        New Transfer
                    </Button>
                </Link>
            </div>

            <Tabs defaultValue="all" className="space-y-4">
                <div className="flex justify-between items-center bg-white p-1 rounded-lg border">
                    <TabsList className="bg-transparent">
                        <TabsTrigger value="all" className="data-[state=active]:bg-slate-100">All ({allTransfers?.length || 0})</TabsTrigger>
                        <TabsTrigger value="draft" className="data-[state=active]:bg-slate-100">Draft ({draftTransfers?.length || 0})</TabsTrigger>
                        <TabsTrigger value="pending" className="data-[state=active]:bg-slate-100">Pending ({pendingTransfers?.length || 0})</TabsTrigger>
                        <TabsTrigger value="in-progress" className="data-[state=active]:bg-slate-100">In Progress ({inProgressTransfers?.length || 0})</TabsTrigger>
                        <TabsTrigger value="completed" className="data-[state=active]:bg-slate-100">Completed ({completedTransfers?.length || 0})</TabsTrigger>
                    </TabsList>
                </div>

                {['all', 'draft', 'pending', 'in-progress', 'completed'].map(tab => {
                    const transfers =
                        tab === 'all' ? allTransfers :
                            tab === 'draft' ? draftTransfers :
                                tab === 'pending' ? pendingTransfers :
                                    tab === 'in-progress' ? inProgressTransfers :
                                        completedTransfers

                    return (
                        <TabsContent key={tab} value={tab} className="mt-0">
                            <Card>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader className="bg-slate-50/50">
                                                <TableRow>
                                                    <TableHead className="font-bold">Transfer #</TableHead>
                                                    <TableHead className="font-bold">From</TableHead>
                                                    <TableHead className="font-bold"></TableHead>
                                                    <TableHead className="font-bold">To</TableHead>
                                                    <TableHead className="font-bold">Date</TableHead>
                                                    <TableHead className="font-bold">Items</TableHead>
                                                    <TableHead className="font-bold">Status</TableHead>
                                                    <TableHead className="text-right font-bold">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {transfers?.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                                                            <p className="font-medium">No transfers found in this category</p>
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    transfers?.map((transfer) => (
                                                        <TableRow key={transfer.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <TableCell className="font-bold text-slate-900">
                                                                {transfer.transfer_number}
                                                            </TableCell>
                                                            <TableCell className="font-medium">{transfer.from_location.name}</TableCell>
                                                            <TableCell className="text-slate-400">
                                                                <ArrowRight className="h-4 w-4" />
                                                            </TableCell>
                                                            <TableCell className="font-medium">{transfer.to_location.name}</TableCell>
                                                            <TableCell className="text-slate-600">
                                                                {format(new Date(transfer.transfer_date), 'MMM dd, yyyy')}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline" className="font-normal">
                                                                    {transfer.stock_transfer_items?.length || 0} Products
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant={getStatusColor(transfer.status)} className="rounded-full px-2">
                                                                    {transfer.status.replace('_', ' ')}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex justify-end gap-1">
                                                                    <Link href={`/dashboard/inventory/transfers/${transfer.id}`}>
                                                                        <Button variant="ghost" size="sm" className="h-8">
                                                                            View
                                                                        </Button>
                                                                    </Link>

                                                                    {transfer.status === 'DRAFT' && (
                                                                        <>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                                                onClick={() => handleStatusChange(transfer.id, 'PENDING_APPROVAL')}
                                                                            >
                                                                                Submit
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                                                onClick={() => handleDelete(transfer.id, transfer.transfer_number)}
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </>
                                                                    )}

                                                                    {transfer.status === 'PENDING_APPROVAL' && (
                                                                        <>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                                                onClick={() => handleStatusChange(transfer.id, 'APPROVED')}
                                                                            >
                                                                                <Check className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                                                onClick={() => handleStatusChange(transfer.id, 'CANCELLED')}
                                                                            >
                                                                                <X className="h-4 w-4" />
                                                                            </Button>
                                                                        </>
                                                                    )}

                                                                    {transfer.status === 'APPROVED' && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50 font-bold"
                                                                            onClick={() => handleStatusChange(transfer.id, 'COMPLETED')}
                                                                        >
                                                                            Complete
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    )
                })}
            </Tabs>

            <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Transfer?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete transfer <span className="font-medium text-slate-900">{itemToDelete?.number}</span>?
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Delete Transfer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
