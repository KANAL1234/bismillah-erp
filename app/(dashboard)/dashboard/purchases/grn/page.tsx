'use client'

import { useGoodsReceipts } from '@/lib/queries/goods-receipts'
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
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

export default function GoodsReceiptsPage() {
    const { data: grns, isLoading } = useGoodsReceipts()

    if (isLoading) {
        return <div className="flex items-center justify-center h-64">Loading...</div>
    }

    return (
        <div className="px-4 sm:px-0">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-900">Goods Receipts</h2>
                <Link href="/dashboard/purchases/grn/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        New GRN
                    </Button>
                </Link>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>GRN #</TableHead>
                                <TableHead>PO #</TableHead>
                                <TableHead>Vendor</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {grns?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-gray-500">
                                        No goods receipts found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                grns?.map((grn) => (
                                    <TableRow key={grn.id}>
                                        <TableCell className="font-medium">
                                            {grn.grn_number}
                                        </TableCell>
                                        <TableCell>
                                            {grn.purchase_orders?.po_number ? (
                                                <Link href={`/dashboard/purchases/orders/${grn.po_id}`} className="text-blue-600 hover:underline">
                                                    {grn.purchase_orders.po_number}
                                                </Link>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell>{grn.vendors.name}</TableCell>
                                        <TableCell>
                                            {format(new Date(grn.receipt_date), 'MMM dd, yyyy')}
                                        </TableCell>
                                        <TableCell>{grn.locations.name}</TableCell>
                                        <TableCell className="text-right font-semibold">
                                            Rs. {grn.total_amount.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {/* Add view details button or link here if needed */}
                                            <Button variant="ghost" size="sm" disabled>View</Button>
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
