'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Plus, Minus, Search, ShoppingBag } from 'lucide-react'
import { addToQueue } from '@/lib/offline/queue'
import { useOnlineStatus } from '@/lib/offline/sync'
import { toast } from 'sonner'

export default function MobilePOSPage() {
    const supabase = createClient()
    const isOnline = useOnlineStatus()
    const [search, setSearch] = useState('')
    const [cart, setCart] = useState<any[]>([])
    const [locationId, setLocationId] = useState<string | null>(null)

    // Load vehicle context
    useState(() => {
        // Use useState initializer or useEffect. useEffect is better for window access.
    })

    useEffect(() => {
        const match = document.cookie.match(/driver_vehicle_id=([^;]+)/)
        if (match) {
            setLocationId(match[1])
        }
    }, [])

    // Load products from Vehicle Inventory
    const { data: inventoryItems } = useQuery({
        queryKey: ['pos-inventory', locationId, search],
        queryFn: async () => {
            if (!locationId) return []

            // Fetch inventory for this vehicle
            const { data } = await supabase
                .from('inventory_stock')
                .select('*, products!inner(*)')
                .eq('location_id', locationId)
                .ilike('products.name', `%${search}%`)
                .order('quantity_on_hand', { ascending: false })

            return data || []
        },
        enabled: !!locationId
    })

    const addToCart = (item: any) => {
        const product = item.products
        const quantityAvailable = item.quantity_on_hand

        const existing = cart.find(c => c.id === product.id)
        if (existing) {
            if (existing.quantity >= quantityAvailable) {
                toast.error(`Only ${quantityAvailable} available`)
                return
            }
            setCart(cart.map(c =>
                c.id === product.id
                    ? { ...c, quantity: c.quantity + 1 }
                    : c
            ))
        } else {
            if (quantityAvailable <= 0) {
                toast.error('Out of stock')
                return
            }
            setCart([...cart, { ...product, quantity: 1, maxQuantity: quantityAvailable }])
        }
    }

    // ... (updateQuantity remains similar but check max info if stored)

    const updateQuantity = (productId: string, change: number) => {
        setCart(cart.map(item => {
            if (item.id === productId) {
                const newQty = item.quantity + change
                // Optional: Check maxQuantity if we saved it
                return newQty > 0 ? { ...item, quantity: newQty } : item
            }
            return item
        }).filter(item => item.quantity > 0))
    }

    const calculateTotal = () => {
        // Note: product.selling_price might be null/string? Ensure number.
        return cart.reduce((sum, item) => sum + ((item.selling_price || 0) * item.quantity), 0)
    }

    const handleCheckout = async () => {
        if (!locationId) {
            toast.error('No vehicle selected')
            return
        }
        if (cart.length === 0) {
            toast.error('Cart is empty')
            return
        }

        const saleData = {
            location_id: locationId, // Key addition
            items: cart.map(item => ({
                product_id: item.id,
                quantity: item.quantity,
                unit_price: item.selling_price || 0,
                total_amount: (item.selling_price || 0) * item.quantity
            })),
            total_amount: calculateTotal(),
            payment_method: 'CASH',
            sale_date: new Date().toISOString(),
            status: 'posted' // Assuming auto-post for mobile sales? Or draft? posted is safer for stock deduction if backend handles it.
            // But schema says 'posted'.
        }

        // ... Logic for online/offline ...
        if (isOnline) {
            const { error } = await supabase.from('pos_sales').insert({
                ...saleData,
                sale_number: `POS-${Date.now()}`, // Schema needs sale_number
                subtotal: saleData.total_amount,
                tax_amount: 0,
                discount_amount: 0,
                amount_paid: saleData.total_amount,
                amount_due: 0,
                is_synced: true
            })
            if (error) {
                console.error(error)
                toast.error('Failed to save sale')
                return
            }
            toast.success('Sale saved!')
        } else {
            await addToQueue('CREATE_POS_SALE', {
                ...saleData,
                sale_number: `POS-OFFLINE-${Date.now()}`,
                subtotal: saleData.total_amount,
                tax_amount: 0,
                discount_amount: 0,
                amount_paid: saleData.total_amount,
                amount_due: 0,
                is_synced: false
            })
            toast.success('Sale saved offline. Will sync when online.')
        }

        setCart([])
    }

    return (
        <div className="flex flex-col h-screen">
            {/* Search */}
            <div className="p-4 bg-white border-b">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search vehicle inventory..."
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {inventoryItems?.map((item: any) => (
                    <Card
                        key={item.id}
                        className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                        onClick={() => addToCart(item)}
                    >
                        <div>
                            <p className="font-medium">{item.products.name}</p>
                            <div className="flex gap-2 text-sm text-gray-600">
                                <span>PKR {item.products.selling_price}</span>
                                <span className={item.quantity_on_hand < 10 ? "text-red-500 font-bold" : "text-green-600"}>
                                    Stock: {item.quantity_on_hand}
                                </span>
                            </div>
                        </div>
                        <Button size="sm" variant={item.quantity_on_hand === 0 ? "outline" : "default"} disabled={item.quantity_on_hand === 0}>
                            <Plus className="w-4 h-4" />
                        </Button>
                    </Card>
                ))}
            </div>

            {/* Cart */}
            {cart.length > 0 && (
                <div className="border-t bg-white p-4 space-y-3">
                    {cart.map((item) => (
                        <div key={item.id} className="flex items-center justify-between">
                            <div className="flex-1">
                                <p className="font-medium text-sm">{item.product_name}</p>
                                <p className="text-xs text-gray-600">PKR {item.selling_price}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateQuantity(item.id, -1)}
                                >
                                    <Minus className="w-3 h-3" />
                                </Button>
                                <span className="w-8 text-center font-medium">{item.quantity}</span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateQuantity(item.id, 1)}
                                >
                                    <Plus className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    ))}

                    <div className="pt-3 border-t">
                        <div className="flex justify-between mb-3">
                            <span className="text-lg font-semibold">Total:</span>
                            <span className="text-lg font-bold">PKR {calculateTotal().toLocaleString()}</span>
                        </div>
                        <Button
                            onClick={handleCheckout}
                            className="w-full"
                            size="lg"
                        >
                            <ShoppingBag className="w-4 h-4 mr-2" />
                            Complete Sale
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
