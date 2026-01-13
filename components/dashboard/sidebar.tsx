'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    Truck,
    Calculator,
    ChevronRight,
    ChevronDown
} from 'lucide-react'
import { useState } from 'react'

export function Sidebar() {
    const pathname = usePathname()
    const [expandedSections, setExpandedSections] = useState<string[]>(['sales', 'inventory', 'procurement', 'accounting'])

    const toggleSection = (section: string) => {
        setExpandedSections(prev =>
            prev.includes(section)
                ? prev.filter(s => s !== section)
                : [...prev, section]
        )
    }

    const isActive = (path: string) => pathname?.startsWith(path)

    return (
        <div className="flex h-full w-64 flex-col border-r bg-slate-50">
            {/* Logo/Brand */}
            <div className="flex h-16 items-center border-b px-6">
                <h1 className="text-xl font-bold text-slate-900">Bismillah ERP</h1>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 overflow-y-auto p-4">
                {/* Dashboard */}
                <Link
                    href="/dashboard"
                    className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        pathname === '/dashboard'
                            ? "bg-slate-900 text-white"
                            : "text-slate-700 hover:bg-slate-200"
                    )}
                >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                </Link>

                {/* Sales & POS */}
                <div>
                    <button
                        onClick={() => toggleSection('sales')}
                        className={cn(
                            "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            isActive('/dashboard/pos') || isActive('/dashboard/sales')
                                ? "bg-slate-200 text-slate-900"
                                : "text-slate-700 hover:bg-slate-200"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <ShoppingCart className="h-4 w-4" />
                            Sales & POS
                        </div>
                        {expandedSections.includes('sales') ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronRight className="h-4 w-4" />
                        )}
                    </button>
                    {expandedSections.includes('sales') && (
                        <div className="ml-4 mt-1 space-y-1 border-l pl-4">
                            <Link href="/dashboard/pos" className={cn("block rounded px-3 py-1.5 text-sm", pathname === '/dashboard/pos' ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                POS Terminal
                            </Link>
                            <Link href="/dashboard/pos/history" className={cn("block rounded px-3 py-1.5 text-sm", pathname === '/dashboard/pos/history' ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Sales History
                            </Link>
                            <Link href="/dashboard/pos/closing" className={cn("block rounded px-3 py-1.5 text-sm", pathname === '/dashboard/pos/closing' ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Daily Closing
                            </Link>
                            <div className="my-2 border-t"></div>
                            <Link href="/dashboard/sales/quotations" className={cn("block rounded px-3 py-1.5 text-sm", pathname?.startsWith('/dashboard/sales/quotations') ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Quotations
                            </Link>
                            <Link href="/dashboard/sales/orders" className={cn("block rounded px-3 py-1.5 text-sm", pathname?.startsWith('/dashboard/sales/orders') ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Sales Orders
                            </Link>
                            <Link href="/dashboard/sales/invoices" className={cn("block rounded px-3 py-1.5 text-sm", pathname?.startsWith('/dashboard/sales/invoices') ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Sales Invoices
                            </Link>
                            <Link href="/dashboard/sales/deliveries" className={cn("block rounded px-3 py-1.5 text-sm", pathname?.startsWith('/dashboard/sales/deliveries') ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Delivery Notes
                            </Link>
                            <Link href="/dashboard/sales/returns" className={cn("block rounded px-3 py-1.5 text-sm", pathname?.startsWith('/dashboard/sales/returns') ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Sales Returns
                            </Link>
                        </div>
                    )}
                </div>

                {/* Inventory */}
                <div>
                    <button
                        onClick={() => toggleSection('inventory')}
                        className={cn(
                            "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            isActive('/dashboard/inventory') || isActive('/dashboard/products')
                                ? "bg-slate-200 text-slate-900"
                                : "text-slate-700 hover:bg-slate-200"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <Package className="h-4 w-4" />
                            Inventory
                        </div>
                        {expandedSections.includes('inventory') ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronRight className="h-4 w-4" />
                        )}
                    </button>
                    {expandedSections.includes('inventory') && (
                        <div className="ml-4 mt-1 space-y-1 border-l pl-4">
                            <Link href="/dashboard/inventory" className={cn("block rounded px-3 py-1.5 text-sm", pathname === '/dashboard/inventory' ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Stock Overview
                            </Link>
                            <Link href="/dashboard/products" className={cn("block rounded px-3 py-1.5 text-sm", pathname === '/dashboard/products' ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Product List
                            </Link>
                            <div className="my-2 border-t"></div>
                            <Link href="/dashboard/inventory/transfers" className={cn("block rounded px-3 py-1.5 text-sm", pathname?.startsWith('/dashboard/inventory/transfers') ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Stock Transfers
                            </Link>
                            <Link href="/dashboard/inventory/adjustments" className={cn("block rounded px-3 py-1.5 text-sm", pathname?.startsWith('/dashboard/inventory/adjustments') ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Stock Adjustments
                            </Link>
                        </div>
                    )}
                </div>

                {/* Procurement */}
                <div>
                    <button
                        onClick={() => toggleSection('procurement')}
                        className={cn(
                            "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            isActive('/dashboard/purchases') || isActive('/dashboard/vendors')
                                ? "bg-slate-200 text-slate-900"
                                : "text-slate-700 hover:bg-slate-200"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <Truck className="h-4 w-4" />
                            Procurement
                        </div>
                        {expandedSections.includes('procurement') ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronRight className="h-4 w-4" />
                        )}
                    </button>
                    {expandedSections.includes('procurement') && (
                        <div className="ml-4 mt-1 space-y-1 border-l pl-4">
                            <Link href="/dashboard/vendors" className={cn("block rounded px-3 py-1.5 text-sm", pathname === '/dashboard/vendors' ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Vendor List
                            </Link>
                            <div className="my-2 border-t"></div>
                            <Link href="/dashboard/purchases/orders" className={cn("block rounded px-3 py-1.5 text-sm", pathname?.startsWith('/dashboard/purchases/orders') ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Purchase Orders
                            </Link>
                            <Link href="/dashboard/purchases/grn" className={cn("block rounded px-3 py-1.5 text-sm", pathname?.startsWith('/dashboard/purchases/grn') ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Goods Receipts (GRN)
                            </Link>
                        </div>
                    )}
                </div>

                {/* Accounting */}
                <div>
                    <button
                        onClick={() => toggleSection('accounting')}
                        className={cn(
                            "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            isActive('/dashboard/accounting') || isActive('/setup')
                                ? "bg-slate-200 text-slate-900"
                                : "text-slate-700 hover:bg-slate-200"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <Calculator className="h-4 w-4" />
                            Accounting
                        </div>
                        {expandedSections.includes('accounting') ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronRight className="h-4 w-4" />
                        )}
                    </button>
                    {expandedSections.includes('accounting') && (
                        <div className="ml-4 mt-1 space-y-1 border-l pl-4">
                            <Link href="/setup" className={cn("block rounded px-3 py-1.5 text-sm", pathname === '/setup' ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Setup Wizard
                            </Link>
                            <div className="my-2 border-t"></div>
                            <Link href="/dashboard/accounting/chart-of-accounts" className={cn("block rounded px-3 py-1.5 text-sm", pathname?.startsWith('/dashboard/accounting/chart-of-accounts') ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Chart of Accounts
                            </Link>
                            <Link href="/dashboard/accounting/bank-accounts" className={cn("block rounded px-3 py-1.5 text-sm", pathname?.startsWith('/dashboard/accounting/bank-accounts') ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Bank Accounts
                            </Link>
                            <Link href="/dashboard/accounting/journal-entries" className={cn("block rounded px-3 py-1.5 text-sm", pathname?.startsWith('/dashboard/accounting/journal-entries') ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Journal Entries
                            </Link>
                            <div className="my-2 border-t"></div>
                            <Link href="/dashboard/accounting/vendor-bills" className={cn("block rounded px-3 py-1.5 text-sm", pathname?.startsWith('/dashboard/accounting/vendor-bills') ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Vendor Bills
                            </Link>
                            <Link href="/dashboard/accounting/payment-vouchers" className={cn("block rounded px-3 py-1.5 text-sm", pathname?.startsWith('/dashboard/accounting/payment-vouchers') ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Payment Vouchers
                            </Link>
                            <div className="my-2 border-t"></div>
                            <Link href="/dashboard/accounting/customer-invoices" className={cn("block rounded px-3 py-1.5 text-sm", pathname?.startsWith('/dashboard/accounting/customer-invoices') ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Customer Invoices
                            </Link>
                            <Link href="/dashboard/accounting/receipt-vouchers" className={cn("block rounded px-3 py-1.5 text-sm", pathname?.startsWith('/dashboard/accounting/receipt-vouchers') ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Receipt Vouchers
                            </Link>
                            <div className="my-2 border-t"></div>
                            <Link href="/dashboard/accounting/reports/trial-balance" className={cn("block rounded px-3 py-1.5 text-sm", pathname === '/dashboard/accounting/reports/trial-balance' ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Trial Balance
                            </Link>
                            <Link href="/dashboard/accounting/reports/registers" className={cn("block rounded px-3 py-1.5 text-sm", pathname === '/dashboard/accounting/reports/registers' ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Transaction Registers
                            </Link>
                            <Link href="/dashboard/accounting/reports/financial" className={cn("block rounded px-3 py-1.5 text-sm", pathname === '/dashboard/accounting/reports/financial' ? "bg-slate-200 font-medium" : "text-slate-600 hover:bg-slate-100")}>
                                Financial Reports
                            </Link>
                        </div>
                    )}
                </div>
            </nav>
        </div>
    )
}
