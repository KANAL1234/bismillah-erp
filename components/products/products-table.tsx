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
import { Pencil, Trash2, MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useDeleteProduct } from '@/lib/queries/products'
import { toast } from 'sonner'
import { useState } from 'react'
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ProductsTable({
    products,
    isLoading,
    locationId,
    allowedLocationIds
}: {
    products: any[],
    isLoading: boolean,
    locationId?: string | null,
    allowedLocationIds?: string[]
}) {
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const deleteProduct = useDeleteProduct()

    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground">Loading products...</div>
    }

    const handleDelete = async () => {
        if (!deletingId) return
        try {
            await deleteProduct.mutateAsync(deletingId)
            toast.success('Product deleted successfully')
        } catch (error: any) {
            toast.error('Failed to delete product', {
                description: error.message
            })
        } finally {
            setDeletingId(null)
        }
    }


    // Helper function to get location-specific stock
    const getLocationStock = (product: any) => {
        // If specific location selected
        if (locationId && locationId !== '') {
            // Find stock for the selected location
            const locationStock = product.inventory_stock?.find(
                (stock: any) => stock.location_id === locationId
            )
            return locationStock?.quantity_on_hand || 0
        }

        // If "All Locations" selected (or no location), filter by allowed locations
        if (allowedLocationIds && allowedLocationIds.length > 0) {
            return product.inventory_stock?.reduce((sum: number, stock: any) => {
                if (allowedLocationIds.includes(stock.location_id)) {
                    return sum + (stock.quantity_on_hand || 0)
                }
                return sum
            }, 0) || 0
        }

        // Fallback to total stock if no filtering possible (e.g. admin or no allowed list passed)
        return product.total_stock || 0
    }



    return (
        <div className="border rounded-md bg-white">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Code/SKU</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">
                            {locationId && locationId !== '' ? 'Location Stock' : 'Total Stock'}
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {products.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                                No products found. Add your first product!
                            </TableCell>
                        </TableRow>
                    ) : (
                        products.map((product) => (
                            <TableRow key={product.id}>
                                <TableCell className="font-medium text-xs">{product.code || product.sku || '-'}</TableCell>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell>{product.product_categories?.name || '-'}</TableCell>
                                <TableCell>{product.units_of_measure?.code || product.uom_id}</TableCell>
                                <TableCell className="text-right">{product.selling_price?.toFixed(2)}</TableCell>
                                <TableCell className="text-right font-bold">{getLocationStock(product)}</TableCell>
                                <TableCell>
                                    <Badge variant={product.is_active ? 'default' : 'secondary'}>
                                        {product.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Link href={`/dashboard/products/${product.id}/edit`}>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                                title="Edit Product"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => setDeletingId(product.id)}
                                            title="Delete Product"
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

            <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the product and its inventory history. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={handleDelete}
                            disabled={deleteProduct.isPending}
                        >
                            {deleteProduct.isPending ? 'Deleting...' : 'Delete Product'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
