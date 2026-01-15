'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useVendorBills, useApproveVendorBill, useDeleteVendorBill, useCancelVendorBill } from '@/lib/queries/vendor-bills'
import { PermissionGuard } from '@/components/permission-guard'
import {
    FileText,
    Plus,
    CheckCircle,
    MoreHorizontal,
    Pencil,
    Trash2,
    CreditCard,
    BookOpen,
    XCircle,
    Eye,
    History,
    Receipt,
    Package,
    ClipboardList,
    AlertTriangle
} from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

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
    const deleteBill = useDeleteVendorBill()
    const cancelBill = useCancelVendorBill()

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            'draft': 'bg-yellow-100 text-yellow-800',
            'approved': 'bg-blue-100 text-blue-800',
            'posted': 'bg-blue-100 text-blue-800',
            'goods_received': 'bg-green-100 text-green-800',
            'cancelled': 'bg-red-100 text-red-800'
        }
        return colors[status] || 'bg-gray-100 text-gray-800'
    }

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            'draft': 'Draft',
            'approved': 'Approved',
            'posted': 'Posted',
            'goods_received': 'Goods Received',
            'cancelled': 'Cancelled'
        }
        return labels[status] || status
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
                                        <TableCell>{formatDate(bill.bill_date)}</TableCell>
                                        <TableCell>{formatDate(bill.due_date)}</TableCell>
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
                                                {getStatusLabel(bill.status)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                {/* Status-based primary actions */}
                                                {bill.status === 'draft' && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            className="bg-green-600 hover:bg-green-700"
                                                            onClick={() => approveBill.mutate(bill.id)}
                                                            disabled={approveBill.isPending}
                                                        >
                                                            <CheckCircle className="mr-1 h-3 w-3" />
                                                            Approve & Post
                                                        </Button>
                                                    </>
                                                )}

                                                {(bill.status === 'approved' || bill.status === 'posted' || bill.status === 'goods_received') && (
                                                    <>
                                                        {(bill.payment_status === 'unpaid' || bill.payment_status === 'partial') && (
                                                            <Button
                                                                size="sm"
                                                                variant={bill.payment_status === 'overdue' ? 'destructive' : 'default'}
                                                                asChild
                                                            >
                                                                <Link href={`/dashboard/accounting/payment-vouchers?vendor_bill_id=${bill.id}`}>
                                                                    <CreditCard className="mr-1 h-3 w-3" />
                                                                    Make Payment
                                                                </Link>
                                                            </Button>
                                                        )}
                                                        {bill.payment_status === 'paid' && (
                                                            <Badge className="bg-green-100 text-green-800">
                                                                <CheckCircle className="mr-1 h-3 w-3" />
                                                                Fully Paid
                                                            </Badge>
                                                        )}
                                                    </>
                                                )}

                                                {bill.payment_status === 'overdue' && bill.status !== 'draft' && (
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        asChild
                                                    >
                                                        <Link href={`/dashboard/accounting/payment-vouchers?vendor_bill_id=${bill.id}`}>
                                                            <AlertTriangle className="mr-1 h-3 w-3" />
                                                            Pay Now
                                                        </Link>
                                                    </Button>
                                                )}

                                                {/* Dropdown menu for more actions */}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {/* View Details - Always available */}
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/dashboard/accounting/vendor-bills/${bill.id}`}>
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                View Details
                                                            </Link>
                                                        </DropdownMenuItem>

                                                        {/* Draft status actions */}
                                                        {bill.status === 'draft' && (
                                                            <>
                                                                <DropdownMenuItem asChild>
                                                                    <Link href={`/dashboard/accounting/vendor-bills/${bill.id}/edit`}>
                                                                        <Pencil className="mr-2 h-4 w-4" />
                                                                        Edit
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                                            Delete
                                                                        </DropdownMenuItem>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogTitle>Delete Vendor Bill?</AlertDialogTitle>
                                                                            <AlertDialogDescription>
                                                                                Are you sure you want to delete bill <strong>{bill.bill_number}</strong>?
                                                                                This action cannot be undone.
                                                                            </AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                            <AlertDialogAction
                                                                                onClick={() => deleteBill.mutate(bill.id)}
                                                                                className="bg-red-600 hover:bg-red-700"
                                                                            >
                                                                                Delete
                                                                            </AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            </>
                                                        )}

                                                        {/* Posted/Approved status actions */}
                                                        {(bill.status === 'approved' || bill.status === 'posted' || bill.status === 'goods_received') && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem asChild>
                                                                    <Link href={`/dashboard/accounting/payment-vouchers?vendor_bill_id=${bill.id}`}>
                                                                        <CreditCard className="mr-2 h-4 w-4" />
                                                                        Record Payment
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                                {(bill as any).journal_entry_id && (
                                                                    <DropdownMenuItem asChild>
                                                                        <Link href={`/dashboard/accounting/journal-entries/${(bill as any).journal_entry_id}`}>
                                                                            <BookOpen className="mr-2 h-4 w-4" />
                                                                            View Journal Entry
                                                                        </Link>
                                                                    </DropdownMenuItem>
                                                                )}
                                                                <DropdownMenuSeparator />
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                                                                            <XCircle className="mr-2 h-4 w-4" />
                                                                            Cancel Bill
                                                                        </DropdownMenuItem>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogTitle>Cancel Vendor Bill?</AlertDialogTitle>
                                                                            <AlertDialogDescription>
                                                                                This will cancel bill <strong>{bill.bill_number}</strong> and create
                                                                                a reversing journal entry. This action cannot be undone.
                                                                            </AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>Keep Bill</AlertDialogCancel>
                                                                            <AlertDialogAction
                                                                                onClick={() => cancelBill.mutate(bill.id)}
                                                                                className="bg-red-600 hover:bg-red-700"
                                                                            >
                                                                                Cancel Bill
                                                                            </AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            </>
                                                        )}

                                                        {/* Payment history - when has payments */}
                                                        {(bill.payment_status === 'partial' || bill.payment_status === 'paid') && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem asChild>
                                                                    <Link href={`/dashboard/accounting/payment-vouchers?vendor_bill_id=${bill.id}&view=history`}>
                                                                        <History className="mr-2 h-4 w-4" />
                                                                        Payment History
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}

                                                        {/* Linked documents */}
                                                        {(bill as any).grn_id && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem asChild>
                                                                    <Link href={`/dashboard/purchases/grn/${(bill as any).grn_id}`}>
                                                                        <Package className="mr-2 h-4 w-4" />
                                                                        View GRN
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}

                                                        {(bill as any).purchase_order_id && (
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/dashboard/purchases/orders/${(bill as any).purchase_order_id}`}>
                                                                    <ClipboardList className="mr-2 h-4 w-4" />
                                                                    View Purchase Order
                                                                </Link>
                                                            </DropdownMenuItem>
                                                        )}

                                                        {/* Cancelled status - view only */}
                                                        {bill.status === 'cancelled' && (
                                                            <DropdownMenuItem disabled className="text-slate-400">
                                                                <XCircle className="mr-2 h-4 w-4" />
                                                                Bill Cancelled
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
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
