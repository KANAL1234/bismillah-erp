'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, FileText, Eye, MoreHorizontal, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSalesInvoices } from '@/lib/queries/sales-invoices'
import { useLocation } from '@/components/providers/location-provider'
import { PermissionGuard } from '@/components/permission-guard'
import { isPast, parseISO } from 'date-fns'
import { formatDate } from '@/lib/utils'
import { SalesInvoice } from '@/lib/types/database'

export default function SalesInvoicesPage() {
    return (
        <PermissionGuard permission="sales.invoices.read">
            <SalesInvoicesContent />
        </PermissionGuard>
    )
}

function SalesInvoicesContent() {
    const { currentLocationId } = useLocation()
    const { data: invoices, isLoading } = useSalesInvoices()
    const [searchTerm, setSearchTerm] = useState('')

    const filteredInvoices = invoices?.filter(invoice => {
        // Location filter
        if (currentLocationId) {
            const locationId = (invoice as any).location_id
            if (locationId && locationId !== currentLocationId) {
                return false
            }
        }

        // Search filter
        if (searchTerm) {
            return invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                invoice.customers?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                invoice.sales_orders?.order_number?.toLowerCase().includes(searchTerm.toLowerCase())
        }

        return true
    })

    const getStatusBadge = (status: SalesInvoice['status'], dueDate: string) => {
        const isOverdue = status !== 'paid' && status !== 'void' && isPast(parseISO(dueDate));

        if (status === 'paid') return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Paid</Badge>
        if (status === 'void') return <Badge variant="destructive">Void</Badge>
        if (isOverdue) return <Badge variant="destructive">Overdue</Badge>
        if (status === 'posted') return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">Posted</Badge>

        return <Badge variant="secondary">Draft</Badge>
    }

    if (isLoading) {
        return <div className="p-8 text-center">Loading invoices...</div>
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Sales Invoices</h1>
                    <p className="text-muted-foreground">
                        {currentLocationId
                            ? 'Showing invoices for selected location'
                            : 'Manage your sales invoices and payments (all locations)'}
                    </p>
                </div>
                <Link href="/dashboard/sales/invoices/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Invoice
                    </Button>
                </Link>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle className="text-base font-medium">
                        Recent Invoices
                    </CardTitle>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search invoices..."
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
                                <TableHead>Invoice #</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Based On</TableHead>
                                <TableHead>Due Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredInvoices?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">
                                        No invoices found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredInvoices?.map((invoice) => (
                                    <TableRow key={invoice.id}>
                                        <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                                        <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{invoice.customers?.name}</div>
                                            <div className="text-xs text-muted-foreground">{invoice.customers?.customer_code}</div>
                                        </TableCell>
                                        <TableCell>
                                            {invoice.sales_orders?.order_number || '-'}
                                        </TableCell>
                                        <TableCell>{formatDate(invoice.due_date)}</TableCell>
                                        <TableCell>{getStatusBadge(invoice.status, invoice.due_date)}</TableCell>
                                        <TableCell className="text-right font-medium">
                                            ${invoice.total_amount.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right text-red-600">
                                            ${(invoice.total_amount - invoice.amount_paid).toLocaleString()}
                                        </TableCell>
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
                                                        <Link href={`/dashboard/sales/invoices/${invoice.id}`}>
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            View Details
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => toast.info("Downloading PDF...")}>
                                                        <Download className="mr-2 h-4 w-4" />
                                                        Download PDF
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
