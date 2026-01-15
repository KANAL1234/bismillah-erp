'use client'

import { useState } from 'react'
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

    // Load products (cached for offline)
    const { data: products } = useQuery({
        queryKey: ['products-mobile', search],
        queryFn: async () => {
            const { data } = await supabase
                .from('products')
                .select('*')
                .ilike('product_name', `%${search}%`)
                .limit(20)
            return data || []
        }
    })

    const addToCart = (product: any) => {
        const existing = cart.find(item => item.id === product.id)
        if (existing) {
            setCart(cart.map(item =>
                item.id === product.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ))
        } else {
            setCart([...cart, { ...product, quantity: 1 }])
        }
    }

    const updateQuantity = (productId: string, change: number) => {
        setCart(cart.map(item => {
            if (item.id === productId) {
                const newQty = item.quantity + change
                return newQty > 0 ? { ...item, quantity: newQty } : item
            }
            return item
        }).filter(item => item.quantity > 0))
    }

    const calculateTotal = () => {
        return cart.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0)
    }

    const handleCheckout = async () => {
        if (cart.length === 0) {
            toast.error('Cart is empty')
            return
        }

        const saleData = {
            items: cart.map(item => ({
                product_id: item.id,
                quantity: item.quantity,
                unit_price: item.selling_price,
                total_amount: item.selling_price * item.quantity
            })),
            total_amount: calculateTotal(),
            payment_method: 'CASH',
            sale_date: new Date().toISOString()
        }

        if (isOnline) {
            // Try to save directly
            const { error } = await supabase.from('pos_sales').insert(saleData)
            if (error) {
                toast.error('Failed to save sale')
                return
            }
            toast.success('Sale saved!')
        } else {
            // Save to offline queue
            await addToQueue('CREATE_POS_SALE', saleData)
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
                        placeholder="Search products..."
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {products?.map((product) => (
                    <Card
                        key={product.id}
                        className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                        onClick={() => addToCart(product)}
                    >
                        <div>
                            <p className="font-medium">{product.product_name}</p>
                            <p className="text-sm text-gray-600">PKR {product.selling_price}</p>
                        </div>
                        <Button size="sm">
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
