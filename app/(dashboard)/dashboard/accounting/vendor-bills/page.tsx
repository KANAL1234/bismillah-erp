'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useVendorBills, useApproveVendorBill } from '@/lib/queries/vendor-bills'
import { PermissionGuard } from '@/components/permission-guard'
import { FileText, Plus, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

export default function VendorBillsPage() {
    return (
        <PermissionGuard permission="accounting.vendor_bills.read">
            <VendorBillsContent />
        </PermissionGuard>
    )
}

function VendorBillsContent() {
    const { data: bills, isLoading } = useVendorBills()
    const approveBill = useApproveVendorBill()

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
                    <h1 className="text-3xl font-bold">Vendor Bills</h1>
                    <p className="text-muted-foreground">Manage accounts payable</p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/accounting/vendor-bills/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Vendor Bill
                    </Link>
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{bills?.length || 0}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Payable</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            PKR {bills?.reduce((sum, bill) => sum + bill.amount_due, 0).toLocaleString() || 0}
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
                            {bills?.filter(b => b.payment_status === 'unpaid').length || 0}
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
                            {bills?.filter(b => b.payment_status === 'overdue').length || 0}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Vendor Bills</CardTitle>
                    <CardDescription>View and manage vendor bills</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading bills...</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Bill #</TableHead>
                                    <TableHead>Vendor</TableHead>
                                    <TableHead>Bill Date</TableHead>
                                    <TableHead>Due Date</TableHead>
                                    <TableHead className="text-right">Total Amount</TableHead>
                                    <TableHead className="text-right">Amount Due</TableHead>
                                    <TableHead>Payment Status</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {bills?.map((bill) => (
                                    <TableRow key={bill.id}>
                                        <TableCell className="font-mono font-medium">{bill.bill_number}</TableCell>
                                        <TableCell>{(bill as any).vendors?.name}</TableCell>
                                        <TableCell>{format(new Date(bill.bill_date), 'MMM dd, yyyy')}</TableCell>
                                        <TableCell>{format(new Date(bill.due_date), 'MMM dd, yyyy')}</TableCell>
                                        <TableCell className="text-right font-mono">
                                            PKR {bill.total_amount.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            PKR {bill.amount_due.toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={getPaymentStatusBadge(bill.payment_status)} variant="outline">
                                                {bill.payment_status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={getStatusBadge(bill.status)} variant="outline">
                                                {bill.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {bill.status === 'draft' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => approveBill.mutate(bill.id)}
                                                    disabled={approveBill.isPending}
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
