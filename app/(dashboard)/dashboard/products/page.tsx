'use client'

import { useState } from 'react'
import { useProducts, useDeleteProduct } from '@/lib/queries/products'
import { useInventoryStock } from '@/lib/queries/inventory'
import { StockInitializeDialog } from '@/components/inventory/stock-initialize-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Pencil, Trash2, Package } from 'lucide-react'
import Link from 'next/link'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

export default function ProductsPage() {
    const [searchQuery, setSearchQuery] = useState('')
    const { data: products, isLoading } = useProducts()
    const { data: inventoryStock } = useInventoryStock()
    const deleteProduct = useDeleteProduct()

    const [productToDelete, setProductToDelete] = useState<{ id: string, name: string } | null>(null)

    // Add function to get total stock for a product
    const getProductTotalStock = (productId: string) => {
        const productStock = inventoryStock?.filter(s => s.product_id === productId)
        return productStock?.reduce((sum, s) => sum + s.quantity_available, 0) || 0
    }

    // Filter products based on search
    const filteredProducts = products?.filter((product) => {
        const query = searchQuery.toLowerCase()
        return (
            product.name.toLowerCase().includes(query) ||
            product.sku.toLowerCase().includes(query) ||
            product.barcode?.toLowerCase().includes(query)
        )
    })

    const [isDeleting, setIsDeleting] = useState(false)

    const handleDelete = async () => {
        if (!productToDelete) return

        setIsDeleting(true)
        try {
            await deleteProduct.mutateAsync(productToDelete.id)
            toast.success('Product Deleted', {
                description: `${productToDelete.name} has been deleted successfully.`,
            })
            setProductToDelete(null)
        } catch (error: any) {
            toast.error('Error', {
                description: error.message,
            })
        } finally {
            setIsDeleting(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                <p className="text-slate-500 font-medium">Loading products...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">Products</h2>
                    <p className="text-slate-500">Manage your product catalog and pricing.</p>
                </div>
                <Link href="/dashboard/products/new">
                    <Button className="w-full md:w-auto">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Product
                    </Button>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center space-x-2">
                        <Search className="h-5 w-5 text-slate-400" />
                        <Input
                            placeholder="Search by name, SKU, or barcode..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="max-w-sm"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="font-bold">SKU</TableHead>
                                    <TableHead className="font-bold">Name</TableHead>
                                    <TableHead className="font-bold">Category</TableHead>
                                    <TableHead className="font-bold">Cost Price</TableHead>
                                    <TableHead className="font-bold">Selling Price</TableHead>
                                    <TableHead className="font-bold">UOM</TableHead>
                                    <TableHead className="font-bold text-right">Stock</TableHead>
                                    <TableHead className="font-bold">Status</TableHead>
                                    <TableHead className="text-right font-bold">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredProducts?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-12 text-slate-500">
                                            <div className="flex flex-col items-center">
                                                <Package className="h-8 w-8 mb-2 opacity-20" />
                                                <p>No products found</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredProducts?.map((product) => (
                                        <TableRow key={product.id} className="hover:bg-slate-50/50 transition-colors">
                                            <TableCell className="font-medium text-slate-900">{product.sku}</TableCell>
                                            <TableCell className="font-medium">{product.name}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-normal">
                                                    {product.product_categories?.name}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>Rs. {product.cost_price?.toLocaleString()}</TableCell>
                                            <TableCell>Rs. {product.selling_price?.toLocaleString()}</TableCell>
                                            <TableCell>{product.units_of_measure?.code}</TableCell>
                                            <TableCell className="text-right font-bold">
                                                {getProductTotalStock(product.id).toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={product.is_active ? 'default' : 'secondary'}>
                                                    {product.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Link href={`/dashboard/products/${product.id}/edit`}>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                    <StockInitializeDialog
                                                        productId={product.id}
                                                        productName={product.name}
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                        onClick={() => setProductToDelete({ id: product.id, name: product.name })}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <div className="text-sm text-slate-500 px-2">
                Showing <strong>{filteredProducts?.length}</strong> of <strong>{products?.length}</strong> products
            </div>

            <AlertDialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Product?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <span className="font-medium text-slate-900">"{productToDelete?.name}"</span>?
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                handleDelete()
                            }}
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                    Deleting...
                                </>
                            ) : (
                                'Delete Product'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    )
}
