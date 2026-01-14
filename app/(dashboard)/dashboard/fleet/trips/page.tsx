'use client'

import { useState, useEffect } from "react"
import { PermissionGuard } from "@/components/permission-guard"
import { createClient } from "@/lib/supabase/client"
import { FleetTrip, FleetFuelLog } from "@/types/fleet"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { TripDialog } from "@/components/fleet/trip-dialog"
import { FuelDialog } from "@/components/fleet/fuel-dialog"
import { format } from "date-fns"

export default function TripsPage() {
    return (
        <PermissionGuard permission="fleet:trips:view">
            <TripsContent />
        </PermissionGuard>
    )
}

function TripsContent() {
    const [trips, setTrips] = useState<FleetTrip[]>([])
    const [fuelLogs, setFuelLogs] = useState<FleetFuelLog[]>([])
    const [loading, setLoading] = useState(true)
    const [isTripAddOpen, setIsTripAddOpen] = useState(false)
    const [isFuelAddOpen, setIsFuelAddOpen] = useState(false)
    const supabase = createClient()

    const fetchTrips = async () => {
        const { data } = await supabase
            .from("fleet_trips")
            .select("*, vehicle:fleet_vehicles(registration_number), driver:fleet_drivers(employee:employees(full_name))")
            .order("start_time", { ascending: false })

        if (data) {
            const mapped = data.map((d: any) => ({
                ...d,
                vehicle: d.vehicle,
                driver: { ...d.driver, employee: d.driver.employee }
            }))
            setTrips(mapped)
        }
    }

    const fetchFuelLogs = async () => {
        const { data } = await supabase
            .from("fleet_fuel_logs")
            .select("*, vehicle:fleet_vehicles(registration_number)")
            .order("log_date", { ascending: false })

        if (data) setFuelLogs(data)
    }

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            await Promise.all([fetchTrips(), fetchFuelLogs()])
            setLoading(false)
        }
        load()
    }, [])

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Trips & Fuel</h1>

            <Tabs defaultValue="trips">
                <TabsList>
                    <TabsTrigger value="trips">Trips</TabsTrigger>
                    <TabsTrigger value="fuel">Fuel Logs</TabsTrigger>
                </TabsList>
                <TabsContent value="trips" className="space-y-4">
                    <div className="flex justify-end">
                        <Button onClick={() => setIsTripAddOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> New Trip
                        </Button>
                    </div>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Vehicle</TableHead>
                                    <TableHead>Driver</TableHead>
                                    <TableHead>Route</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {trips.map((trip) => (
                                    <TableRow key={trip.id}>
                                        <TableCell>
                                            {format(new Date(trip.start_time), "MMM dd, HH:mm")}
                                        </TableCell>
                                        <TableCell>{trip.vehicle?.registration_number}</TableCell>
                                        <TableCell>{trip.driver?.employee?.full_name}</TableCell>
                                        <TableCell>{trip.start_location} → {trip.end_location || '...'}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{trip.status}</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {trips.length === 0 && <TableRow><TableCell colSpan={5} className="text-center">No trips</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
                <TabsContent value="fuel" className="space-y-4">
                    <div className="flex justify-end">
                        <Button onClick={() => setIsFuelAddOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Log Fuel
                        </Button>
                    </div>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Vehicle</TableHead>
                                    <TableHead>Liters</TableHead>
                                    <TableHead>Cost</TableHead>
                                    <TableHead>Odometer</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fuelLogs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell>
                                            {format(new Date(log.log_date), "MMM dd, HH:mm")}
                                        </TableCell>
                                        <TableCell>{log.vehicle?.registration_number}</TableCell>
                                        <TableCell>{log.liters.toFixed(1)} L</TableCell>
                                        <TableCell>${log.total_cost.toFixed(2)}</TableCell>
                                        <TableCell>{log.odometer_reading.toLocaleString()} km</TableCell>
                                    </TableRow>
                                ))}
                                {fuelLogs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center">No fuel logs</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
            </Tabs>

            <TripDialog
                open={isTripAddOpen}
                onOpenChange={setIsTripAddOpen}
                onSuccess={fetchTrips}
            />
            <FuelDialog
                open={isFuelAddOpen}
                onOpenChange={setIsFuelAddOpen}
                onSuccess={fetchFuelLogs}
            />
        </div>
    )
}
