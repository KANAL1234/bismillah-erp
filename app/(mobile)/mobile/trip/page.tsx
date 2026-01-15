'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MapPin, Navigation, StopCircle, CheckCircle, XCircle } from 'lucide-react'
import { useLocationTracker } from '@/lib/hooks/use-location-tracker'
import { useAuth } from '@/components/providers/auth-provider'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { getFormattedAddress } from '@/lib/utils'

export default function TripPage() {
    const supabase = createClient()
    const { user } = useAuth()
    const router = useRouter()
    const { isTracking, startTracking, stopTracking } = useLocationTracker()

    const [vehicleId, setVehicleId] = useState('')
    const [odometer, setOdometer] = useState('')

    // End Trip State
    const [isEnding, setIsEnding] = useState(false)
    const [endOdometer, setEndOdometer] = useState('')
    const [loading, setLoading] = useState(false)

    // Get Vehicles
    const { data: vehicles } = useQuery({
        queryKey: ['vehicles-list'],
        queryFn: async () => {
            const { data } = await supabase.from('vehicles').select('id, license_plate, current_odometer')
            return data || []
        }
    })

    // Auto-fill odometer when vehicle selected
    useEffect(() => {
        if (vehicleId && vehicles && !isTracking) {
            const v = vehicles.find((v: any) => v.id === vehicleId)
            if (v) setOdometer(v.current_odometer?.toString() || '')
        }
    }, [vehicleId, vehicles, isTracking])

    const handleStart = async () => {
        if (!vehicleId || !odometer) {
            toast.error('Please fill all fields')
            return
        }

        // Check permission or valid user
        const driverId = user?.id
        if (!driverId) {
            toast.error('User not identified')
            return
        }

        setLoading(true)

        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser')
            setLoading(false)
            return
        }

        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const address = await getFormattedAddress(position.coords.latitude, position.coords.longitude)
                await startTracking(vehicleId, driverId, address, parseFloat(odometer))
                toast.success('Trip started! Tracking enabled.')
            } catch (error) {
                toast.error('Failed to start trip')
            } finally {
                setLoading(false)
            }
        }, (error) => {
            console.error(error)
            toast.error('Location access denied. Please enable GPS.')
            setLoading(false)
        }, { enableHighAccuracy: true })
    }

    const handleStopClick = () => {
        // Pre-fill end odometer with vehicle's current odometer if available
        // Note: If page was reloaded, we might not know the exact start odometer of THIS trip in this component state easily without fetching.
        // But we can just leave it empty or user enters it.
        // If we still have `odometer` state from vehicle selection (if not reloaded), use it.
        setEndOdometer(odometer)
        setIsEnding(true)
    }

    const confirmStop = async () => {
        if (!endOdometer) {
            toast.error("Please enter closing odometer")
            return
        }

        setLoading(true)

        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const address = await getFormattedAddress(position.coords.latitude, position.coords.longitude)
                await stopTracking(address, parseFloat(endOdometer))
                toast.success('Trip ended successfully.')
                router.push('/mobile')
            } catch (error) {
                toast.error('Failed to end trip')
                setLoading(false)
            }
        }, (error) => {
            // Fallback if location fails
            stopTracking("Unknown Location", parseFloat(endOdometer))
                .then(() => {
                    toast.success('Trip ended (Location unavailable)')
                    router.push('/mobile')
                })
        }, { enableHighAccuracy: true })
    }

    if (isTracking) {
        return (
            <div className="p-6 h-screen flex flex-col items-center justify-center space-y-6">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center animate-pulse">
                    <Navigation className="w-12 h-12 text-green-600" />
                </div>
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-green-700">Trip in Progress</h1>
                    <p className="text-gray-500">Tracking your location...</p>
                    <p className="text-xs text-gray-400 mt-2">Updates every 30s</p>
                </div>

                {!isEnding ? (
                    <Button size="lg" variant="destructive" className="w-full max-w-xs" onClick={handleStopClick} disabled={loading}>
                        <StopCircle className="mr-2 h-5 w-5" />
                        {loading ? 'Processing...' : 'End Trip'}
                    </Button>
                ) : (
                    <Card className="w-full max-w-xs p-4 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                        <div className="text-center">
                            <h3 className="font-semibold text-lg">Finish Trip</h3>
                            <p className="text-sm text-gray-500">Enter final odometer reading</p>
                        </div>

                        <div>
                            <Label>End Odometer</Label>
                            <Input
                                type="number"
                                value={endOdometer}
                                onChange={(e) => setEndOdometer(e.target.value)}
                                placeholder="e.g. 15020"
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => setIsEnding(false)}>
                                <XCircle className="w-4 h-4 mr-2" />
                                Cancel
                            </Button>
                            <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={confirmStop} disabled={loading}>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Confirm
                            </Button>
                        </div>
                    </Card>
                )}
            </div>
        )
    }

    return (
        <div className="p-4 space-y-6">
            <h1 className="text-2xl font-bold">Start New Trip</h1>

            <Card className="p-6 space-y-4">
                <div>
                    <Label>Select Vehicle</Label>
                    <Select onValueChange={setVehicleId} value={vehicleId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select vehicle..." />
                        </SelectTrigger>
                        <SelectContent>
                            {vehicles?.map((v: any) => (
                                <SelectItem key={v.id} value={v.id}>
                                    {v.license_plate}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label>Start Odometer</Label>
                    <Input
                        type="number"
                        value={odometer}
                        onChange={e => setOdometer(e.target.value)}
                    />
                </div>

                <Button size="lg" className="w-full" onClick={handleStart} disabled={loading}>
                    <MapPin className="mr-2 h-4 w-4" />
                    {loading ? 'Getting Location...' : 'Start Journey'}
                </Button>
            </Card>
        </div>
    )
}
