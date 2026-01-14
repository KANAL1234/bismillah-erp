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
import { FleetFuelLog, FleetVehicle } from "@/types/fleet"

const formSchema = z.object({
    vehicle_id: z.string().min(1, "Vehicle is required"),
    log_date: z.string().min(1, "Date is required"),
    liters: z.string().min(1, "Amount is required"),
    cost_per_liter: z.string().min(1, "Cost is required"),
    odometer_reading: z.string().min(1, "Odometer required"),
})

type FormValues = z.infer<typeof formSchema>

interface FuelDialogProps {
    fuelLog?: FleetFuelLog
    trigger?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
    onSuccess?: () => void
}

export function FuelDialog({ fuelLog, trigger, open, onOpenChange, onSuccess }: FuelDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [vehicles, setVehicles] = useState<FleetVehicle[]>([])
    const supabase = createClient()

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            vehicle_id: "",
            log_date: new Date().toISOString().slice(0, 16),
            liters: "0",
            cost_per_liter: "0",
            odometer_reading: "0",
        },
    })

    useEffect(() => {
        const fetchVehicles = async () => {
            const { data } = await supabase.from("fleet_vehicles").select("*").eq("status", "ACTIVE")
            if (data) setVehicles(data)
        }
        fetchVehicles()
    }, [supabase])

    useEffect(() => {
        if (fuelLog) {
            form.reset({
                vehicle_id: fuelLog.vehicle_id,
                log_date: new Date(fuelLog.log_date).toISOString().slice(0, 16),
                liters: String(fuelLog.liters),
                cost_per_liter: String(fuelLog.cost_per_liter),
                odometer_reading: String(fuelLog.odometer_reading),
            })
        }
    }, [fuelLog, form])

    const onSubmit = async (values: FormValues) => {
        try {
            const liters = parseFloat(values.liters) || 0
            const cost_per_liter = parseFloat(values.cost_per_liter) || 0
            const odometer_reading = parseFloat(values.odometer_reading) || 0
            const total_cost = liters * cost_per_liter

            const dataToSave = {
                vehicle_id: values.vehicle_id,
                log_date: values.log_date,
                liters,
                cost_per_liter,
                odometer_reading,
                total_cost,
            }

            if (fuelLog) {
                const { error } = await supabase
                    .from("fleet_fuel_logs")
                    .update(dataToSave)
                    .eq("id", fuelLog.id)

                if (error) throw error
                toast.success("Fuel Log updated successfully")
            } else {
                const { error } = await supabase
                    .from("fleet_fuel_logs")
                    .insert(dataToSave)

                if (error) throw error
                toast.success("Fuel Log added successfully")
            }

            setIsOpen(false)
            onOpenChange?.(false)
            onSuccess?.()
            if (!fuelLog) form.reset()
        } catch (error: any) {
            toast.error(error.message || "Failed to save fuel log")
        }
    }

    return (
        <Dialog open={open ?? isOpen} onOpenChange={onOpenChange ?? setIsOpen}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{fuelLog ? "Edit Fuel Log" : "Log Fuel"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="vehicle_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Vehicle</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select vehicle" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {vehicles.map((v) => (
                                                <SelectItem key={v.id} value={v.id}>
                                                    {v.registration_number}
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
                            name="log_date"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Date & Time</FormLabel>
                                    <FormControl>
                                        <Input type="datetime-local" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="liters"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Liters</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.1" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="cost_per_liter"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Cost/Liter</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.1" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="odometer_reading"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Odometer Reading</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end">
                            <Button type="submit">
                                {fuelLog ? "Save Changes" : "Log Fuel"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
