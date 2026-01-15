'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Fuel } from 'lucide-react'
import { addToQueue } from '@/lib/offline/queue'
import { useOnlineStatus } from '@/lib/offline/sync'
import { useAuth } from '@/components/providers/auth-provider'
import { toast } from 'sonner'

export default function FuelPage() {
    const isOnline = useOnlineStatus()
    const { user } = useAuth()
    const [formData, setFormData] = useState({
        fuel_date: new Date().toISOString().split('T')[0],
        quantity_liters: '',
        price_per_liter: '',
        odometer_reading: '',
        fuel_station: '',
        receipt_number: ''
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const match = document.cookie.match(/driver_vehicle_id=([^;]+)/)
        const vehicleId = match ? match[1] : null

        if (!vehicleId || !user?.id) {
            toast.error('Vehicle or Driver not identified')
            return
        }

        const fuelData = {
            p_vehicle_id: vehicleId,
            p_driver_id: user.id,
            p_fuel_date: formData.fuel_date,
            p_fuel_type: 'PETROL',
            p_quantity_liters: parseFloat(formData.quantity_liters),
            p_price_per_liter: parseFloat(formData.price_per_liter),
            p_odometer_reading: parseFloat(formData.odometer_reading),
            p_fuel_station: formData.fuel_station,
            p_receipt_number: formData.receipt_number
        }

        await addToQueue('CREATE_FUEL_LOG', fuelData)

        toast.success(
            isOnline
                ? 'Fuel entry saved!'
                : 'Fuel entry saved offline. Will sync when online.'
        )

        // Reset form
        setFormData({
            fuel_date: new Date().toISOString().split('T')[0],
            quantity_liters: '',
            price_per_liter: '',
            odometer_reading: '',
            fuel_station: '',
            receipt_number: ''
        })
    }

    return (
        <div className="p-4">
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                        <Fuel className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Log Fuel Purchase</h1>
                        <p className="text-sm text-gray-600">Record fuel and odometer</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label>Date</Label>
                        <Input
                            type="date"
                            value={formData.fuel_date}
                            onChange={(e) => setFormData({ ...formData, fuel_date: e.target.value })}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Liters</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.quantity_liters}
                                onChange={(e) => setFormData({ ...formData, quantity_liters: e.target.value })}
                                placeholder="25.50"
                                required
                            />
                        </div>

                        <div>
                            <Label>Price/Liter</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.price_per_liter}
                                onChange={(e) => setFormData({ ...formData, price_per_liter: e.target.value })}
                                placeholder="290.00"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Odometer Reading (km)</Label>
                        <Input
                            type="number"
                            step="0.01"
                            value={formData.odometer_reading}
                            onChange={(e) => setFormData({ ...formData, odometer_reading: e.target.value })}
                            placeholder="15500"
                            required
                        />
                    </div>

                    <div>
                        <Label>Fuel Station</Label>
                        <Input
                            value={formData.fuel_station}
                            onChange={(e) => setFormData({ ...formData, fuel_station: e.target.value })}
                            placeholder="PSO Rawalpindi"
                        />
                    </div>

                    <div>
                        <Label>Receipt Number</Label>
                        <Input
                            value={formData.receipt_number}
                            onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
                            placeholder="PSO-12345"
                        />
                    </div>

                    {/* Total */}
                    {formData.quantity_liters && formData.price_per_liter && (
                        <Card className="p-4 bg-gray-50">
                            <div className="flex justify-between items-center">
                                <span className="font-medium">Total Cost:</span>
                                <span className="text-2xl font-bold text-orange-600">
                                    PKR {(parseFloat(formData.quantity_liters) * parseFloat(formData.price_per_liter)).toLocaleString()}
                                </span>
                            </div>
                        </Card>
                    )}

                    <Button type="submit" className="w-full" size="lg">
                        Save Fuel Entry
                    </Button>
                </form>
            </Card>
        </div>
    )
}
