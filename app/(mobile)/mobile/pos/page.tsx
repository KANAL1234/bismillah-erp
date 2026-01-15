'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Plus, Minus, Search, ShoppingBag, Truck, Package, X } from 'lucide-react'
import { addToQueue } from '@/lib/offline/queue'
import { useOnlineStatus } from '@/lib/offline/sync'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

export default function MobilePOSPage() {
    const supabase = createClient()
    const isOnline = useOnlineStatus()
    const [search, setSearch] = useState('')
    const [cart, setCart] = useState<any[]>([])
    const [locationId, setLocationId] = useState<string | null>(null)
    const [vehicleInfo, setVehicleInfo] = useState<string>('')

    useEffect(() => {
        const match = document.cookie.match(/driver_vehicle_id=([^;]+)/)
        if (match) {
            const id = match[1]
            setLocationId(id)
            // Fetch vehicle name
            supabase.from('locations').select('name').eq('id', id).single().then(({ data }) => {
                if (data) setVehicleInfo(data.name)
            })
        }
    }, [])

    // Load ONLY vehicle inventory (products with stock > 0)
    const { data: productsWithStock, isLoading } = useQuery({
        queryKey: ['pos-vehicle-stock', locationId, search],
        queryFn: async () => {
            if (!locationId) return []

            const { data, error } = await supabase
                .from('inventory_stock')
                .select('quantity_on_hand, products!inner(*)')
                .eq('location_id', locationId)
                .gt('quantity_on_hand', 0)
                .ilike('products.name', `%${search}%`)
                .order('quantity_on_hand', { ascending: false })

            if (error) {
                console.error(error)
                return []
            }

            return data?.map((item: any) => ({
                ...item.products,
                quantity_on_hand: item.quantity_on_hand
            })) || []
        },
        enabled: !!locationId
    })

    const addToCart = (product: any) => {
        const quantityAvailable = product.quantity_on_hand
        const existing = cart.find(c => c.id === product.id)

        if (existing) {
            if (existing.quantity >= quantityAvailable) {
                toast.error(`Max stock reached (${quantityAvailable})`)
                return
            }
            setCart(cart.map(c =>
                c.id === product.id ? { ...c, quantity: c.quantity + 1 } : c
            ))
        } else {
            setCart([...cart, { ...product, quantity: 1, maxQuantity: quantityAvailable }])
            toast.success(`${product.name} added`, { duration: 1000 })
        }
    }

    const updateQuantity = (productId: string, change: number) => {
        setCart(cart.map(item => {
            if (item.id === productId) {
                const newQty = item.quantity + change
                if (item.maxQuantity && newQty > item.maxQuantity) {
                    toast.error(`Max stock available is ${item.maxQuantity}`)
                    return item
                }
                return newQty > 0 ? { ...item, quantity: newQty } : item
            }
            return item
        }).filter(item => item.quantity > 0))
    }

    const calculateTotal = () => {
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
            location_id: locationId,
            items: cart.map(item => ({
                product_id: item.id,
                quantity: item.quantity,
                unit_price: item.selling_price || 0,
                total_amount: (item.selling_price || 0) * item.quantity
            })),
            total_amount: calculateTotal(),
            payment_method: 'CASH',
            sale_date: new Date().toISOString(),
            status: 'posted'
        }

        if (isOnline) {
            const { error } = await supabase.from('pos_sales').insert({
                ...saleData,
                sale_number: `POS-${Date.now()}`,
                subtotal: saleData.total_amount,
                tax_amount: 0,
                discount_amount: 0,
                amount_paid: saleData.total_amount,
                amount_due: 0,
                is_synced: true
            })
            if (error) {
                toast.error('Failed to save sale')
                return
            }
            toast.success('Sale completed successfully!')
        } else {
            await addToQueue('CREATE_POS_SALE', {
                ...saleData,
                sale_number: `POS-OFF-${Date.now()}`,
                subtotal: saleData.total_amount,
                tax_amount: 0,
                discount_amount: 0,
                amount_paid: saleData.total_amount,
                amount_due: 0,
                is_synced: false
            })
            toast.success('Sale saved offline. Syncing soon.')
        }

        setCart([])
    }

    return (
        <div className="flex flex-col h-screen bg-slate-50">
            {/* Header Area */}
            <div className="bg-white border-b shadow-sm sticky top-0 z-20">
                <div className="px-4 pt-4 pb-2 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <Truck className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Active Vehicle</p>
                            <p className="text-sm font-bold text-slate-800 leading-tight">
                                {vehicleInfo || 'Loading vehicle...'}
                            </p>
                        </div>
                    </div>
                    {!isOnline && (
                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Offline Mode</Badge>
                    )}
                </div>

                <div className="px-4 pb-4 mt-2">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors group-focus-within:text-blue-500" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search in vehicle inventory..."
                            className="pl-9 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all rounded-xl h-11"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Products Grid */}
            <ScrollArea className="flex-1 px-4 py-4">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="text-slate-500 text-sm">Loading inventory...</p>
                    </div>
                ) : !locationId ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                        <Truck className="w-16 h-16 opacity-20" />
                        <p>No Vehicle Selected</p>
                        <Button variant="outline" onClick={() => window.location.href = '/mobile/select-vehicle'}>
                            Go to Selection
                        </Button>
                    </div>
                ) : productsWithStock?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                        <Package className="w-16 h-16 opacity-20" />
                        <p className="text-center font-medium">
                            {search ? `No results for "${search}"` : "This vehicle is empty"}
                        </p>
                        <p className="text-sm text-slate-400 -mt-3">Stock items will appear here after transfer</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3 pb-32">
                        {productsWithStock?.map((product: any) => (
                            <Card
                                key={product.id}
                                className="p-0 overflow-hidden cursor-pointer hover:shadow-md transition-shadow group border-slate-200"
                                onClick={() => addToCart(product)}
                            >
                                <div className="flex h-24">
                                    <div className="w-24 bg-slate-100 flex items-center justify-center group-active:scale-95 transition-transform">
                                        <Package className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <div className="flex-1 p-3 flex flex-col justify-between">
                                        <div>
                                            <h3 className="font-bold text-slate-800 line-clamp-1 leading-tight">{product.name}</h3>
                                            <p className="text-[10px] text-slate-400 font-mono tracking-tighter uppercase mb-1">SKU: {product.sku || 'N/A'}</p>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-black text-blue-600">PKR {product.selling_price?.toLocaleString() || '0'}</p>
                                            <div className="flex items-center gap-1.5">
                                                <Badge
                                                    variant="secondary"
                                                    className={`text-[10px] px-1.5 py-0 font-bold ${product.quantity_on_hand <= 5
                                                            ? "bg-rose-50 text-rose-600 border-rose-100"
                                                            : "bg-emerald-50 text-emerald-600 border-emerald-100"
                                                        }`}
                                                >
                                                    {product.quantity_on_hand} in stock
                                                </Badge>
                                                <div className="p-1 bg-blue-600 text-white rounded-md shadow-sm">
                                                    <Plus className="w-3.5 h-3.5" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </ScrollArea>

            {/* Premium Cart Bottom Bar */}
            {cart.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 z-30 pb-safe shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.05)]">
                    <ScrollArea className="max-h-[40vh]">
                        <div className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <ShoppingBag className="w-4 h-4 text-blue-600" />
                                    Items in Cart ({cart.reduce((s, i) => s + i.quantity, 0)})
                                </h3>
                                <button
                                    onClick={() => setCart([])}
                                    className="text-[10px] font-bold text-rose-500 uppercase tracking-wider hover:text-rose-600 transition-colors"
                                >
                                    Clear Cart
                                </button>
                            </div>

                            <div className="space-y-3">
                                {cart.map((item) => (
                                    <div key={item.id} className="flex items-start justify-between bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                                        <div className="flex-1 pr-4">
                                            <p className="font-bold text-xs text-slate-800 line-clamp-1">{item.name}</p>
                                            <p className="text-[10px] font-black text-blue-600 mt-0.5">PKR {item.selling_price?.toLocaleString()}</p>
                                        </div>
                                        <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm">
                                            <button
                                                onClick={() => updateQuantity(item.id, -1)}
                                                className="p-1.5 hover:bg-slate-50 text-slate-500 transition-colors"
                                            >
                                                <Minus className="w-3 h-3" />
                                            </button>
                                            <span className="w-8 text-center text-xs font-bold text-slate-800">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.id, 1)}
                                                className="p-1.5 hover:bg-slate-50 text-slate-500 transition-colors disabled:opacity-30"
                                                disabled={item.maxQuantity && item.quantity >= item.maxQuantity}
                                            >
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </ScrollArea>

                    <div className="p-4 pt-0">
                        <Separator className="mb-4 bg-slate-100" />
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Estimated Total</p>
                                <p className="text-2xl font-black text-slate-900 leading-none mt-1 uppercase">
                                    <span className="text-sm font-bold mr-1">PKR</span>
                                    {calculateTotal().toLocaleString()}
                                </p>
                            </div>
                            <Button
                                onClick={handleCheckout}
                                size="lg"
                                className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 active:scale-95 transition-all px-8 h-12 rounded-xl"
                            >
                                Checkout
                                <ShoppingBag className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
