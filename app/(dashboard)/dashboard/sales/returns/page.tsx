'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, RotateCcw, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSalesReturns } from '@/lib/queries/sales-returns'
import { format } from 'date-fns'
import { SalesReturn } from '@/lib/types/database'

export default function SalesReturnsPage() {
    const { data: returns, isLoading } = useSalesReturns()
    const [searchTerm, setSearchTerm] = useState('')

    const filteredReturns = returns?.filter(ret =>
        ret.return_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ret.customers?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ret.sales_invoices?.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const getStatusBadge = (status: SalesReturn['status']) => {
        switch (status) {
            case 'draft': return <Badge variant="secondary">Draft</Badge>
            case 'approved': return <Badge className="bg-blue-500">Approved</Badge>
            case 'completed': return <Badge className="bg-green-600">Completed</Badge>
            case 'refunded': return <Badge className="bg-purple-600">Refunded</Badge>
            default: return <Badge variant="outline">{status}</Badge>
        }
    }

    if (isLoading) {
        return <div className="p-8 text-center">Loading returns...</div>
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Sales Returns</h1>
                    <p className="text-muted-foreground">Manage product returns and refunds.</p>
                </div>
                <Link href="/dashboard/sales/returns/new">
                    <Button variant="destructive">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Return
                    </Button>
                </Link>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle className="text-base font-medium">
                        Recent Returns
                    </CardTitle>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search returns..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 w-[250px]"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Return #</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Invoice #</TableHead>
                                <TableHead>Refund Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredReturns?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                        No returns found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredReturns?.map((ret) => (
                                    <TableRow key={ret.id}>
                                        <TableCell className="font-medium">{ret.return_number}</TableCell>
                                        <TableCell>{format(new Date(ret.return_date), 'MMM dd, yyyy')}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{ret.customers?.name}</div>
                                            <div className="text-xs text-muted-foreground">{ret.customers?.customer_code}</div>
                                        </TableCell>
                                        <TableCell>{ret.sales_invoices?.invoice_number || 'N/A'}</TableCell>
                                        <TableCell className="font-medium">${ret.refund_amount.toLocaleString()}</TableCell>
                                        <TableCell>{getStatusBadge(ret.status)}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/dashboard/sales/returns/${ret.id}`}>
                                                            <RotateCcw className="mr-2 h-4 w-4" />
                                                            View Details
                                                        </Link>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
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
