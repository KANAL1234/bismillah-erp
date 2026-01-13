import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { POSSale, POSSaleItem, CartItem } from '@/lib/types/database'

const supabase = createClient()

// Get all POS sales
export function usePOSSales(locationId?: string, startDate?: string, endDate?: string) {
    return useQuery({
        queryKey: ['pos-sales', locationId, startDate, endDate],
        queryFn: async () => {
            let query = supabase
                .from('pos_sales')
                .select(`
          *,
          pos_sale_items(
            *,
            products(id, sku, name)
          ),
          customers(id, customer_code, name),
          locations(id, code, name),
          cashier:user_profiles!cashier_id(id, full_name)
        `)
                .order('created_at', { ascending: false })

            if (locationId) {
                query = query.eq('location_id', locationId)
            }

            if (startDate) {
                query = query.gte('sale_date', startDate)
            }

            if (endDate) {
                query = query.lte('sale_date', endDate)
            }

            const { data, error } = await query

            if (error) throw error
            return data
        },
    })
}

// Get single POS sale
export function usePOSSale(id: string) {
    return useQuery({
        queryKey: ['pos-sales', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('pos_sales')
                .select(`
          *,
          pos_sale_items(
            *,
            products(id, sku, name, cost_price)
          ),
          customers(id, customer_code, name, phone),
          locations(id, code, name),
          cashier:user_profiles!cashier_id(id, full_name)
        `)
                .eq('id', id)
                .single()

            if (error) throw error
            return data
        },
        enabled: !!id,
    })
}

// Get today's sales for a location
export function useTodaySales(locationId: string) {
    const today = new Date().toISOString().split('T')[0]

    return useQuery({
        queryKey: ['pos-sales', 'today', locationId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('pos_sales')
                .select(`
          *,
          pos_sale_items(quantity, line_total)
        `)
                .eq('location_id', locationId)
                .gte('sale_date', today)

            if (error) throw error
            return data
        },
        enabled: !!locationId,
    })
}

// Create POS sale
export function useCreatePOSSale() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            locationId,
            customerId,
            items,
            paymentMethod,
            amountPaid,
            discountAmount = 0,
            notes,
        }: {
            locationId: string
            customerId?: string
            items: CartItem[]
            paymentMethod: 'CASH' | 'CREDIT' | 'BANK_TRANSFER'
            amountPaid: number
            discountAmount?: number
            notes?: string
        }) => {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            // Calculate totals
            const subtotal = items.reduce((sum, item) => sum + item.line_total, 0)
            const total = subtotal - discountAmount
            const amountDue = total - amountPaid

            // Generate sale number
            const saleNumber = `SALE-${Date.now()}`

            // Create sale
            const { data: sale, error: saleError } = await supabase
                .from('pos_sales')
                .insert({
                    sale_number: saleNumber,
                    location_id: locationId,
                    customer_id: customerId,
                    sale_date: new Date().toISOString(),
                    subtotal,
                    discount_amount: discountAmount,
                    tax_amount: 0, // Add tax logic if needed
                    total_amount: total,
                    payment_method: paymentMethod,
                    amount_paid: amountPaid,
                    cashier_id: user.id,
                    notes,
                    is_synced: true,
                })
                .select()
                .single()

            if (saleError) throw saleError

            // Create sale items
            const saleItems = items.map(item => ({
                sale_id: sale.id,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                discount_percentage: item.discount_percentage,
            }))

            const { error: itemsError } = await supabase
                .from('pos_sale_items')
                .insert(saleItems)

            if (itemsError) throw itemsError

            // Update inventory stock for each item
            for (const item of items) {
                await supabase.rpc('adjust_inventory_stock', {
                    p_product_id: item.product_id,
                    p_location_id: locationId,
                    p_quantity_change: -item.quantity,
                })

                // Create inventory transaction
                const { data: txnType } = await supabase
                    .from('transaction_types')
                    .select('id')
                    .eq('code', 'SALE')
                    .single()

                if (txnType) {
                    await supabase.from('inventory_transactions').insert({
                        transaction_type_id: txnType.id,
                        transaction_number: saleNumber,
                        product_id: item.product_id,
                        from_location_id: locationId,
                        quantity: item.quantity,
                        unit_cost: item.product.cost_price || 0,
                        reference_type: 'SALE',
                        reference_id: sale.id,
                        reference_number: saleNumber,
                        created_by: user.id,
                    })
                }
            }

            // If credit sale, update customer balance
            if (paymentMethod === 'CREDIT' && customerId) {
                await supabase.rpc('update_customer_balance', {
                    p_customer_id: customerId,
                    p_amount_change: amountDue,
                })
            }

            // Post to General Ledger (Accounting Integration)
            try {
                await supabase.rpc('post_pos_sale', {
                    p_sale_id: sale.id
                })
            } catch (glError) {
                console.warn('GL posting failed (non-critical):', glError)
                // Don't fail the sale if GL posting fails
            }

            return sale
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pos-sales'] })
            queryClient.invalidateQueries({ queryKey: ['inventory-stock'] })
            queryClient.invalidateQueries({ queryKey: ['customers'] })
        },
    })
}

// Get sales summary for date range
export function useSalesSummary(locationId: string, startDate: string, endDate: string) {
    return useQuery({
        queryKey: ['sales-summary', locationId, startDate, endDate],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('pos_sales')
                .select('total_amount, amount_paid, payment_method, created_at')
                .eq('location_id', locationId)
                .gte('sale_date', startDate)
                .lte('sale_date', endDate)

            if (error) throw error

            // Calculate summary
            const totalSales = data.reduce((sum, sale) => sum + sale.total_amount, 0)
            const totalCash = data
                .filter(s => s.payment_method === 'CASH')
                .reduce((sum, sale) => sum + sale.amount_paid, 0)
            const totalCredit = data
                .filter(s => s.payment_method === 'CREDIT')
                .reduce((sum, sale) => sum + sale.total_amount, 0)
            const transactionCount = data.length

            return {
                totalSales,
                totalCash,
                totalCredit,
                transactionCount,
                sales: data,
            }
        },
        enabled: !!locationId && !!startDate && !!endDate,
    })
}
