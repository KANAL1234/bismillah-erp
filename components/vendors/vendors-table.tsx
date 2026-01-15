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
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function VendorsTable({ vendors, isLoading }: { vendors: any[], isLoading: boolean }) {
    const [deletingVendor, setDeletingVendor] = useState<any>(null)
    const supabase = createClient()
    const router = useRouter()

    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground">Loading vendors...</div>
    }

    const handleDelete = async () => {
        if (!deletingVendor) return

        const { error } = await supabase
            .from('vendors')
            .delete()
            .eq('id', deletingVendor.id)

        if (error) {
            toast.error('Failed to delete vendor')
        } else {
            toast.success('Vendor deleted successfully')
            router.refresh()
        }
        setDeletingVendor(null)
    }

    return (
        <div className="border rounded-md bg-white">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Vendor Name</TableHead>
                        <TableHead>Contact Person</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {vendors.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                No vendors found. Add your first vendor!
                            </TableCell>
                        </TableRow>
                    ) : (
                        vendors.map((vendor) => (
                            <TableRow key={vendor.id}>
                                <TableCell className="font-medium text-xs">{vendor.code || '-'}</TableCell>
                                <TableCell className="font-medium">{vendor.name}</TableCell>
                                <TableCell>{vendor.contact_person || '-'}</TableCell>
                                <TableCell>{vendor.email || '-'}</TableCell>
                                <TableCell>{vendor.phone || '-'}</TableCell>
                                <TableCell>
                                    <Badge variant={vendor.is_active ? 'default' : 'secondary'}>
                                        {vendor.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Link href={`/dashboard/vendors/${vendor.id}`}>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                                title="Edit Vendor"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => setDeletingVendor(vendor)}
                                            title="Delete Vendor"
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

            <AlertDialog open={!!deletingVendor} onOpenChange={(open) => !open && setDeletingVendor(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the vendor <strong>{deletingVendor?.name}</strong> and remove all associated data. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700 font-medium" onClick={handleDelete}>
                            Delete Vendor
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
