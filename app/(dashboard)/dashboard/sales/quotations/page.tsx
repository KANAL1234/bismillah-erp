'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, FileText, MoreHorizontal } from 'lucide-react'
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
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSalesQuotations, useDeleteSalesQuotation } from '@/lib/queries/sales-quotations'
import { format } from 'date-fns'
import { SalesQuotation } from '@/lib/types/database'

export default function SalesQuotationsPage() {
    const { data: quotations, isLoading } = useSalesQuotations()
    const deleteQuotation = useDeleteSalesQuotation()
    const [searchTerm, setSearchTerm] = useState('')

    const filteredQuotations = quotations?.filter(q =>
        q.quotation_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.customers?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.reference_number?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const getStatusBadge = (status: SalesQuotation['status']) => {
        switch (status) {
            case 'draft': return <Badge variant="secondary">Draft</Badge>
            case 'pending': return <Badge className="bg-yellow-500 hover:bg-yellow-600">Pending</Badge>
            case 'approved': return <Badge className="bg-green-500 hover:bg-green-600">Approved</Badge>
            case 'rejected': return <Badge variant="destructive">Rejected</Badge>
            case 'converted': return <Badge className="bg-blue-500 hover:bg-blue-600">Converted</Badge>
            case 'expired': return <Badge variant="outline" className="text-gray-500">Expired</Badge>
            default: return <Badge variant="outline">{status}</Badge>
        }
    }

    if (isLoading) {
        return <div className="p-8 text-center">Loading quotations...</div>
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Sales Quotations</h1>
                    <p className="text-muted-foreground">Manage your sales quotations and estimates.</p>
                </div>
                <Link href="/dashboard/sales/quotations/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Quotation
                    </Button>
                </Link>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle className="text-base font-medium">
                        Recent Quotations
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search quotations..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 w-[250px]"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Number</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Valid Until</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredQuotations?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                        No quotations found. Create one to get started.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredQuotations?.map((quotation) => (
                                    <TableRow key={quotation.id}>
                                        <TableCell className="font-medium">
                                            {quotation.quotation_number}
                                            {quotation.reference_number && (
                                                <div className="text-xs text-muted-foreground">
                                                    Ref: {quotation.reference_number}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>{format(new Date(quotation.quotation_date), 'MMM dd, yyyy')}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{quotation.customers?.name}</div>
                                            <div className="text-xs text-muted-foreground">{quotation.customers?.customer_code}</div>
                                        </TableCell>
                                        <TableCell>{format(new Date(quotation.valid_until), 'MMM dd, yyyy')}</TableCell>
                                        <TableCell className="font-medium">
                                            ${quotation.total_amount.toLocaleString()}
                                        </TableCell>
                                        <TableCell>{getStatusBadge(quotation.status)}</TableCell>
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
                                                        <Link href={`/dashboard/sales/quotations/${quotation.id}`}>
                                                            <FileText className="mr-2 h-4 w-4" />
                                                            View Details
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    {quotation.status === 'draft' && (
                                                        <DropdownMenuItem
                                                            className="text-red-600"
                                                            onClick={() => {
                                                                if (confirm('Are you sure you want to delete this draft?')) {
                                                                    deleteQuotation.mutate(quotation.id)
                                                                }
                                                            }}
                                                        >
                                                            Delete Draft
                                                        </DropdownMenuItem>
                                                    )}
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
