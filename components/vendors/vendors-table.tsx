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
import { Edit } from 'lucide-react'
import Link from 'next/link'

export function VendorsTable({ vendors, isLoading }: { vendors: any[], isLoading: boolean }) {
    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground">Loading vendors...</div>
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
                                    <Link href={`/dashboard/vendors/${vendor.id}`}>
                                        <Button size="sm" variant="ghost"><Edit className="h-4 w-4" /></Button>
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
