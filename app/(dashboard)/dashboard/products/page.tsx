'use client'

import { useProducts } from '@/lib/queries/products'
import { PermissionGuard } from '@/components/permission-guard'
import { ProductsTable } from '@/components/products/products-table'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default function ProductsPage() {
    return (
        <PermissionGuard permission="inventory.products.read">
            <ProductsContent />
        </PermissionGuard>
    )
}

function ProductsContent() {
    const { data: products, isLoading } = useProducts()

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">Products</h2>
                    <p className="text-slate-600 mt-1">Manage your product catalog</p>
                </div>
                <Link href="/dashboard/products/new">
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Product
                    </Button>
                </Link>
            </div>

            <ProductsTable products={products || []} isLoading={isLoading} />
        </div>
    )
}
