'use client'

import { useState, useEffect } from "react"
import { PermissionGuard } from "@/components/permission-guard"
import { createClient } from "@/lib/supabase/client"
import { FleetMaintenance } from "@/types/fleet"
import { Button } from "@/components/ui/button"
import { Plus, Pencil, Trash } from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { MaintenanceDialog } from "@/components/fleet/maintenance-dialog"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
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

export default function MaintenancePage() {
    return (
        <PermissionGuard permission="fleet:maintenance:view">
            <MaintenanceContent />
        </PermissionGuard>
    )
}

function MaintenanceContent() {
    const [maintenanceRecords, setMaintenanceRecords] = useState<FleetMaintenance[]>([])
    const [loading, setLoading] = useState(true)
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [editingMaintenance, setEditingMaintenance] = useState<FleetMaintenance | undefined>()
    const [deletingMaintenance, setDeletingMaintenance] = useState<FleetMaintenance | null>(null)
    const supabase = createClient()

    const fetchMaintenance = async () => {
        setLoading(true)
        const { data } = await supabase
            .from("fleet_maintenance")
            .select("*, vehicle:fleet_vehicles(registration_number)")
            .order("service_date", { ascending: false })

        if (data) setMaintenanceRecords(data)
        setLoading(false)
    }

    useEffect(() => {
        fetchMaintenance()
    }, [])

    const handleDelete = async () => {
        if (!deletingMaintenance) return

        const { error } = await supabase
            .from("fleet_maintenance")
            .delete()
            .eq("id", deletingMaintenance.id)

        if (error) {
            toast.error("Error deleting maintenance record")
        } else {
            toast.success("Record deleted successfully")
            fetchMaintenance()
        }
        setDeletingMaintenance(null)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Maintenance</h1>
                <Button onClick={() => setIsAddOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Log Maintenance
                </Button>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Vehicle</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Vendor</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-10">Loading...</TableCell>
                            </TableRow>
                        ) : maintenanceRecords.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-10">No records found</TableCell>
                            </TableRow>
                        ) : (
                            maintenanceRecords.map((record) => (
                                <TableRow key={record.id}>
                                    <TableCell>
                                        {format(new Date(record.service_date), "MMM dd, yyyy")}
                                    </TableCell>
                                    <TableCell>{record.vehicle?.registration_number}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{record.service_type}</Badge>
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate" title={record.description || ""}>
                                        {record.description}
                                    </TableCell>
                                    <TableCell>{record.vendor_name}</TableCell>
                                    <TableCell className="text-right font-medium">
                                        ${record.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                                onClick={() => setEditingMaintenance(record)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                                <span className="sr-only">Edit</span>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => setDeletingMaintenance(record)}
                                            >
                                                <Trash className="h-4 w-4" />
                                                <span className="sr-only">Delete</span>
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <MaintenanceDialog
                open={isAddOpen || !!editingMaintenance}
                onOpenChange={(open) => {
                    if (!open) {
                        setIsAddOpen(false)
                        setEditingMaintenance(undefined)
                    }
                }}
                maintenance={editingMaintenance}
                onSuccess={fetchMaintenance}
            />

            <AlertDialog open={!!deletingMaintenance} onOpenChange={(open) => !open && setDeletingMaintenance(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the maintenance record.
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
