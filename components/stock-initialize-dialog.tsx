'use client'

import { useState, useEffect } from 'react'
import { useLocations } from '@/lib/queries/locations'
import { useInitializeStock, useProductStock } from '@/lib/queries/inventory'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Package, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

type Props = {
    productId: string
    productName: string
}

export function StockInitializeDialog({ productId, productName }: Props) {
    const [open, setOpen] = useState(false)
    const [locationId, setLocationId] = useState('')
    const [quantity, setQuantity] = useState('')
    const [unitCost, setUnitCost] = useState('')
    const [isUpdate, setIsUpdate] = useState(false)
    const [existingQuantity, setExistingQuantity] = useState(0)

    const { data: locations } = useLocations()
    const { data: productStock } = useProductStock(productId)
    const initializeStock = useInitializeStock()

    // Check if selected location already has stock
    useEffect(() => {
        if (locationId && productStock) {
            const existingStock = productStock.find(s => s.location_id === locationId)
            if (existingStock) {
                setIsUpdate(true)
                setExistingQuantity(existingStock.quantity_on_hand)
                // Optionally pre-fill with existing values
                setUnitCost(existingStock.average_cost.toString())
            } else {
                setIsUpdate(false)
                setExistingQuantity(0)
                setUnitCost('')
            }
        }
    }, [locationId, productStock])

    // Get locations that don't have stock yet
    const availableLocations = locations?.filter(loc => {
        return !productStock?.some(stock => stock.location_id === loc.id)
    })

    // Get locations that already have stock
    const locationsWithStock = locations?.filter(loc => {
        return productStock?.some(stock => stock.location_id === loc.id)
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!locationId) {
            toast.error('Location Required', {
                description: 'Please select a location.',
            })
            return
        }

        // Confirm if updating existing stock
        if (isUpdate) {
            const confirmed = confirm(
                `This location already has ${existingQuantity} units. Do you want to update it to ${quantity} units?`
            )
            if (!confirmed) return
        }

        try {
            await initializeStock.mutateAsync({
                product_id: productId,
                location_id: locationId,
                quantity: Number(quantity),
                unit_cost: Number(unitCost),
            })

            toast.success(isUpdate ? 'Stock Updated' : 'Stock Initialized', {
                description: isUpdate
                    ? `Successfully updated stock to ${quantity} units for ${productName}.`
                    : `Successfully added ${quantity} units for ${productName}.`,
            })

            setOpen(false)
            setLocationId('')
            setQuantity('')
            setUnitCost('')
            setIsUpdate(false)
        } catch (error: any) {
            toast.error('Error', {
                description: error.message,
            })
        }
    }

    // Check if all locations already have stock
    const allLocationsInitialized = availableLocations?.length === 0 && locationsWithStock && locationsWithStock.length > 0

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Package className="mr-2 h-4 w-4" />
                    {productStock && productStock.length > 0 ? 'Manage Stock' : 'Initialize Stock'}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>
                            {isUpdate ? 'Update Stock' : 'Initialize Stock'}
                        </DialogTitle>
                        <DialogDescription>
                            {isUpdate
                                ? `Update stock quantity for ${productName}`
                                : `Add opening stock for ${productName}`
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* Show existing stock summary */}
                        {productStock && productStock.length > 0 && (
                            <Alert>
                                <CheckCircle2 className="h-4 w-4" />
                                <AlertDescription className="w-full">
                                    <div className="font-medium mb-2">Current Stock Distribution:</div>
                                    <div className="space-y-1 text-sm">
                                        {productStock.map(stock => (
                                            <div key={stock.id} className="flex justify-between border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                                                <span className="text-slate-600">{stock.locations?.name}:</span>
                                                <span className="font-bold text-slate-900">{stock.quantity_on_hand.toLocaleString()} units</span>
                                            </div>
                                        ))}
                                        <div className="pt-2 flex justify-between font-bold text-slate-900">
                                            <span>Total:</span>
                                            <span>{productStock.reduce((sum, s) => sum + s.quantity_on_hand, 0).toLocaleString()} units</span>
                                        </div>
                                    </div>
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Warning if all locations have stock */}
                        {allLocationsInitialized && (
                            <Alert className="bg-amber-50 border-amber-200">
                                <AlertCircle className="h-4 w-4 text-amber-600" />
                                <AlertDescription className="text-amber-800">
                                    All locations already have stock for this product.
                                    Select a location below to update its quantity.
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="location">Target Location *</Label>
                            <Select value={locationId} onValueChange={setLocationId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select location" />
                                </SelectTrigger>
                                <SelectContent>
                                    {/* Show locations without stock first */}
                                    {availableLocations && availableLocations.length > 0 && (
                                        <>
                                            <div className="px-2 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                                Available Locations
                                            </div>
                                            {availableLocations.map((location) => (
                                                <SelectItem key={location.id} value={location.id}>
                                                    {location.name} ({location.code})
                                                </SelectItem>
                                            ))}
                                        </>
                                    )}

                                    {/* Show locations with stock (for updates) */}
                                    {locationsWithStock && locationsWithStock.length > 0 && (
                                        <>
                                            <div className="px-2 py-1.5 text-xs font-bold text-amber-500 uppercase tracking-widest border-t mt-1 pt-2">
                                                Update Existing Stock
                                            </div>
                                            {locationsWithStock.map((location) => {
                                                const stock = productStock?.find(s => s.location_id === location.id)
                                                return (
                                                    <SelectItem key={location.id} value={location.id}>
                                                        {location.name} ({location.code}) - Current: {stock?.quantity_on_hand || 0}
                                                    </SelectItem>
                                                )
                                            })}
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Show warning if updating existing stock */}
                        {isUpdate && existingQuantity > 0 && (
                            <Alert variant="destructive" className="bg-red-50 text-red-900 border-red-200">
                                <AlertCircle className="h-4 w-4 text-red-600" />
                                <AlertDescription>
                                    This location currently has <strong>{existingQuantity.toLocaleString()} units</strong>.
                                    Entering a new quantity will **replace** this value.
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="quantity">New Quantity *</Label>
                            <Input
                                id="quantity"
                                type="number"
                                step="0.001"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder={isUpdate ? `Current: ${existingQuantity}` : '100'}
                                required
                            />
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                                {isUpdate
                                    ? 'Enter NEW total quantity (will override current)'
                                    : 'Enter opening balance quantity'
                                }
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="unit_cost">Unit Cost (Rs.) *</Label>
                            <Input
                                id="unit_cost"
                                type="number"
                                step="0.01"
                                value={unitCost}
                                onChange={(e) => setUnitCost(e.target.value)}
                                placeholder="450.00"
                                required
                            />
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                                Cost per unit for inventory valuation
                            </p>
                        </div>

                        {/* Show calculation preview */}
                        {quantity && unitCost && (
                            <Alert className="bg-slate-900 text-white border-none shadow-lg">
                                <AlertDescription className="w-full">
                                    <div className="font-bold mb-1 opacity-70 uppercase text-[10px] tracking-widest">Valuation Preview:</div>
                                    <div className="text-sm space-y-1">
                                        <div className="flex justify-between">
                                            <span className="opacity-70">Quantity:</span>
                                            <span className="font-mono">{Number(quantity).toLocaleString()} units</span>
                                        </div>
                                        <div className="flex justify-between border-b border-white/10 pb-1">
                                            <span className="opacity-70">At Cost:</span>
                                            <span className="font-mono">Rs. {Number(unitCost).toLocaleString()}</span>
                                        </div>
                                        <div className="pt-1 flex justify-between font-bold text-lg">
                                            <span className="opacity-70 text-sm">Total:</span>
                                            <span>Rs. {(Number(quantity) * Number(unitCost)).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={initializeStock.isPending} className="bg-slate-900 text-white hover:bg-slate-800">
                            {initializeStock.isPending
                                ? 'Processing...'
                                : isUpdate
                                    ? 'Update Stock Level'
                                    : 'Initialize Stock'
                            }
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
