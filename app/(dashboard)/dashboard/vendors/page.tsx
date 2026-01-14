'use client'

import { useVendors } from '@/lib/queries/vendors'
import { PermissionGuard } from '@/components/permission-guard'
import { VendorsTable } from '@/components/vendors/vendors-table'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default function VendorsPage() {
    return (
        <PermissionGuard permission="procurement.vendors.read">
            <VendorsContent />
        </PermissionGuard>
    )
}

function VendorsContent() {
    const { data: vendors, isLoading } = useVendors()

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">Vendors</h2>
                    <p className="text-slate-600 mt-1">Manage your supplier relationships</p>
                </div>
                <Link href="/dashboard/vendors/new">
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Vendor
                    </Button>
                </Link>
            </div>

            <VendorsTable vendors={vendors || []} isLoading={isLoading} />
        </div>
    )
}
