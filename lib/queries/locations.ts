import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { LocationWithType } from '@/lib/types/database'

const supabase = createClient()

// Get all locations
export function useLocations() {
    return useQuery({
        queryKey: ['locations'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('locations')
                .select(`
          *,
          location_types(id, name, description)
        `)
                .eq('is_active', true)
                .order('code')

            if (error) throw error
            return data as LocationWithType[]
        },
    })
}

// Get locations by type
export function useLocationsByType(type: 'warehouse' | 'store' | 'vehicle') {
    return useQuery({
        queryKey: ['locations', 'type', type],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('locations')
                .select(`
          *,
          location_types!inner(id, name, description)
        `)
                .eq('location_types.name', type)
                .eq('is_active', true)
                .order('code')

            if (error) throw error
            return data as LocationWithType[]
        },
    })
}
