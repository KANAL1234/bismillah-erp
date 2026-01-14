'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Truck, Users, Map, Wrench } from "lucide-react"
import Link from "next/link"

export default function FleetDashboardPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Fleet Management</h1>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link href="/dashboard/fleet/vehicles">
                    <Card className="hover:bg-slate-50 transition-colors cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Total Vehicles
                            </CardTitle>
                            <Truck className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">--</div>
                            <p className="text-xs text-muted-foreground">
                                Active vehicles in fleet
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/dashboard/fleet/drivers">
                    <Card className="hover:bg-slate-50 transition-colors cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Active Drivers
                            </CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">--</div>
                            <p className="text-xs text-muted-foreground">
                                Drivers currently assigned
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/dashboard/fleet/trips">
                    <Card className="hover:bg-slate-50 transition-colors cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Active Trips
                            </CardTitle>
                            <Map className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">--</div>
                            <p className="text-xs text-muted-foreground">
                                Trips in progress
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/dashboard/fleet/maintenance">
                    <Card className="hover:bg-slate-50 transition-colors cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Maintenance
                            </CardTitle>
                            <Wrench className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">--</div>
                            <p className="text-xs text-muted-foreground">
                                Vehicles due for service
                            </p>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    )
}
