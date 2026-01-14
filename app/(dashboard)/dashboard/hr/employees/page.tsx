'use client'

import { useState } from 'react'
import { Plus, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PermissionGuard } from '@/components/permission-guard'
import { EmployeesTable } from '@/components/hr/employees/employees-table'
import { EmployeeDialog } from '../../../../../components/hr/employees/employee-dialog'

export default function EmployeesPage() {
    const [searchQuery, setSearchQuery] = useState('')
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    return (
        <PermissionGuard permission="hr.employees.read">
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Employee Master</h2>
                        <p className="text-muted-foreground">
                            Manage your workforce, departments, and payroll settings.
                        </p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <PermissionGuard permission="hr.employees.create">
                            <Button onClick={() => setIsDialogOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" /> Add Employee
                            </Button>
                        </PermissionGuard>
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search employees..."
                            className="pl-8"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <EmployeesTable searchQuery={searchQuery} />

                <EmployeeDialog
                    open={isDialogOpen}
                    onOpenChange={setIsDialogOpen}
                />
            </div>
        </PermissionGuard>
    )
}
