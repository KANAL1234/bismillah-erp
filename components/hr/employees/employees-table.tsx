'use client'

import { Edit, Trash2, Award, MoreVertical } from 'lucide-react'
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

    const handleDeactivate = async (id: string) => {
        if (!confirm('Are you sure you want to deactivate this employee?')) return

        try {
            await updateEmployee.mutateAsync({
                id,
                employment_status: 'INACTIVE',
                leaving_date: new Date().toISOString().split('T')[0],
            })
            toast.success('Employee deactivated')
        } catch (error) {
            toast.error('Failed to deactivate employee')
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
                                        <div className="font-medium">{employee.full_name}</div>
                                        <div className="text-xs text-muted-foreground">
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
                                        <Badge variant="outline" className="gap-1">
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
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <PermissionGuard permission="hr.employees.update">
                                                <DropdownMenuItem onClick={() => setEditingEmployee(employee)}>
                                                    <Edit className="mr-2 h-4 w-4" /> Edit Details
                                                </DropdownMenuItem>
                                            </PermissionGuard>
                                            <PermissionGuard permission="hr.employees.delete">
                                                <DropdownMenuItem
                                                    className="text-destructive"
                                                    onClick={() => handleDeactivate(employee.id)}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" /> Deactivate
                                                </DropdownMenuItem>
                                            </PermissionGuard>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
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
        </>
    )
}
