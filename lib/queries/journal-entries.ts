import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { JournalEntry, JournalEntryLine } from '@/lib/types/database'
import { toast } from 'sonner'

export type JournalEntryWithLines = JournalEntry & {
    journal_entry_lines: (JournalEntryLine & {
        chart_of_accounts: { account_code: string, account_name: string }
    })[]
}

export function useJournalEntries() {
    return useQuery({
        queryKey: ['journal-entries'],
        queryFn: async () => {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('journal_entries')
                .select(`
                    *,
                    journal_entry_lines (
                        *,
                        chart_of_accounts (account_code, account_name)
                    )
                `)
                .order('journal_date', { ascending: false })

            if (error) throw error
            return data as JournalEntryWithLines[]
        }
    })
}

export function useJournalEntry(id: string) {
    return useQuery({
        queryKey: ['journal-entry', id],
        queryFn: async () => {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('journal_entries')
                .select(`
                    *,
                    journal_entry_lines (
                        *,
                        chart_of_accounts (account_code, account_name)
                    )
                `)
                .eq('id', id)
                .single()

            if (error) throw error
            return data as JournalEntryWithLines
        },
        enabled: !!id
    })
}

export function useCreateJournalEntry() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            entry,
            lines
        }: {
            entry: Partial<JournalEntry>,
            lines: Partial<JournalEntryLine>[]
        }) => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            // Get fiscal year
            const { data: fiscalYear } = await supabase
                .from('fiscal_years')
                .select('id')
                .eq('is_closed', false)
                .single()

            // Generate journal number
            const { data: lastEntry } = await supabase
                .from('journal_entries')
                .select('journal_number')
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            let nextNumber = 'JE-0001'
            if (lastEntry) {
                const lastNum = parseInt(lastEntry.journal_number.split('-')[1])
                nextNumber = `JE-${String(lastNum + 1).padStart(4, '0')}`
            }

            // Calculate totals
            const totalDebit = lines.reduce((sum, line) => sum + (line.debit_amount || 0), 0)
            const totalCredit = lines.reduce((sum, line) => sum + (line.credit_amount || 0), 0)

            if (Math.abs(totalDebit - totalCredit) > 0.01) {
                throw new Error('Journal entry is not balanced. Debits must equal credits.')
            }

            // Create journal entry
            const { data: journalEntry, error: entryError } = await supabase
                .from('journal_entries')
                .insert({
                    ...entry,
                    journal_number: nextNumber,
                    fiscal_year_id: fiscalYear?.id,
                    total_debit: totalDebit,
                    total_credit: totalCredit,
                    created_by: user.id,
                    status: entry.status || 'draft'
                })
                .select()
                .single()

            if (entryError) throw entryError

            // Create journal entry lines
            const journalLines = lines.map(line => ({
                ...line,
                journal_entry_id: journalEntry.id
            }))

            const { error: linesError } = await supabase
                .from('journal_entry_lines')
                .insert(journalLines)

            if (linesError) throw linesError

            return journalEntry
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
            toast.success('Journal entry created successfully')
        },
        onError: (error: any) => {
            toast.error('Failed to create journal entry: ' + error.message)
        }
    })
}

export function usePostJournalEntry() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const { data, error } = await supabase
                .from('journal_entries')
                .update({
                    status: 'posted',
                    posted_at: new Date().toISOString(),
                    posted_by: user.id
                })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error

            // Update account balances
            await supabase.rpc('update_account_balances')

            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
            queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] })
            toast.success('Journal entry posted successfully')
        },
        onError: (error: any) => {
            toast.error('Failed to post journal entry: ' + error.message)
        }
    })
}
