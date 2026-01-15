'use client'

import { Pencil, Trash2, Award } from 'lucide-react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useEmployees, useUpdateEmployee } from '@/lib/queries/hr'
import { PermissionGuard } from '@/components/permission-guard'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { EmployeeDialog } from './employee-dialog'
import { useState } from 'react'

interface EmployeesTableProps {
    searchQuery: string
}

export function EmployeesTable({ searchQuery }: EmployeesTableProps) {
    const { data: employees, isLoading } = useEmployees()
    const updateEmployee = useUpdateEmployee()
    const [editingEmployee, setEditingEmployee] = useState<any>(null)
    const [deactivatingEmployee, setDeactivatingEmployee] = useState<any>(null)

    const filteredEmployees = employees?.filter((employee) => {
        const matchesSearch =
            employee.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            employee.employee_code.toLowerCase().includes(searchQuery.toLowerCase())
        return matchesSearch
    })

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return 'success'
            case 'ON_LEAVE':
                return 'warning'
            case 'PROBATION':
                return 'secondary'
            case 'INACTIVE':
            case 'TERMINATED':
                return 'destructive'
            default:
                return 'outline'
        }
    }

    const handleDeactivate = async () => {
        if (!deactivatingEmployee) return

        try {
            await updateEmployee.mutateAsync({
                id: deactivatingEmployee.id,
                employment_status: 'INACTIVE',
                leaving_date: new Date().toISOString().split('T')[0],
            })
            toast.success('Employee deactivated')
        } catch (error) {
            toast.error('Failed to deactivate employee')
        } finally {
            setDeactivatingEmployee(null)
        }
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                ))}
            </div>
        )
    }

    return (
        <>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Designation</TableHead>
                            <TableHead className="text-right">Basic Salary</TableHead>
                            <TableHead className="text-center">Commission</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredEmployees?.map((employee) => (
                            <TableRow key={employee.id}>
                                <TableCell>
                                    <div>
                                        <div className="font-medium text-slate-900">{employee.full_name}</div>
                                        <div className="text-xs text-muted-foreground font-mono">
                                            {employee.employee_code}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {employee.department?.name || '-'}
                                </TableCell>
                                <TableCell>{employee.designation}</TableCell>
                                <TableCell className="text-right font-medium">
                                    {formatCurrency(Number(employee.basic_salary))}
                                </TableCell>
                                <TableCell className="text-center">
                                    {employee.commission_rate ? (
                                        <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-700">
                                            <Award className="h-3 w-3" />
                                            {employee.commission_rate}%
                                        </Badge>
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge variant={getStatusColor(employee.employment_status) as any}>
                                        {employee.employment_status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <PermissionGuard permission="hr:employees:update">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                                onClick={() => setEditingEmployee(employee)}
                                                title="Edit Employee"
                                            >
                                                <Pencil className="h-4 w-4" />
                                                <span className="sr-only">Edit</span>
                                            </Button>
                                        </PermissionGuard>
                                        <PermissionGuard permission="hr:employees:delete">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => setDeactivatingEmployee(employee)}
                                                title="Deactivate Employee"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                <span className="sr-only">Deactivate</span>
                                            </Button>
                                        </PermissionGuard>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {filteredEmployees?.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    No employees found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <EmployeeDialog
                open={!!editingEmployee}
                onOpenChange={(open: boolean) => !open && setEditingEmployee(null)}
                employee={editingEmployee}
            />

            <AlertDialog open={!!deactivatingEmployee} onOpenChange={(open) => !open && setDeactivatingEmployee(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate Employee?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to deactivate <strong>{deactivatingEmployee?.full_name}</strong>?
                            This will mark them as inactive and they will no longer be able to perform actions in the system.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={handleDeactivate}
                            disabled={updateEmployee.isPending}
                        >
                            {updateEmployee.isPending ? 'Deactivating...' : 'Deactivate'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
