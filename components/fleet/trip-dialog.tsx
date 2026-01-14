'use client'

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

const formSchema = z.object({
    vehicle_id: z.string().min(1, "Vehicle is required"),
    driver_id: z.string().min(1, "Driver is required"),
    assignment_date: z.string().min(1, "Date is required"),
    route_id: z.string().optional(),
    route_description: z.string().optional(),
    is_adhoc: z.boolean(),
    start_odometer: z.string().min(1, "Start odometer is required"),
    end_odometer: z.string().optional(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
    notes: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

interface Vehicle {
    id: string
    vehicle_code: string
    registration_number: string
    make: string
    model: string
}

interface Employee {
    id: string
    employee_code: string
    full_name: string
}

interface RouteAssignment {
    id: string
    vehicle_id: string
    driver_id: string
    assignment_date: string
    route_id?: string
    route_description?: string
    is_adhoc: boolean
    start_odometer?: number
    end_odometer?: number
    start_time?: string
    end_time?: string
    status: string
    notes?: string
}

interface TripDialogProps {
    trip?: RouteAssignment
    trigger?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
    onSuccess?: () => void
}

export function TripDialog({ trip, trigger, open, onOpenChange, onSuccess }: TripDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [vehicles, setVehicles] = useState<Vehicle[]>([])
    const [drivers, setDrivers] = useState<Employee[]>([])
    const supabase = createClient()

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            vehicle_id: "",
            driver_id: "",
            assignment_date: new Date().toISOString().split('T')[0],
            route_description: "",
            is_adhoc: true,
            start_odometer: "0",
            end_odometer: "",
            status: "PLANNED",
        },
    })

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch active vehicles
                const { data: vehiclesData, error: vehiclesError } = await supabase
                    .from("vehicles")
                    .select("id, vehicle_code, registration_number, make, model")
                    .eq("status", "ACTIVE")
                    .order("vehicle_code")

                if (vehiclesError) throw vehiclesError
                if (vehiclesData) setVehicles(vehiclesData)

                // Fetch active employees (drivers)
                const { data: driversData, error: driversError } = await supabase
                    .from("employees")
                    .select("id, employee_code, full_name")
                    .eq("employment_status", "ACTIVE")
                    .order("full_name")

                if (driversError) throw driversError
                if (driversData) setDrivers(driversData)
            } catch (error: any) {
                console.error("Error fetching data:", error)
                toast.error(error.message || "Failed to load data")
            }
        }

        fetchData()
    }, [supabase])

    useEffect(() => {
        if (trip) {
            form.reset({
                vehicle_id: trip.vehicle_id,
                driver_id: trip.driver_id,
                assignment_date: trip.assignment_date,
                route_id: trip.route_id || undefined,
                route_description: trip.route_description || undefined,
                is_adhoc: trip.is_adhoc,
                start_odometer: String(trip.start_odometer || 0),
                end_odometer: trip.end_odometer ? String(trip.end_odometer) : "",
                start_time: trip.start_time || undefined,
                end_time: trip.end_time || undefined,
                status: trip.status as FormValues["status"],
                notes: trip.notes || undefined,
            })
        }
    }, [trip, form])

    const onSubmit = async (values: FormValues) => {
        try {
            const startOdometer = parseFloat(values.start_odometer) || 0
            const endOdometer = values.end_odometer ? parseFloat(values.end_odometer) : null

            if (trip) {
                // Update existing route assignment
                const { error } = await supabase
                    .from("route_assignments")
                    .update({
                        vehicle_id: values.vehicle_id,
                        driver_id: values.driver_id,
                        assignment_date: values.assignment_date,
                        route_id: values.route_id || null,
                        route_description: values.route_description || null,
                        is_adhoc: values.is_adhoc,
                        start_odometer: startOdometer,
                        end_odometer: endOdometer,
                        start_time: values.start_time || null,
                        end_time: values.end_time || null,
                        status: values.status,
                        notes: values.notes || null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", trip.id)

                if (error) throw error
                toast.success("Route assignment updated successfully")
            } else {
                // Create new route assignment using RPC function
                const { data, error } = await supabase.rpc("assign_daily_route", {
                    p_assignment_date: values.assignment_date,
                    p_vehicle_id: values.vehicle_id,
                    p_driver_id: values.driver_id,
                    p_route_id: values.route_id || null,
                    p_route_description: values.route_description || null,
                    p_is_adhoc: values.is_adhoc,
                    p_start_odometer: startOdometer,
                })

                if (error) throw error

                if (data && !data.success) {
                    toast.error(data.message || "Failed to assign route")
                    return
                }

                toast.success(data?.message || "Route assigned successfully")
            }

            setIsOpen(false)
            onOpenChange?.(false)
            onSuccess?.()
            if (!trip) form.reset()
        } catch (error: any) {
            console.error("Error saving route assignment:", error)
            toast.error(error.message || "Failed to save route assignment")
        }
    }

    return (
        <Dialog open={open ?? isOpen} onOpenChange={onOpenChange ?? setIsOpen}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{trip ? "Edit Route Assignment" : "Assign Daily Route"}</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="assignment_date"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Date</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="vehicle_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Vehicle *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select vehicle" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {vehicles.map((v) => (
                                                    <SelectItem key={v.id} value={v.id}>
                                                        {v.registration_number} - {v.make} {v.model}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="driver_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Driver *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select driver" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {drivers.map((d) => (
                                                    <SelectItem key={d.id} value={d.id}>
                                                        {d.full_name} ({d.employee_code})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="route_description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Route Description</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="e.g., Rawalpindi Market Area - New customer prospecting"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="start_odometer"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Start Odometer (km) *</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="end_odometer"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>End Odometer (km)</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="start_time"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Start Time</FormLabel>
                                        <FormControl>
                                            <Input type="time" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="end_time"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>End Time</FormLabel>
                                        <FormControl>
                                            <Input type="time" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="PLANNED">Planned</SelectItem>
                                            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                            <SelectItem value="COMPLETED">Completed</SelectItem>
                                            <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Any additional notes" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setIsOpen(false)
                                    onOpenChange?.(false)
                                }}
                            >
                                Cancel
                            </Button>
                            <Button type="submit">
                                {trip ? "Save Changes" : "Assign Route"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}