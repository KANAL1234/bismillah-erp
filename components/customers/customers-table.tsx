'use client'

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit, Eye } from 'lucide-react'
import Link from 'next/link'
import type { Customer } from '@/lib/types/database'

interface CustomersTableProps {
    customers: Customer[]
    isLoading: boolean
}

export function CustomersTable({ customers, isLoading }: CustomersTableProps) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8 text-slate-500">
                Loading customers...
            </div>
        )
    }

    if (customers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <p className="text-lg font-medium text-slate-900">No customers found</p>
                <p className="text-sm text-slate-500">Add your first customer to get started.</p>
            </div>
        )
    }

    return (
        <div className="rounded-md border bg-white overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50">
                        <TableHead className="w-[120px]">Code</TableHead>
                        <TableHead>Customer Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-right">Credit Limit</TableHead>
                        <TableHead className="w-[80px]">Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {customers.map((customer) => (
                        <TableRow key={customer.id}>
                            <TableCell className="font-mono text-xs text-slate-500">
                                {customer.customer_code}
                            </TableCell>
                            <TableCell className="font-medium text-slate-900">
                                {customer.name}
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className="text-[10px] uppercase">
                                    {customer.customer_type}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-slate-600">
                                {customer.phone}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                                PKR {customer.current_balance?.toLocaleString() || '0'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-500">
                                PKR {customer.credit_limit?.toLocaleString() || '0'}
                            </TableCell>
                            <TableCell>
                                <Badge variant={customer.is_active ? "default" : "secondary"}>
                                    {customer.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="icon" asChild>
                                        <Link href={`/dashboard/sales/customers/${customer.id}`}>
                                            <Eye className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
