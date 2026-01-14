'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Truck, Users, Map, Wrench, AlertTriangle, CheckCircle2, TrendingUp, DollarSign } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/utils"

export default function FleetDashboardPage() {
    const [stats, setStats] = useState({
        vehicles: 0,
        drivers: 0,
        trips: 0,
        maintenance: 0,
        totalExpenses: 0,
        totalTrips: 0
    })
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        async function fetchStats() {
            try {
                const today = new Date().toISOString().split('T')[0]
                const nextWeek = new Date()
                nextWeek.setDate(nextWeek.getDate() + 7)
                const nextWeekStr = nextWeek.toISOString().split('T')[0]

                const [
                    { count: vehicles },
                    { count: drivers },
                    { count: activeTrips },
                    { count: maintenanceDue },
                    { data: fuelLogs },
                    { data: maintenanceLogs },
                    { count: totalTrips }
                ] = await Promise.all([
                    supabase.from('fleet_vehicles').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
                    supabase.from('fleet_drivers').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
                    supabase.from('fleet_trips').select('*', { count: 'exact', head: true }).eq('status', 'IN_PROGRESS'),
                    supabase.from('fleet_maintenance').select('*', { count: 'exact', head: true }).lte('next_service_due_date', nextWeekStr),
                    supabase.from('fleet_fuel_logs').select('total_cost'),
                    supabase.from('fleet_maintenance').select('cost'),
                    supabase.from('fleet_trips').select('*', { count: 'exact', head: true })
                ])

                const fuelTotal = fuelLogs?.reduce((sum, log) => sum + (Number(log.total_cost) || 0), 0) || 0
                const maintenanceTotal = maintenanceLogs?.reduce((sum, log) => sum + (Number(log.cost) || 0), 0) || 0

                setStats({
                    vehicles: vehicles || 0,
                    drivers: drivers || 0,
                    trips: activeTrips || 0,
                    maintenance: maintenanceDue || 0,
                    totalExpenses: fuelTotal + maintenanceTotal,
                    totalTrips: totalTrips || 0
                })
            } catch (error) {
                console.error("Error fetching fleet stats:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchStats()
    }, [supabase])

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Fleet Overview</h1>
                    <p className="text-muted-foreground">Manage your mobile stores and vehicle operations</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/dashboard/fleet/trips">
                        <Card className="p-2 px-4 hover:bg-slate-50 cursor-pointer border-blue-100 bg-blue-50/50">
                            <div className="flex items-center gap-2">
                                <Map className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-900">Live Tracking</span>
                            </div>
                        </Card>
                    </Link>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link href="/dashboard/fleet/vehicles">
                    <Card className="hover:bg-slate-50 transition-colors cursor-pointer group">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Vehicles</CardTitle>
                            <Truck className="h-4 w-4 text-muted-foreground group-hover:text-blue-600 transition-colors" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{loading ? "--" : stats.vehicles}</div>
                            <p className="text-xs text-muted-foreground">Active mobile stores</p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/dashboard/fleet/drivers">
                    <Card className="hover:bg-slate-50 transition-colors cursor-pointer group">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground group-hover:text-green-600 transition-colors" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{loading ? "--" : stats.drivers}</div>
                            <p className="text-xs text-muted-foreground">Currently on duty</p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/dashboard/fleet/trips">
                    <Card className="hover:bg-slate-50 transition-colors cursor-pointer group">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Active Trips</CardTitle>
                            <div className="relative">
                                <Map className="h-4 w-4 text-muted-foreground group-hover:text-purple-600 transition-colors" />
                                {stats.trips > 0 && <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{loading ? "--" : stats.trips}</div>
                            <p className="text-xs text-muted-foreground">Live tracking in progress</p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/dashboard/fleet/maintenance">
                    <Card className="hover:bg-slate-50 transition-colors cursor-pointer group">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
                            <Wrench className="h-4 w-4 text-muted-foreground group-hover:text-orange-600 transition-colors" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{loading ? "--" : stats.maintenance}</div>
                            <p className="text-xs text-orange-600 font-medium">
                                {stats.maintenance > 0 ? `${stats.maintenance} service(s) due` : 'All clear'}
                            </p>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-slate-500" />
                            Operational Stats
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Total Fleet Expenses</p>
                                <p className="text-xl font-bold">{loading ? "..." : formatCurrency(stats.totalExpenses)}</p>
                            </div>
                            <DollarSign className="h-8 w-8 text-slate-200" />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Historical Trips Completed</p>
                                <p className="text-xl font-bold">{loading ? "..." : stats.totalTrips}</p>
                            </div>
                            <CheckCircle2 className="h-8 w-8 text-slate-200" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-slate-500" />
                            Fleet Health
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-muted-foreground mb-4">
                            Summary of fleet status and critical alerts.
                        </div>
                        <div className="space-y-2">
                            {stats.maintenance > 0 && (
                                <div className="p-2 rounded bg-orange-50 border border-orange-100 flex items-center gap-2 text-xs text-orange-800">
                                    <AlertTriangle className="h-3 w-3" />
                                    {stats.maintenance} vehicles require maintenance attention.
                                </div>
                            )}
                            {stats.trips > 0 ? (
                                <div className="p-2 rounded bg-blue-50 border border-blue-100 flex items-center gap-2 text-xs text-blue-800">
                                    <TrendingUp className="h-3 w-3" />
                                    Current fleet utilization is at {Math.round((stats.trips / (stats.vehicles || 1)) * 100)}%.
                                </div>
                            ) : (
                                <div className="p-2 rounded bg-slate-50 border border-slate-100 flex items-center gap-2 text-xs text-slate-600">
                                    <CheckCircle2 className="h-3 w-3" />
                                    All vehicles are currently idle or parked.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
