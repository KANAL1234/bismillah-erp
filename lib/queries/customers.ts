import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Customer } from '@/lib/types/database'

const supabase = createClient()

// Get all customers
export function useCustomers() {
    return useQuery({
        queryKey: ['customers'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('is_active', true)
                .order('name')

            if (error) throw error
            return data as Customer[]
        },
    })
}

// Search customers
export function useSearchCustomers(searchQuery: string) {
    return useQuery({
        queryKey: ['customers', 'search', searchQuery],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('is_active', true)
                .or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,customer_code.ilike.%${searchQuery}%`)
                .limit(10)

            if (error) throw error
            return data as Customer[]
        },
        enabled: searchQuery.length >= 2,
    })
}

// Get single customer
export function useCustomer(id: string) {
    return useQuery({
        queryKey: ['customers', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            return data as Customer
        },
        enabled: !!id,
    })
}

// Create customer (quick add from POS)
export function useCreateCustomer() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (customer: Partial<Customer>) => {
            // Generate customer code
            const customerCode = `CUST-${Date.now()}`

            const { data, error } = await supabase
                .from('customers')
                .insert({
                    customer_code: customerCode,
                    customer_type: customer.customer_type || 'INDIVIDUAL',
                    name: customer.name,
                    phone: customer.phone,
                    credit_limit: customer.credit_limit || 0,
                    credit_days: customer.credit_days || 0,
                    is_active: true,
                })
                .select()
                .single()

            if (error) throw error
            return data as Customer
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] })
        },
    })
}
