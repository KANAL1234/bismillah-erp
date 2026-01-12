import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { StockTransfer, StockTransferItem } from '@/lib/types/database'

const supabase = createClient()

// Get all stock transfers
export function useStockTransfers(status?: string) {
    return useQuery({
        queryKey: ['stock-transfers', status],
        queryFn: async () => {
            let query = supabase
                .from('stock_transfers')
                .select(`
          *,
          from_location:locations!from_location_id(id, code, name),
          to_location:locations!to_location_id(id, code, name),
          stock_transfer_items(
            *,
            products(id, sku, name)
          )
        `)
                .order('created_at', { ascending: false })

            if (status) {
                query = query.eq('status', status)
            }

            const { data, error } = await query

            if (error) throw error
            return data
        },
    })
}

// Get single transfer
export function useStockTransfer(id: string) {
    return useQuery({
        queryKey: ['stock-transfers', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('stock_transfers')
                .select(`
          *,
          from_location:locations!from_location_id(id, code, name),
          to_location:locations!to_location_id(id, code, name),
          stock_transfer_items(
            *,
            products(id, sku, name, cost_price)
          )
        `)
                .eq('id', id)
                .single()

            if (error) throw error
            return data
        },
        enabled: !!id,
    })
}

// Create transfer
export function useCreateTransfer() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (transfer: {
            from_location_id: string
            to_location_id: string
            transfer_date: string
            notes?: string
            items: {
                product_id: string
                quantity_requested: number
                unit_cost: number
            }[]
        }) => {
            // Generate transfer number
            const transferNumber = `TRF-${Date.now()}`

            // Create transfer
            const { data: transferData, error: transferError } = await supabase
                .from('stock_transfers')
                .insert({
                    transfer_number: transferNumber,
                    from_location_id: transfer.from_location_id,
                    to_location_id: transfer.to_location_id,
                    transfer_date: transfer.transfer_date,
                    notes: transfer.notes,
                    status: 'DRAFT',
                })
                .select()
                .single()

            if (transferError) throw transferError

            // Create transfer items
            const items = transfer.items.map(item => ({
                transfer_id: transferData.id,
                product_id: item.product_id,
                quantity_requested: item.quantity_requested,
                unit_cost: item.unit_cost,
            }))

            const { error: itemsError } = await supabase
                .from('stock_transfer_items')
                .insert(items)

            if (itemsError) throw itemsError

            return transferData
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stock-transfers'] })
        },
    })
}

// Update transfer status
export function useUpdateTransferStatus() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            id,
            status,
            quantities,
        }: {
            id: string
            status: string
            quantities?: { [itemId: string]: number }
        }) => {
            const { data: transfer, error: fetchError } = await supabase
                .from('stock_transfers')
                .select('*, stock_transfer_items(*)')
                .eq('id', id)
                .single()

            if (fetchError) throw fetchError

            // Update transfer status
            const { error: updateError } = await supabase
                .from('stock_transfers')
                .update({ status })
                .eq('id', id)

            if (updateError) throw updateError

            // If completing, update quantities and create inventory transactions
            if (status === 'COMPLETED') {
                console.log('🔄 Starting inventory updates for COMPLETED transfer:', id)
                console.log('Transfer items:', transfer.stock_transfer_items)

                for (const item of transfer.stock_transfer_items) {
                    const quantityReceived = (quantities && quantities[item.id]) || item.quantity_requested

                    console.log(`📦 Processing item ${item.id}:`, {
                        product_id: item.product_id,
                        from_location: transfer.from_location_id,
                        to_location: transfer.to_location_id,
                        quantity: quantityReceived
                    })

                    // Update item quantities
                    await supabase
                        .from('stock_transfer_items')
                        .update({
                            quantity_sent: item.quantity_requested,
                            quantity_received: quantityReceived,
                        })
                        .eq('id', item.id)

                    // Reduce stock at FROM location
                    const { data: fromStock, error: fromStockError } = await supabase
                        .from('inventory_stock')
                        .select('quantity_on_hand, quantity_available, average_cost')
                        .eq('product_id', item.product_id)
                        .eq('location_id', transfer.from_location_id)
                        .single()

                    if (fromStockError) {
                        console.error('Error fetching FROM stock:', fromStockError)
                        throw new Error(`Failed to fetch FROM location stock: ${fromStockError.message}`)
                    }

                    if (fromStock) {
                        const newQuantity = fromStock.quantity_on_hand - item.quantity_requested
                        const { error: updateFromError } = await supabase
                            .from('inventory_stock')
                            .update({
                                quantity_on_hand: newQuantity,
                                quantity_available: newQuantity, // Will be stored after migration
                                total_value: newQuantity * (fromStock.average_cost || 0),
                                last_updated: new Date().toISOString()
                            })
                            .eq('product_id', item.product_id)
                            .eq('location_id', transfer.from_location_id)

                        if (updateFromError) {
                            console.error('Error updating FROM stock:', updateFromError)
                            throw new Error(`Failed to update FROM location stock: ${updateFromError.message}`)
                        }
                    }

                    // Increase stock at TO location
                    const { data: toStock, error: toStockError } = await supabase
                        .from('inventory_stock')
                        .select('quantity_on_hand, quantity_available, average_cost')
                        .eq('product_id', item.product_id)
                        .eq('location_id', transfer.to_location_id)
                        .single()

                    // Ignore "not found" errors for TO location (we'll create it)
                    if (toStockError && toStockError.code !== 'PGRST116') {
                        console.error('Error fetching TO stock:', toStockError)
                        throw new Error(`Failed to fetch TO location stock: ${toStockError.message}`)
                    }

                    if (toStock) {
                        const newQuantity = toStock.quantity_on_hand + quantityReceived
                        const { error: updateToError } = await supabase
                            .from('inventory_stock')
                            .update({
                                quantity_on_hand: newQuantity,
                                quantity_available: newQuantity,
                                total_value: newQuantity * (toStock.average_cost || 0),
                                last_updated: new Date().toISOString()
                            })
                            .eq('product_id', item.product_id)
                            .eq('location_id', transfer.to_location_id)

                        if (updateToError) {
                            console.error('Error updating TO stock:', updateToError)
                            throw new Error(`Failed to update TO location stock: ${updateToError.message}`)
                        }
                    } else {
                        // Create new record for TO location
                        const { error: insertError } = await supabase
                            .from('inventory_stock')
                            .insert({
                                product_id: item.product_id,
                                location_id: transfer.to_location_id,
                                quantity_on_hand: quantityReceived,
                                quantity_available: quantityReceived,
                                average_cost: item.unit_cost,
                                total_value: quantityReceived * item.unit_cost,
                                last_updated: new Date().toISOString()
                            })

                        if (insertError) {
                            console.error('Error inserting TO stock:', insertError)
                            throw new Error(`Failed to create TO location stock: ${insertError.message}`)
                        }
                    }

                    console.log(`✅ Successfully updated inventory for item ${item.id}`)

                    // Fetch transaction types
                    const { data: outType } = await supabase.from('transaction_types').select('id').eq('code', 'TRANSFER_OUT').single()
                    const { data: inType } = await supabase.from('transaction_types').select('id').eq('code', 'TRANSFER_IN').single()

                    // Create inventory transactions
                    if (outType && inType) {
                        await supabase.from('inventory_transactions').insert([
                            {
                                transaction_type_id: outType.id,
                                transaction_number: `${transfer.transfer_number}-OUT`,
                                product_id: item.product_id,
                                from_location_id: transfer.from_location_id,
                                to_location_id: transfer.to_location_id,
                                quantity: item.quantity_requested,
                                unit_cost: item.unit_cost,
                                reference_type: 'TRANSFER',
                                reference_id: transfer.id,
                                reference_number: transfer.transfer_number,
                            },
                            {
                                transaction_type_id: inType.id,
                                transaction_number: `${transfer.transfer_number}-IN`,
                                product_id: item.product_id,
                                from_location_id: transfer.from_location_id,
                                to_location_id: transfer.to_location_id,
                                quantity: quantityReceived,
                                unit_cost: item.unit_cost,
                                reference_type: 'TRANSFER',
                                reference_id: transfer.id,
                                reference_number: transfer.transfer_number,
                            },
                        ])
                    }
                }
            }

            return { id, status }
        },
        onSuccess: () => {
            console.log('🔄 Invalidating queries: stock-transfers and inventory-stock')
            queryClient.invalidateQueries({ queryKey: ['stock-transfers'] })
            queryClient.invalidateQueries({ queryKey: ['inventory-stock'] })
            console.log('✅ Queries invalidated - UI should refresh')
        },
    })
}

// Delete transfer (only if DRAFT)
export function useDeleteTransfer() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            // Check status first
            const { data: transfer } = await supabase
                .from('stock_transfers')
                .select('status')
                .eq('id', id)
                .single()

            if (transfer?.status !== 'DRAFT') {
                throw new Error('Can only delete draft transfers')
            }

            const { error } = await supabase
                .from('stock_transfers')
                .delete()
                .eq('id', id)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stock-transfers'] })
        },
    })
}
