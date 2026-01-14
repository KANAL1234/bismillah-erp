
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
        const { data: staleProducts } = await adminSupabase.from('products').select('id')
            .or('sku.ilike.TEST-%,name.ilike.TEST-%,sku.ilike.HEALTH-TEST-%,name.ilike.HEALTH-TEST-%')

        if (staleProducts?.length) {
            const ids = staleProducts.map(p => p.id)
            await adminSupabase.from('inventory_transactions').delete().in('product_id', ids)
            await adminSupabase.from('inventory_stock').delete().in('product_id', ids)
            await adminSupabase.from('stock_transfer_items').delete().in('product_id', ids)
            await adminSupabase.from('stock_adjustment_items').delete().in('product_id', ids)
            await adminSupabase.from('pos_sale_items').delete().in('product_id', ids)
            await adminSupabase.from('customer_invoice_items_accounting').delete().in('product_id', ids)
            await adminSupabase.from('vendor_bill_items').delete().in('product_id', ids)
            await adminSupabase.from('sales_order_items').delete().in('product_id', ids)
            await adminSupabase.from('purchase_order_items').delete().in('product_id', ids)

            const { error } = await adminSupabase.from('products').delete().in('id', ids)
            if (error) logs.push(`❌ Failed to delete products: ${error.message}`)
            else logs.push(`✅ Deleted ${ids.length} stale products`)
        }

        // --- CUSTOMERS & VENDORS ---
        const { data: staleCust } = await adminSupabase.from('customers').select('id')
            .or('name.ilike.TEST-%,customer_code.ilike.TEST-%,name.ilike.HEALTH-TEST-%,customer_code.ilike.HEALTH-TEST-%')
        if (staleCust?.length) {
            const ids = staleCust.map(c => c.id)
            await adminSupabase.from('pos_sales').delete().in('customer_id', ids)
            await adminSupabase.from('customer_invoices_accounting').delete().in('customer_id', ids)
            await adminSupabase.from('sales_orders').delete().in('customer_id', ids)
            await adminSupabase.from('receipt_vouchers').delete().in('customer_id', ids)
            const { error } = await adminSupabase.from('customers').delete().in('id', ids)
            if (!error) logs.push(`✅ Deleted ${ids.length} stale customers`)
        }

        const { data: staleVendors } = await adminSupabase.from('vendors').select('id')
            .or('name.ilike.TEST-%,vendor_code.ilike.TEST-%,name.ilike.HEALTH-TEST-%,vendor_code.ilike.HEALTH-TEST-%')
        if (staleVendors?.length) {
            const ids = staleVendors.map(v => v.id)
            await adminSupabase.from('vendor_bills').delete().in('vendor_id', ids)
            await adminSupabase.from('purchase_orders').delete().in('vendor_id', ids)
            await adminSupabase.from('payment_vouchers').delete().in('vendor_id', ids)
            const { error } = await adminSupabase.from('vendors').delete().in('id', ids)
            if (!error) logs.push(`✅ Deleted ${ids.length} stale vendors`)
        }

        // --- TRANSFERS & ADJUSTMENTS ---
        const { data: staleTransfers } = await adminSupabase.from('stock_transfers').select('id').ilike('notes', '%TEST%')
        if (staleTransfers?.length) {
            const ids = staleTransfers.map(t => t.id)
            await adminSupabase.from('stock_transfer_items').delete().in('transfer_id', ids)
            await adminSupabase.from('stock_transfers').delete().in('id', ids)
            logs.push(`✅ Deleted ${ids.length} stale transfers`)
        }

        const { data: staleAdjustments } = await adminSupabase.from('stock_adjustments').select('id').ilike('reason', '%TEST%')
        if (staleAdjustments?.length) {
            const ids = staleAdjustments.map(a => a.id)
            await adminSupabase.from('stock_adjustment_items').delete().in('adjustment_id', ids)
            await adminSupabase.from('stock_adjustments').delete().in('id', ids)
            logs.push(`✅ Deleted ${ids.length} stale adjustments`)
        }

        // --- JOURNAL ENTRIES ---
        const { data: staleJE } = await adminSupabase.from('journal_entries').select('id').or('narration.ilike.%TEST%,reference_number.ilike.%TEST%')
        if (staleJE?.length) {
            const ids = staleJE.map(j => j.id)
            await adminSupabase.from('journal_entry_lines').delete().in('journal_entry_id', ids)
            const { error } = await adminSupabase.from('journal_entries').delete().in('id', ids)
            if (!error) logs.push(`✅ Deleted ${ids.length} stale journal entries`)
        }

        // --- ROLES & PERMISSIONS (Optional/Safety) ---
        const { data: staleRoles } = await adminSupabase.from('roles').select('id').ilike('role_name', 'HEALTH-TEST-%')
        if (staleRoles?.length) {
            const ids = staleRoles.map(r => r.id)
            await adminSupabase.from('role_permissions').delete().in('role_id', ids)
            await adminSupabase.from('user_roles').delete().in('role_id', ids)
            await adminSupabase.from('roles').delete().in('id', ids)
            logs.push(`✅ Deleted ${ids.length} stale test roles`)
        }

        console.log('🧹 [API] Cleanup Complete', logs)
        return NextResponse.json({ success: true, logs })

    } catch (error: any) {
        console.error('API Cleanup Failed:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
