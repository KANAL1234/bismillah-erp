'use client'

import { useState, useEffect } from "react"
import { PermissionGuard } from "@/components/permission-guard"
import { createClient } from "@/lib/supabase/client"
import { FleetDriver } from "@/types/fleet"
import { Button } from "@/components/ui/button"
import { Plus, Search, MoreHorizontal, Pencil, Trash } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { DriverDialog } from "@/components/fleet/driver-dialog"
import { toast } from "sonner"
import { format } from "date-fns"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function DriversPage() {
    return (
        <PermissionGuard permission="fleet:drivers:view">
            <DriversContent />
        </PermissionGuard>
    )
}

function DriversContent() {
    const [drivers, setDrivers] = useState<FleetDriver[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [editingDriver, setEditingDriver] = useState<FleetDriver | undefined>()
    const [deletingDriver, setDeletingDriver] = useState<FleetDriver | null>(null)
    const supabase = createClient()

    const fetchDrivers = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from("fleet_drivers")
            .select(`
                *,
                employee:employees(full_name, employee_code)
            `)
            .order("created_at", { ascending: false })

        if (error) {
            toast.error("Error fetching drivers")
        } else {
            // Map the joined data correctly to our type
            const mappedDrivers = (data || []).map((d: any) => ({
                ...d,
                employee: d.employee // Expecting simple join
            }))
            setDrivers(mappedDrivers)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchDrivers()
    }, [])

    const handleDelete = async () => {
        if (!deletingDriver) return

        const { error } = await supabase
            .from("fleet_drivers")
            .delete()
            .eq("id", deletingDriver.id)

        if (error) {
            toast.error("Error deleting driver")
        } else {
            toast.success("Driver deleted successfully")
            fetchDrivers()
        }
        setDeletingDriver(null)
    }

    const filteredDrivers = drivers.filter(d =>
        d.employee?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        d.license_number.toLowerCase().includes(search.toLowerCase())
    )

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'bg-green-100 text-green-800'
            case 'SUSPENDED': return 'bg-red-100 text-red-800'
            case 'ON_LEAVE': return 'bg-yellow-100 text-yellow-800'
            default: return 'bg-slate-100 text-slate-800'
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Drivers</h1>
                <Button onClick={() => setIsAddOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Add Driver
                </Button>
            </div>

            <div className="flex items-center space-x-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search drivers..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Driver Name</TableHead>
                            <TableHead>License Number</TableHead>
                            <TableHead>License Expiry</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10">Loading...</TableCell>
                            </TableRow>
                        ) : filteredDrivers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10">No drivers found</TableCell>
                            </TableRow>
                        ) : (
                            filteredDrivers.map((driver) => (
                                <TableRow key={driver.id}>
                                    <TableCell className="font-medium">
                                        <div>{driver.employee?.full_name || 'Unknown'}</div>
                                        <div className="text-xs text-muted-foreground">{driver.employee?.employee_code}</div>
                                    </TableCell>
                                    <TableCell>{driver.license_number}</TableCell>
                                    <TableCell>{format(new Date(driver.license_expiry), "MMM dd, yyyy")}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={getStatusColor(driver.status)}>
                                            {driver.status}
                                        </Badge>
                                    </TableCell>
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
                                                <DropdownMenuItem onClick={() => setEditingDriver(driver)}>
                                                    <Pencil className="mr-2 h-4 w-4" /> Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-600" onClick={() => setDeletingDriver(driver)}>
                                                    <Trash className="mr-2 h-4 w-4" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <DriverDialog
                open={isAddOpen}
                onOpenChange={setIsAddOpen}
                onSuccess={fetchDrivers}
            />

            <DriverDialog
                driver={editingDriver}
                open={!!editingDriver}
                onOpenChange={(open) => !open && setEditingDriver(undefined)}
                onSuccess={fetchDrivers}
            />

            <AlertDialog open={!!deletingDriver} onOpenChange={(open) => !open && setDeletingDriver(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the driver record.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600" onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
