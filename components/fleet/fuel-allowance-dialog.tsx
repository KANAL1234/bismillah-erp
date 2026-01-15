'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useCreateFuelAllowance, useUpdateFuelAllowance } from '@/lib/queries/fleet-workflow'
import { Fuel } from 'lucide-react'
import type { FleetFuelAllowance } from '@/types/fleet'

const formSchema = z.object({
    trip_id: z.string().min(1, 'Trip is required'),
    driver_id: z.string().min(1, 'Driver is required'),
    vehicle_id: z.string().min(1, 'Vehicle is required'),
    allowance_date: z.string().min(1, 'Date is required'),
    budgeted_fuel_liters: z.string().min(1, 'Budgeted liters is required'),
    budgeted_fuel_cost: z.string().min(1, 'Budgeted cost is required'),
    notes: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

interface FuelAllowanceDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    allowance?: FleetFuelAllowance | null
    tripId?: string
    driverId?: string
    vehicleId?: string
}

export function FuelAllowanceDialog({
    open,
    onOpenChange,
    allowance,
    tripId,
    driverId,
    vehicleId,
}: FuelAllowanceDialogProps) {
    const createAllowance = useCreateFuelAllowance()
    const updateAllowance = useUpdateFuelAllowance()

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            trip_id: tripId || '',
            driver_id: driverId || '',
            vehicle_id: vehicleId || '',
            allowance_date: new Date().toISOString().split('T')[0],
            budgeted_fuel_liters: '',
            budgeted_fuel_cost: '',
            notes: '',
        },
    })

    useEffect(() => {
        if (allowance) {
            form.reset({
                trip_id: allowance.trip_id,
                driver_id: allowance.driver_id,
                vehicle_id: allowance.vehicle_id,
                allowance_date: allowance.allowance_date,
                budgeted_fuel_liters: allowance.budgeted_fuel_liters.toString(),
                budgeted_fuel_cost: allowance.budgeted_fuel_cost.toString(),
                notes: allowance.notes || '',
            })
        } else {
            form.reset({
                trip_id: tripId || '',
                driver_id: driverId || '',
                vehicle_id: vehicleId || '',
                allowance_date: new Date().toISOString().split('T')[0],
                budgeted_fuel_liters: '',
                budgeted_fuel_cost: '',
                notes: '',
            })
        }
    }, [allowance, tripId, driverId, vehicleId, form])

    const watchedLiters = form.watch('budgeted_fuel_liters')
    const watchedCost = form.watch('budgeted_fuel_cost')

    const costPerLiter = watchedLiters && watchedCost && parseFloat(watchedLiters) > 0
        ? parseFloat(watchedCost) / parseFloat(watchedLiters)
        : 0

    const onSubmit = async (values: FormValues) => {
        const data = {
            ...values,
            budgeted_fuel_liters: parseFloat(values.budgeted_fuel_liters),
            budgeted_fuel_cost: parseFloat(values.budgeted_fuel_cost),
            actual_fuel_liters: 0,
            actual_fuel_cost: 0,
            status: 'ACTIVE' as const,
        }

        if (allowance) {
            await updateAllowance.mutateAsync({
                id: allowance.id,
                ...data,
            })
        } else {
            await createAllowance.mutateAsync(data)
        }

        form.reset()
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Fuel className="h-5 w-5 text-blue-600" />
                        {allowance ? 'Edit Fuel Allowance' : 'Set Fuel Allowance'}
                    </DialogTitle>
                    <DialogDescription>
                        Set daily fuel budget for this trip
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="allowance_date"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Allowance Date</FormLabel>
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
                                name="budgeted_fuel_liters"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Budgeted Fuel (Liters)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                placeholder="0.00"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="budgeted_fuel_cost"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Budgeted Cost (Rs.)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                placeholder="0.00"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {costPerLiter > 0 && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <p className="text-sm text-blue-900">
                                    <strong>Cost per Liter:</strong> Rs. {costPerLiter.toFixed(2)}
                                </p>
                            </div>
                        )}

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Add any additional notes..."
                                            className="resize-none"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={createAllowance.isPending || updateAllowance.isPending}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {createAllowance.isPending || updateAllowance.isPending
                                    ? 'Saving...'
                                    : allowance
                                        ? 'Update Allowance'
                                        : 'Set Allowance'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
