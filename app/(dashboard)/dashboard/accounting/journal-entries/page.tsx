'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useJournalEntries, usePostJournalEntry } from '@/lib/queries/journal-entries'
import { PermissionGuard } from '@/components/permission-guard'
import { FileText, Plus, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

export default function JournalEntriesPage() {
    return (
        <PermissionGuard permission="accounting.journal_entries.read">
            <JournalEntriesContent />
        </PermissionGuard>
    )
}

function JournalEntriesContent() {
    const { data: entries, isLoading } = useJournalEntries()
    const postEntry = usePostJournalEntry()

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            'draft': 'bg-yellow-100 text-yellow-800',
            'posted': 'bg-green-100 text-green-800',
            'cancelled': 'bg-red-100 text-red-800'
        }
        return colors[status] || 'bg-gray-100 text-gray-800'
    }

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            'OPENING': 'Opening',
            'MANUAL': 'Manual',
            'AUTO': 'Automatic',
            'ADJUSTMENT': 'Adjustment',
            'CLOSING': 'Closing'
        }
        return labels[type] || type
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Journal Entries</h1>
                    <p className="text-muted-foreground">View and manage general ledger postings</p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/accounting/journal-entries/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Journal Entry
                    </Link>
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{entries?.length || 0}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Posted</CardTitle>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {entries?.filter(e => e.status === 'posted').length || 0}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Draft</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {entries?.filter(e => e.status === 'draft').length || 0}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Journal Entries</CardTitle>
                    <CardDescription>View all general ledger postings</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading entries...</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Journal #</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Narration</TableHead>
                                    <TableHead className="text-right">Debit</TableHead>
                                    <TableHead className="text-right">Credit</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {entries?.map((entry) => (
                                    <TableRow key={entry.id}>
                                        <TableCell className="font-mono font-medium">{entry.journal_number}</TableCell>
                                        <TableCell>{format(new Date(entry.journal_date), 'MMM dd, yyyy')}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{getTypeLabel(entry.journal_type)}</Badge>
                                        </TableCell>
                                        <TableCell className="max-w-xs truncate">{entry.narration}</TableCell>
                                        <TableCell className="text-right font-mono">
                                            PKR {entry.total_debit.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            PKR {entry.total_credit.toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={getStatusBadge(entry.status)} variant="outline">
                                                {entry.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {entry.status === 'draft' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => postEntry.mutate(entry.id)}
                                                    disabled={postEntry.isPending}
                                                >
                                                    Post
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
