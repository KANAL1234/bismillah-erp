'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useVendorBills, useApproveVendorBill, useDeleteVendorBill, useCancelVendorBill } from '@/lib/queries/vendor-bills'
import { useCreatePaymentVoucher } from '@/lib/queries/payment-vouchers'
import { useBankAccounts } from '@/lib/queries/bank-accounts'
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
    Package,
    ClipboardList,
    AlertTriangle,
    Banknote
} from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { VendorBill } from '@/lib/types/database'

export default function VendorBillsPage() {
    return (
        <PermissionGuard permission="accounting.vendor_bills.read">
            <VendorBillsContent />
        </PermissionGuard>
    )
}

function VendorBillsContent() {
    const { data: bills, isLoading } = useVendorBills()
    const { data: bankAccounts } = useBankAccounts()
    const approveBill = useApproveVendorBill()
    const deleteBill = useDeleteVendorBill()
    const cancelBill = useCancelVendorBill()
    const createPayment = useCreatePaymentVoucher()

    // Payment dialog state
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
    const [selectedBill, setSelectedBill] = useState<(VendorBill & { vendors?: { name: string } }) | null>(null)
    const [paymentForm, setPaymentForm] = useState({
        paymentMethod: 'BANK_TRANSFER' as 'CASH' | 'BANK_TRANSFER' | 'CHEQUE',
        bankAccountId: '',
        amount: 0,
        referenceNumber: '',
        paymentDate: new Date().toISOString().split('T')[0]
    })

    const openPaymentDialog = (bill: any) => {
        setSelectedBill(bill)
        setPaymentForm({
            paymentMethod: 'BANK_TRANSFER',
            bankAccountId: bankAccounts?.[0]?.id || '',
            amount: bill.amount_due,
            referenceNumber: '',
            paymentDate: new Date().toISOString().split('T')[0]
        })
        setPaymentDialogOpen(true)
    }

    const handleCreatePayment = async () => {
        if (!selectedBill) return

        await createPayment.mutateAsync({
            vendorId: selectedBill.vendor_id,
            bankAccountId: paymentForm.paymentMethod !== 'CASH' ? paymentForm.bankAccountId : undefined,
            paymentDate: paymentForm.paymentDate,
            paymentMethod: paymentForm.paymentMethod,
            amount: paymentForm.amount,
            referenceNumber: paymentForm.referenceNumber || undefined,
            billAllocations: [{
                bill_id: selectedBill.id,
                amount_allocated: paymentForm.amount
            }]
        })

        setPaymentDialogOpen(false)
        setSelectedBill(null)
    }

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
                                                    <Button
                                                        size="sm"
                                                        className="bg-green-600 hover:bg-green-700"
                                                        onClick={() => approveBill.mutate(bill.id)}
                                                        disabled={approveBill.isPending}
                                                    >
                                                        <CheckCircle className="mr-1 h-3 w-3" />
                                                        Approve & Post
                                                    </Button>
                                                )}

                                                {(bill.status === 'approved' || bill.status === 'posted' || bill.status === 'goods_received') && (
                                                    <>
                                                        {(bill.payment_status === 'unpaid' || bill.payment_status === 'partial') && (
                                                            <Button
                                                                size="sm"
                                                                variant={bill.payment_status === 'overdue' ? 'destructive' : 'default'}
                                                                onClick={() => openPaymentDialog(bill)}
                                                            >
                                                                <CreditCard className="mr-1 h-3 w-3" />
                                                                Make Payment
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
                                                        onClick={() => openPaymentDialog(bill)}
                                                    >
                                                        <AlertTriangle className="mr-1 h-3 w-3" />
                                                        Pay Now
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
                                                                <DropdownMenuItem onClick={() => openPaymentDialog(bill)}>
                                                                    <CreditCard className="mr-2 h-4 w-4" />
                                                                    Record Payment
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

            {/* Make Payment Dialog */}
            <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Banknote className="h-5 w-5" />
                            Make Payment
                        </DialogTitle>
                        <DialogDescription>
                            Create a payment voucher for {selectedBill?.bill_number}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedBill && (
                        <div className="space-y-4">
                            {/* Bill Info */}
                            <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-sm text-slate-600">Vendor</span>
                                    <span className="font-medium">{(selectedBill as any).vendors?.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-slate-600">Bill Total</span>
                                    <span className="font-mono">PKR {selectedBill.total_amount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-slate-600">Amount Due</span>
                                    <span className="font-mono font-bold text-red-600">PKR {selectedBill.amount_due.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Payment Form */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="paymentDate">Payment Date</Label>
                                        <Input
                                            id="paymentDate"
                                            type="date"
                                            value={paymentForm.paymentDate}
                                            onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="paymentMethod">Payment Method</Label>
                                        <Select
                                            value={paymentForm.paymentMethod}
                                            onValueChange={(value: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE') =>
                                                setPaymentForm({ ...paymentForm, paymentMethod: value })
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="CASH">Cash</SelectItem>
                                                <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                                                <SelectItem value="CHEQUE">Cheque</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {paymentForm.paymentMethod !== 'CASH' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="bankAccount">Bank Account</Label>
                                        <Select
                                            value={paymentForm.bankAccountId}
                                            onValueChange={(value) => setPaymentForm({ ...paymentForm, bankAccountId: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select bank account" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {bankAccounts?.map((account: any) => (
                                                    <SelectItem key={account.id} value={account.id}>
                                                        {account.account_name} - {account.account_number}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="amount">Amount (PKR)</Label>
                                    <Input
                                        id="amount"
                                        type="number"
                                        value={paymentForm.amount}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                                        max={selectedBill.amount_due}
                                    />
                                    <p className="text-xs text-slate-500">
                                        Max: PKR {selectedBill.amount_due.toLocaleString()}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="referenceNumber">Reference Number (Optional)</Label>
                                    <Input
                                        id="referenceNumber"
                                        placeholder="Cheque #, Transaction ID, etc."
                                        value={paymentForm.referenceNumber}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreatePayment}
                            disabled={createPayment.isPending || !paymentForm.amount}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {createPayment.isPending ? 'Processing...' : 'Create Payment Voucher'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
