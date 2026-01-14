'use client'

import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CustomersTable } from '@/components/customers/customers-table'
import { CustomerDialog } from '@/components/customers/customer-dialog'
import { useCustomers } from '@/lib/queries/customers'
import { PermissionGuard } from '@/components/permission-guard'

export default function CustomersPage() {
    return (
        <PermissionGuard permission="sales.customers.read">
            <CustomersContent />
        </PermissionGuard>
    )
}

function CustomersContent() {
    const [searchQuery, setSearchQuery] = useState('')
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const { data: customers = [], isLoading } = useCustomers()

    const filteredCustomers = customers.filter(customer =>
        customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.customer_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.phone.includes(searchQuery)
    )

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Customers</h1>
                    <p className="text-slate-500">Manage your customer database and credit limits.</p>
                </div>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Customer
                </Button>
            </div>

            <div className="flex items-center gap-2 max-w-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                        placeholder="Search customers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            <CustomersTable
                customers={filteredCustomers}
                isLoading={isLoading}
            />

            <CustomerDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
            />
        </div>
    )
}
