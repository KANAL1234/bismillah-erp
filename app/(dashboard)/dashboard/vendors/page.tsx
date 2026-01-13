'use client'

import { useState } from 'react'
import { useVendors, useDeleteVendor } from '@/lib/queries/vendors'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { Plus, Search, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default function VendorsPage() {
    const [searchQuery, setSearchQuery] = useState('')
    const { data: vendors, isLoading } = useVendors()
    const deleteVendor = useDeleteVendor()

    // Filter vendors
    const filteredVendors = vendors?.filter((vendor) => {
        const query = searchQuery.toLowerCase()
        return (
            vendor.name.toLowerCase().includes(query) ||
            vendor.vendor_code.toLowerCase().includes(query) ||
            vendor.phone.toLowerCase().includes(query)
        )
    })

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete vendor "${name}"?`)) return

        try {
            await deleteVendor.mutateAsync(id)
            toast.success('Vendor Deleted', {
                description: `${name} has been deleted successfully.`,
            })
        } catch (error: any) {
            toast.error('Error', {
                description: error.message,
            })
        }
    }

    if (isLoading) {
        return <div className="flex items-center justify-center h-64">Loading...</div>
    }

    return (
        <div className="px-4 sm:px-0">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-900">Vendors</h2>
                <Link href="/dashboard/vendors/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Vendor
                    </Button>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center space-x-2">
                        <Search className="h-5 w-5 text-gray-400" />
                        <Input
                            placeholder="Search by name, code, or phone..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="max-w-sm"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Code</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                                <TableHead className="text-right">Payment Terms</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredVendors?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center text-gray-500">
                                        No vendors found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredVendors?.map((vendor) => (
                                    <TableRow key={vendor.id}>
                                        <TableCell className="font-medium">{vendor.vendor_code}</TableCell>
                                        <TableCell>{vendor.name}</TableCell>
                                        <TableCell className="text-sm text-gray-600">
                                            {vendor.contact_person || '-'}
                                        </TableCell>
                                        <TableCell>{vendor.phone}</TableCell>
                                        <TableCell>
                                            {vendor.vendor_category ? (
                                                <Badge variant="outline">{vendor.vendor_category}</Badge>
                                            ) : (
                                                '-'
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={vendor.current_balance > 0 ? 'text-red-600 font-semibold' : ''}>
                                                Rs. {vendor.current_balance.toLocaleString()}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {vendor.payment_terms_days} days
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Link href={`/dashboard/vendors/${vendor.id}/edit`}>
                                                    <Button variant="ghost" size="sm">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDelete(vendor.id, vendor.name)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <div className="mt-4 text-sm text-gray-600">
                Showing {filteredVendors?.length} of {vendors?.length} vendors
            </div>
        </div>
    )
}
