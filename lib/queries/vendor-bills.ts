import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { VendorBill } from '@/lib/types/database'
import { toast } from 'sonner'

export function useVendorBills() {
    return useQuery({
        queryKey: ['vendor-bills'],
        queryFn: async () => {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('vendor_bills')
                .select(`
                    *,
                    vendors (id, name, vendor_code)
                `)
                .order('bill_date', { ascending: false })

            if (error) throw error
            return data
        }
    })
}

export function useCreateVendorBill() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (bill: Partial<VendorBill>) => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            // Generate bill number
            const { data: lastBill } = await supabase
                .from('vendor_bills')
                .select('bill_number')
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            let nextNumber = 'VB-0001'
            if (lastBill) {
                const lastNum = parseInt(lastBill.bill_number.split('-')[1])
                nextNumber = `VB-${String(lastNum + 1).padStart(4, '0')}`
            }

            const { data, error } = await supabase
                .from('vendor_bills')
                .insert({
                    ...bill,
                    bill_number: nextNumber,
                    created_by: user.id
                })
                .select()
                .single()

            if (error) throw error

            // Auto-post to GL if approved
            if (bill.status === 'approved') {
                await supabase.rpc('post_vendor_bill', { p_bill_id: data.id })
            }

            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendor-bills'] })
            toast.success('Vendor bill created successfully')
        },
        onError: (error: any) => {
            toast.error('Failed to create vendor bill: ' + error.message)
        }
    })
}

export function useApproveVendorBill() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const { data, error } = await supabase
                .from('vendor_bills')
                .update({
                    status: 'approved',
                    approved_by: user.id
                })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error

            // Auto-post to GL
            await supabase.rpc('post_vendor_bill', { p_bill_id: id })

            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendor-bills'] })
            queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
            toast.success('Vendor bill approved and posted to GL')
        },
        onError: (error: any) => {
            toast.error('Failed to approve vendor bill: ' + error.message)
        }
    })
}
