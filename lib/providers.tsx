'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { AuthProvider } from '@/components/providers/auth-provider'
import { LocationProvider } from '@/components/providers/location-provider'

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
                gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache
                refetchOnWindowFocus: false, // Don't refetch when tab regains focus
                retry: 1, // Only retry once on failure
            },
        },
    }))

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <LocationProvider>
                    {children}
                </LocationProvider>
            </AuthProvider>
        </QueryClientProvider>
    )
}
