'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useChartOfAccounts } from '@/lib/queries/chart-of-accounts'
import { PermissionGuard } from '@/components/permission-guard'
import { Search, Plus, FileDown } from 'lucide-react'
import Link from 'next/link'

export default function ChartOfAccountsPage() {
    return (
        <PermissionGuard permission="accounting.chart_of_accounts.read">
            <ChartOfAccountsContent />
        </PermissionGuard>
    )
}

function ChartOfAccountsContent() {
    const { data: accounts, isLoading } = useChartOfAccounts()
    const [searchTerm, setSearchTerm] = useState('')

    const filteredAccounts = accounts?.filter(account =>
        account.account_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.account_name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const getAccountTypeBadge = (type: string) => {
        const colors: Record<string, string> = {
            'ASSET': 'bg-blue-100 text-blue-800',
            'LIABILITY': 'bg-red-100 text-red-800',
            'EQUITY': 'bg-purple-100 text-purple-800',
            'REVENUE': 'bg-green-100 text-green-800',
            'EXPENSE': 'bg-orange-100 text-orange-800',
            'COGS': 'bg-yellow-100 text-yellow-800'
        }
        return colors[type] || 'bg-gray-100 text-gray-800'
    }

    const groupedAccounts = filteredAccounts?.reduce((acc, account) => {
        const type = account.account_type || 'Other';
        if (!acc[type]) {
            acc[type] = []
        }
        acc[type]?.push(account)
        return acc
    }, {} as Record<string, typeof accounts>)

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Chart of Accounts</h1>
                    <p className="text-muted-foreground">Manage your general ledger accounts</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">
                        <FileDown className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                    <Button asChild>
                        <Link href="/dashboard/accounting/chart-of-accounts/new">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Account
                        </Link>
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Accounts</CardTitle>
                    <CardDescription>70+ Pakistan standard accounts</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by code or name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading accounts...</div>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(groupedAccounts || {}).map(([type, typeAccounts]) => (
                                <div key={type}>
                                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                        <Badge className={getAccountTypeBadge(type)}>{type}</Badge>
                                        <span className="text-sm text-muted-foreground">({typeAccounts?.length || 0} accounts)</span>
                                    </h3>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Code</TableHead>
                                                <TableHead>Account Name</TableHead>
                                                <TableHead className="text-right">Opening Balance</TableHead>
                                                <TableHead className="text-right">Current Balance</TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(typeAccounts || []).map((account) => (
                                                <TableRow key={account.id}>
                                                    <TableCell className="font-mono font-medium">{account.account_code}</TableCell>
                                                    <TableCell>{account.account_name}</TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        PKR {account.opening_balance.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        PKR {account.current_balance.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell>
                                                        {account.is_active ? (
                                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                                Active
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                                                                Inactive
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
