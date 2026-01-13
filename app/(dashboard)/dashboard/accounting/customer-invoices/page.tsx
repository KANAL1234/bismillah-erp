'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCustomerInvoices, useApproveCustomerInvoice } from '@/lib/queries/customer-invoices-accounting'
import { FileText, Plus, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

export default function CustomerInvoicesPage() {
    const { data: invoices, isLoading } = useCustomerInvoices()
    const approveInvoice = useApproveCustomerInvoice()

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            'draft': 'bg-yellow-100 text-yellow-800',
            'approved': 'bg-blue-100 text-blue-800',
            'posted': 'bg-green-100 text-green-800',
            'cancelled': 'bg-red-100 text-red-800'
        }
        return colors[status] || 'bg-gray-100 text-gray-800'
    }

    const getPaymentStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            'unpaid': 'bg-red-100 text-red-800',
            'partial': 'bg-yellow-100 text-yellow-800',
            'paid': 'bg-green-100 text-green-800',
            'overdue': 'bg-red-100 text-red-800'
        }
        return colors[status] || 'bg-gray-100 text-gray-800'
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Customer Invoices</h1>
                    <p className="text-muted-foreground">Manage accounts receivable</p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/accounting/customer-invoices/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Invoice
                    </Link>
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{invoices?.length || 0}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Receivable</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            PKR {invoices?.reduce((sum, inv) => sum + inv.amount_due, 0).toLocaleString() || 0}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Unpaid</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {invoices?.filter(i => i.payment_status === 'unpaid').length || 0}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {invoices?.filter(i => i.payment_status === 'overdue').length || 0}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Customer Invoices</CardTitle>
                    <CardDescription>View and manage customer invoices</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading invoices...</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Invoice #</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Invoice Date</TableHead>
                                    <TableHead>Due Date</TableHead>
                                    <TableHead className="text-right">Total Amount</TableHead>
                                    <TableHead className="text-right">Amount Due</TableHead>
                                    <TableHead>Payment Status</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoices?.map((invoice) => (
                                    <TableRow key={invoice.id}>
                                        <TableCell className="font-mono font-medium">{invoice.invoice_number}</TableCell>
                                        <TableCell>{(invoice as any).customers?.name}</TableCell>
                                        <TableCell>{format(new Date(invoice.invoice_date), 'MMM dd, yyyy')}</TableCell>
                                        <TableCell>{format(new Date(invoice.due_date), 'MMM dd, yyyy')}</TableCell>
                                        <TableCell className="text-right font-mono">
                                            PKR {invoice.total_amount.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            PKR {invoice.amount_due.toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={getPaymentStatusBadge(invoice.payment_status)} variant="outline">
                                                {invoice.payment_status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={getStatusBadge(invoice.status)} variant="outline">
                                                {invoice.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {invoice.status === 'draft' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => approveInvoice.mutate(invoice.id)}
                                                    disabled={approveInvoice.isPending}
                                                >
                                                    <CheckCircle className="mr-1 h-3 w-3" />
                                                    Approve
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
