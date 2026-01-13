import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { CustomerInvoiceAccounting } from '@/lib/types/database'
import { toast } from 'sonner'

export function useCustomerInvoices() {
    return useQuery({
        queryKey: ['customer-invoices-accounting'],
        queryFn: async () => {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('customer_invoices_accounting')
                .select(`
                    *,
                    customers (id, name, customer_code)
                `)
                .order('invoice_date', { ascending: false })

            if (error) throw error
            return data
        }
    })
}

export function useCreateCustomerInvoice() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (invoice: Partial<CustomerInvoiceAccounting>) => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            // Generate invoice number
            const { data: lastInvoice } = await supabase
                .from('customer_invoices_accounting')
                .select('invoice_number')
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            let nextNumber = 'CI-0001'
            if (lastInvoice) {
                const lastNum = parseInt(lastInvoice.invoice_number.split('-')[1])
                nextNumber = `CI-${String(lastNum + 1).padStart(4, '0')}`
            }

            const { data, error } = await supabase
                .from('customer_invoices_accounting')
                .insert({
                    ...invoice,
                    invoice_number: nextNumber,
                    created_by: user.id
                })
                .select()
                .single()

            if (error) throw error

            // Auto-post to GL if approved
            if (invoice.status === 'approved') {
                await supabase.rpc('post_customer_invoice', { p_invoice_id: data.id })
            }

            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customer-invoices-accounting'] })
            toast.success('Customer invoice created successfully')
        },
        onError: (error: any) => {
            toast.error('Failed to create customer invoice: ' + error.message)
        }
    })
}

export function useApproveCustomerInvoice() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const { data, error } = await supabase
                .from('customer_invoices_accounting')
                .update({ status: 'approved' })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error

            // Auto-post to GL
            await supabase.rpc('post_customer_invoice', { p_invoice_id: id })

            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customer-invoices-accounting'] })
            queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
            toast.success('Customer invoice approved and posted to GL')
        },
        onError: (error: any) => {
            toast.error('Failed to approve customer invoice: ' + error.message)
        }
    })
}
