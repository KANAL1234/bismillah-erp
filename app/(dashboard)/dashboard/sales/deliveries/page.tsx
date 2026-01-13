'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Truck, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDeliveryNotes } from '@/lib/queries/delivery-notes'
import { format } from 'date-fns'
import { DeliveryNote } from '@/lib/types/database'

export default function DeliveryNotesPage() {
    const { data: notes, isLoading } = useDeliveryNotes()
    const [searchTerm, setSearchTerm] = useState('')

    const filteredNotes = notes?.filter(note =>
        note.delivery_note_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.customers?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.sales_orders?.order_number?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const getStatusBadge = (status: DeliveryNote['status']) => {
        switch (status) {
            case 'draft': return <Badge variant="secondary">Draft</Badge>
            case 'shipped': return <Badge className="bg-blue-600 hover:bg-blue-700">Shipped</Badge>
            case 'delivered': return <Badge className="bg-green-600 hover:bg-green-700">Delivered</Badge>
            case 'cancelled': return <Badge variant="destructive">Cancelled</Badge>
            default: return <Badge variant="outline">{status}</Badge>
        }
    }

    if (isLoading) {
        return <div className="p-8 text-center">Loading delivery notes...</div>
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Delivery Notes</h1>
                    <p className="text-muted-foreground">Track shipments and deliveries.</p>
                </div>
                {/* 
                  Usually Delivery Notes are created from Sales Orders, 
                  but we can allow manual creation if needed.
                  For now we'll assume manual is secondary or handle it via New Page logic 
                  that asks for an order first.
                */}
                <Link href="/dashboard/sales/deliveries/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Delivery Note
                    </Button>
                </Link>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle className="text-base font-medium">
                        Recent Deliveries
                    </CardTitle>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search deliveries..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 w-[250px]"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>DN Number</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Order #</TableHead>
                                <TableHead>Driver/Vehicle</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredNotes?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                        No delivery notes found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredNotes?.map((note) => (
                                    <TableRow key={note.id}>
                                        <TableCell className="font-medium">{note.delivery_note_number}</TableCell>
                                        <TableCell>{format(new Date(note.delivery_date), 'MMM dd, yyyy')}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{note.customers?.name}</div>
                                            <div className="text-xs text-muted-foreground">{note.customers?.customer_code}</div>
                                        </TableCell>
                                        <TableCell>{note.sales_orders?.order_number}</TableCell>
                                        <TableCell>
                                            <div className="text-sm">{note.driver_name || '-'}</div>
                                            <div className="text-xs text-muted-foreground">{note.vehicle_number}</div>
                                        </TableCell>
                                        <TableCell>{getStatusBadge(note.status)}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/dashboard/sales/deliveries/${note.id}`}>
                                                            <Truck className="mr-2 h-4 w-4" />
                                                            View Details
                                                        </Link>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
