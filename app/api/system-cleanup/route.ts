
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
    try {
        // 1. Verify User is Authenticated (Safety Check)
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 2. Use Admin Client to Bypass RLS
        const adminSupabase = await createAdminClient()

        console.log('🧹 [API] Starting Admin Cleanup...')
        const logs: string[] = []

        // --- PRODUCTS & DEPENDENCIES ---
        const { data: staleProducts } = await adminSupabase.from('products').select('id').ilike('sku', 'TEST-%')

        if (staleProducts?.length) {
            const ids = staleProducts.map(p => p.id)

            // Delete dependencies (ignoring errors, just trying best effort)
            await adminSupabase.from('inventory_transactions').delete().in('product_id', ids)
            await adminSupabase.from('inventory_stock').delete().in('product_id', ids)
            await adminSupabase.from('stock_transfer_items').delete().in('product_id', ids)
            await adminSupabase.from('stock_adjustment_items').delete().in('product_id', ids)

            // Delete products
            const { error } = await adminSupabase.from('products').delete().in('id', ids)
            if (error) {
                logs.push(`❌ Failed to delete products: ${error.message}`)
            } else {
                logs.push(`✅ Deleted ${ids.length} stale products`)
            }
        }

        // --- TRANSFERS ---
        const { data: staleTransfers } = await adminSupabase.from('stock_transfers').select('id').ilike('transfer_number', 'TEST-TRF-%')
        if (staleTransfers?.length) {
            const ids = staleTransfers.map(t => t.id)
            await adminSupabase.from('stock_transfer_items').delete().in('transfer_id', ids)
            const { error } = await adminSupabase.from('stock_transfers').delete().in('id', ids)
            if (!error) logs.push(`✅ Deleted ${ids.length} stale transfers`)
        }

        // --- ADJUSTMENTS ---
        const { data: staleAdjustments } = await adminSupabase.from('stock_adjustments').select('id').ilike('adjustment_number', 'TEST-ADJ-%')
        if (staleAdjustments?.length) {
            const ids = staleAdjustments.map(a => a.id)
            await adminSupabase.from('stock_adjustment_items').delete().in('adjustment_id', ids)
            const { error } = await adminSupabase.from('stock_adjustments').delete().in('id', ids)
            if (!error) logs.push(`✅ Deleted ${ids.length} stale adjustments`)
        }

        console.log('🧹 [API] Cleanup Complete', logs)
        return NextResponse.json({ success: true, logs })

    } catch (error: any) {
        console.error('API Cleanup Failed:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
