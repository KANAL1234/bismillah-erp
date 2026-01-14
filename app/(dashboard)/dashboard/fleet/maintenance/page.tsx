'use client'

import { useState, useEffect } from "react"
import { PermissionGuard } from "@/components/permission-guard"
import { createClient } from "@/lib/supabase/client"
import { FleetMaintenance } from "@/types/fleet"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
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
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-10">Loading...</TableCell>
                            </TableRow>
                        ) : maintenanceRecords.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-10">No records found</TableCell>
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
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <MaintenanceDialog
                open={isAddOpen}
                onOpenChange={setIsAddOpen}
                onSuccess={fetchMaintenance}
            />
        </div>
    )
}
