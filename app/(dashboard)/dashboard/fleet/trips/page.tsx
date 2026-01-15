'use client'

import { useState, useEffect } from "react"
import { PermissionGuard } from "@/components/permission-guard"
import { createClient } from "@/lib/supabase/client"
import { FleetTrip, FleetFuelLog } from "@/types/fleet"
import { Button } from "@/components/ui/button"
import { Plus, MoreHorizontal, Pencil, Trash, DollarSign, Fuel } from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { TripDialog } from "@/components/fleet/trip-dialog"
import { FuelDialog } from "@/components/fleet/fuel-dialog"
import { CashDepositDialog } from "@/components/fleet/cash-deposit-dialog"
import { FuelAllowanceDialog } from "@/components/fleet/fuel-allowance-dialog"
import { format } from "date-fns"
import { toast } from "sonner"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

export default function TripsPage() {
    return (
        <PermissionGuard permission="fleet:trips:view">
            <TripsContent />
        </PermissionGuard>
    )
}

function TripsContent() {
    const [trips, setTrips] = useState<FleetTrip[]>([])
    const [dateFilter, setDateFilter] = useState<string>("")
    const [fuelLogs, setFuelLogs] = useState<FleetFuelLog[]>([])
    const [loading, setLoading] = useState(true)
    const [isTripAddOpen, setIsTripAddOpen] = useState(false)
    const [isFuelAddOpen, setIsFuelAddOpen] = useState(false)
    const [editingTrip, setEditingTrip] = useState<FleetTrip | undefined>()
    const [deletingTrip, setDeletingTrip] = useState<FleetTrip | null>(null)
    const [cashDepositTrip, setCashDepositTrip] = useState<FleetTrip | null>(null)
    const [fuelAllowanceTrip, setFuelAllowanceTrip] = useState<FleetTrip | null>(null)
    const supabase = createClient()

    const fetchTrips = async () => {
        let query = supabase
            .from("fleet_trips")
            .select(`
                *, 
                vehicle:fleet_vehicles(registration_number, make, model), 
                driver:fleet_drivers(*, employee:employees(full_name, employee_code))
            `)
            .order("start_time", { ascending: false })

        if (dateFilter) {
            query = query
                .gte('start_time', `${dateFilter}T00:00:00`)
                .lte('start_time', `${dateFilter}T23:59:59`)
        }

        const { data, error } = await query

        if (error) {
            toast.error("Error fetching trips")
        } else if (data) {
            setTrips(data as any)
        }
    }

    const fetchFuelLogs = async () => {
        const { data, error } = await supabase
            .from("fleet_fuel_logs")
            .select("*, vehicle:fleet_vehicles(registration_number)")
            .order("log_date", { ascending: false })

        if (error) {
            toast.error("Error fetching fuel logs")
        } else if (data) {
            setFuelLogs(data)
        }
    }

    const handleDeleteTrip = async () => {
        if (!deletingTrip) return

        const { error } = await supabase
            .from("fleet_trips")
            .delete()
            .eq("id", deletingTrip.id)

        if (error) {
            toast.error("Error deleting trip")
        } else {
            toast.success("Trip deleted successfully")
            fetchTrips()
        }
        setDeletingTrip(null)
    }

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            await Promise.all([fetchTrips(), fetchFuelLogs()])
            setLoading(false)
        }
        load()
    }, [dateFilter])

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Trips & Fuel</h1>

            <Tabs defaultValue="trips">
                <TabsList>
                    <TabsTrigger value="trips">Trips</TabsTrigger>
                    <TabsTrigger value="fuel">Fuel Logs</TabsTrigger>
                </TabsList>
                <TabsContent value="trips" className="space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Filter Date:</span>
                            <Input
                                type="date"
                                className="w-[180px]"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                            />
                            {dateFilter && (
                                <Button variant="ghost" size="sm" onClick={() => setDateFilter("")}>
                                    Clear
                                </Button>
                            )}
                        </div>
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
                                    <TableHead>Route / Purpose</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={6} className="text-center">Loading trips...</TableCell></TableRow>
                                ) : trips.map((trip) => (
                                    <TableRow key={trip.id}>
                                        <TableCell>
                                            {format(new Date(trip.start_time), "MMM dd, HH:mm")}
                                        </TableCell>
                                        <TableCell>{trip.vehicle?.registration_number}</TableCell>
                                        <TableCell>{trip.driver?.employee?.full_name || 'N/A'}</TableCell>
                                        <TableCell>{trip.start_location} → {trip.end_location || '...'}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{trip.status}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                {trip.status === 'COMPLETED' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                        onClick={() => setCashDepositTrip(trip)}
                                                        title="Record Cash Deposit"
                                                    >
                                                        <DollarSign className="h-4 w-4" />
                                                        <span className="sr-only">Cash Deposit</span>
                                                    </Button>
                                                )}
                                                {trip.status === 'IN_PROGRESS' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                        onClick={() => setFuelAllowanceTrip(trip)}
                                                        title="Set Fuel Allowance"
                                                    >
                                                        <Fuel className="h-4 w-4" />
                                                        <span className="sr-only">Fuel Allowance</span>
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                                    onClick={() => setEditingTrip(trip)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                    <span className="sr-only">Edit</span>
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => setDeletingTrip(trip)}
                                                >
                                                    <Trash className="h-4 w-4" />
                                                    <span className="sr-only">Delete</span>
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {!loading && trips.length === 0 && (
                                    <TableRow><TableCell colSpan={6} className="text-center">No trips found</TableCell></TableRow>
                                )}
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
                                {loading ? (
                                    <TableRow><TableCell colSpan={5} className="text-center">Loading fuel logs...</TableCell></TableRow>
                                ) : fuelLogs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell>
                                            {format(new Date(log.log_date), "MMM dd, HH:mm")}
                                        </TableCell>
                                        <TableCell>{log.vehicle?.registration_number}</TableCell>
                                        <TableCell>{log.liters} L</TableCell>
                                        <TableCell>${log.total_cost?.toFixed(2)}</TableCell>
                                        <TableCell>{log.odometer_reading?.toLocaleString()} km</TableCell>
                                    </TableRow>
                                ))}
                                {!loading && fuelLogs.length === 0 && (
                                    <TableRow><TableCell colSpan={5} className="text-center">No fuel logs found</TableCell></TableRow>
                                )}
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

            <TripDialog
                trip={editingTrip}
                open={!!editingTrip}
                onOpenChange={(open) => !open && setEditingTrip(undefined)}
                onSuccess={fetchTrips}
            />

            <FuelDialog
                open={isFuelAddOpen}
                onOpenChange={setIsFuelAddOpen}
                onSuccess={fetchFuelLogs}
            />

            <CashDepositDialog
                open={!!cashDepositTrip}
                onOpenChange={(open) => !open && setCashDepositTrip(null)}
                tripId={cashDepositTrip?.id}
                driverId={cashDepositTrip?.driver_id}
                vehicleId={cashDepositTrip?.vehicle_id}
            />

            <FuelAllowanceDialog
                open={!!fuelAllowanceTrip}
                onOpenChange={(open) => !open && setFuelAllowanceTrip(null)}
                tripId={fuelAllowanceTrip?.id}
                driverId={fuelAllowanceTrip?.driver_id}
                vehicleId={fuelAllowanceTrip?.vehicle_id}
            />

            <AlertDialog open={!!deletingTrip} onOpenChange={(open) => !open && setDeletingTrip(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the trip record.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600" onClick={handleDeleteTrip}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
