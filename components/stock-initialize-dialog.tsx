'use client'

import { useState } from 'react'
import { useLocations } from '@/lib/queries/locations'
import { useInitializeStock } from '@/lib/queries/inventory'
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
import { Package } from 'lucide-react'

type Props = {
    productId: string
    productName: string
}

export function StockInitializeDialog({ productId, productName }: Props) {
    const [open, setOpen] = useState(false)
    const [locationId, setLocationId] = useState('')
    const [quantity, setQuantity] = useState('')
    const [unitCost, setUnitCost] = useState('')

    const { data: locations } = useLocations()
    const initializeStock = useInitializeStock()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!locationId) {
            toast.error('Location Required', {
                description: 'Please select a location to initialize stock.',
            })
            return
        }

        try {
            await initializeStock.mutateAsync({
                product_id: productId,
                location_id: locationId,
                quantity: Number(quantity),
                unit_cost: Number(unitCost),
            })

            toast.success('Stock Initialized', {
                description: `Successfully added ${quantity} units for ${productName}.`,
            })

            setOpen(false)
            setLocationId('')
            setQuantity('')
            setUnitCost('')
        } catch (error: any) {
            toast.error('Initialization Failed', {
                description: error.message,
            })
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Package className="mr-2 h-4 w-4" />
                    Initialize Stock
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Initialize Stock</DialogTitle>
                        <DialogDescription>
                            Add opening stock for <strong>{productName}</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="location">Location *</Label>
                            <Select value={locationId} onValueChange={setLocationId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select location" />
                                </SelectTrigger>
                                <SelectContent>
                                    {locations?.map((location) => (
                                        <SelectItem key={location.id} value={location.id}>
                                            {location.name} ({location.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="quantity">Quantity *</Label>
                            <Input
                                id="quantity"
                                type="number"
                                step="0.001"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="100"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="unit_cost">Unit Cost *</Label>
                            <Input
                                id="unit_cost"
                                type="number"
                                step="0.01"
                                value={unitCost}
                                onChange={(e) => setUnitCost(e.target.value)}
                                placeholder="450.00"
                                required
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={initializeStock.isPending}>
                            {initializeStock.isPending ? 'Adding...' : 'Add Stock'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
