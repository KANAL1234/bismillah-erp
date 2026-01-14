'use client'

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { FleetTrip, FleetTripVisit, TripGPSPoint } from "@/types/fleet"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MapPin, ShoppingBag, Users, Navigation, PlayCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface TripTrackingViewProps {
    tripId: string
}

export function TripTrackingView({ tripId }: TripTrackingViewProps) {
    const [trip, setTrip] = useState<FleetTrip | null>(null)
    const [visits, setVisits] = useState<FleetTripVisit[]>([])
    const [invoices, setInvoices] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                // Fetch Trip with GPS
                const { data: tripData } = await supabase
                    .from("fleet_trips")
                    .select("*, vehicle:fleet_vehicles(*)")
                    .eq("id", tripId)
                    .single()

                if (tripData) setTrip(tripData)

                // Fetch Visits
                const { data: visitData } = await supabase
                    .from("fleet_trip_visits")
                    .select("*, customer:customers(name, customer_code)")
                    .eq("trip_id", tripId)
                    .order("visit_time", { ascending: true })

                if (visitData) setVisits(visitData)

                // Fetch Linked Invoices
                const { data: invoiceData } = await supabase
                    .from("sales_invoices")
                    .select("*")
                    .eq("trip_id", tripId)
                    .order("created_at", { ascending: true })

                if (invoiceData) setInvoices(invoiceData)

            } catch (error) {
                console.error("Error fetching tracking data:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [tripId, supabase])

    const simulateTracking = async () => {
        try {
            // 1. Add GPS Points
            const mockGps = [
                { lat: 31.5204, lng: 74.3587, time: new Date().toISOString() },
                { lat: 31.5210, lng: 74.3595, time: new Date(Date.now() + 60000).toISOString() }
            ]

            await supabase.from("fleet_trips").update({
                gps_path: mockGps,
                status: "IN_PROGRESS"
            }).eq("id", tripId)

            // 2. Add a Visit
            const { data: customer } = await supabase.from("customers").select("id").limit(1).single()
            if (customer) {
                await supabase.from("fleet_trip_visits").insert({
                    trip_id: tripId,
                    customer_id: customer.id,
                    notes: "Mock delivery visit",
                    visit_time: new Date().toISOString()
                })
            }

            // 3. Add a Mock Invoice link
            const { data: invoice } = await supabase.from("sales_invoices").select("id").limit(1).single()
            if (invoice) {
                await supabase.from("sales_invoices").update({ trip_id: tripId }).eq("id", invoice.id)
            }

            toast.success("Simulation complete! Refreshing...")
            window.location.reload()
        } catch (error) {
            toast.error("Simulation failed")
        }
    }

    if (loading) return <div>Loading tracking details...</div>
    if (!trip) return <div>Trip not found</div>

    return (
        <div className="space-y-6 max-w-5xl mx-auto p-4">
            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border">
                <div>
                    <h1 className="text-xl font-bold">Trip Live Monitoring</h1>
                    <p className="text-xs text-slate-500">Real-time data from {trip.vehicle?.registration_number}</p>
                </div>
                <Button variant="outline" size="sm" onClick={simulateTracking} className="gap-2">
                    <PlayCircle className="h-4 w-4" />
                    Simulate Live Tracking
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Navigation className="h-4 w-4 text-blue-500" />
                            GPS Tracking
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="aspect-video bg-slate-100 rounded-md flex items-center justify-center border-2 border-dashed border-slate-200">
                            <div className="text-center text-slate-500">
                                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-xs">Interactive Map Visualization</p>
                                <p className="text-[10px]">{trip.gps_path?.length || 0} track points recorded</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Users className="h-4 w-4 text-green-500" />
                            Customer Visits
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{visits.length}</div>
                        <p className="text-xs text-slate-500 mt-1">Unique stops completed</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <ShoppingBag className="h-4 w-4 text-purple-500" />
                            Sales Performance
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0).toLocaleString()}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{invoices.length} invoices generated</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Visit Log</CardTitle>
                        <CardDescription>Customers visited during this session</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Notes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visits.map((visit) => (
                                    <TableRow key={visit.id}>
                                        <TableCell className="text-xs">
                                            {format(new Date(visit.visit_time), "HH:mm")}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {visit.customer?.name}
                                            <div className="text-[10px] text-slate-400">{visit.customer?.customer_code}</div>
                                        </TableCell>
                                        <TableCell className="text-xs italic">{visit.notes || "-"}</TableCell>
                                    </TableRow>
                                ))}
                                {visits.length === 0 && (
                                    <TableRow><TableCell colSpan={3} className="text-center py-4 text-slate-400">No visits recorded</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Invoices</CardTitle>
                        <CardDescription>Direct sales from mobile store</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Invoice #</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoices.map((inv) => (
                                    <TableRow key={inv.id}>
                                        <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                                        <TableCell className="text-right font-medium">
                                            ${inv.total_amount?.toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="text-[10px]">{inv.status}</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {invoices.length === 0 && (
                                    <TableRow><TableCell colSpan={3} className="text-center py-4 text-slate-400">No invoices generated</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
