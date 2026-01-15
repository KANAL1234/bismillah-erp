'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useReceiptVouchers } from '@/lib/queries/receipt-vouchers'
import { PermissionGuard } from '@/components/permission-guard'
import { DollarSign, Calendar, Users } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default function ReceiptVouchersPage() {
    return (
        <PermissionGuard permission="accounting.receipt_vouchers.read">
            <ReceiptVouchersContent />
        </PermissionGuard>
    )
}

function ReceiptVouchersContent() {
    const { data: vouchers, isLoading } = useReceiptVouchers()

    const totalReceived = vouchers?.reduce((sum, v) => sum + v.amount, 0) || 0

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Receipt Vouchers</h1>
                <p className="text-muted-foreground">Customer receipts and allocations</p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Vouchers</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{vouchers?.length || 0}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Received</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">PKR {totalReceived.toLocaleString()}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">This Month</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {vouchers?.filter(v => {
                                const vDate = new Date(v.receipt_date)
                                const now = new Date()
                                return vDate.getMonth() === now.getMonth() && vDate.getFullYear() === now.getFullYear()
                            }).length || 0}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Vouchers List */}
            <Card>
                <CardHeader>
                    <CardTitle>Receipt History</CardTitle>
                    <CardDescription>All customer receipts with GL posting</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading...</div>
                    ) : vouchers && vouchers.length > 0 ? (
                        <div className="space-y-4">
                            {vouchers.map((voucher: any) => (
                                <div key={voucher.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono font-semibold">{voucher.voucher_number}</span>
                                            <Badge variant="outline" className="bg-green-50 text-green-700">
                                                {voucher.receipt_method}
                                            </Badge>
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                                Posted to GL
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Users className="h-4 w-4" />
                                            <span>{voucher.customers?.name}</span>
                                            <span>•</span>
                                            <Calendar className="h-4 w-4" />
                                            <span>{formatDate(voucher.receipt_date)}</span>
                                        </div>
                                        {voucher.reference_number && (
                                            <p className="text-sm text-muted-foreground">Ref: {voucher.reference_number}</p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-green-600">PKR {voucher.amount.toLocaleString()}</div>
                                        {voucher.bank_accounts && (
                                            <p className="text-sm text-muted-foreground">{voucher.bank_accounts.account_name}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            No receipt vouchers found
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                        <DollarSign className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-blue-900">Automatic GL Posting</h3>
                            <p className="text-sm text-blue-700 mt-1">
                                All receipt vouchers automatically post to the General Ledger.
                                Debit: Bank/Cash | Credit: Accounts Receivable
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
