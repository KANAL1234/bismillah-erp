'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle2, Circle, Play, RefreshCw, Terminal, ShieldCheck } from 'lucide-react'
import { ScrollArea } from '../../components/ui/scroll-area'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '../../components/ui/alert-dialog'

type TestStatus = 'pending' | 'running' | 'success' | 'failure' | 'skipped'

interface TestModule {
    id: string
    name: string
    description: string
    status: TestStatus
    logs: string[]
}

const INITIAL_MODULES: TestModule[] = [
    { id: 'db', name: '1. Database Connectivity', description: 'Check connection and public access', status: 'pending', logs: [] },
    { id: 'auth', name: '2. Authentication', description: 'Verify session and permissions', status: 'pending', logs: [] },
    { id: 'products', name: '3. Products Module', description: 'Full CRUD lifecycle (Create, Read, Update, Delete)', status: 'pending', logs: [] },
    { id: 'inventory', name: '4. Inventory Core', description: 'Stock initialization and tracking', status: 'pending', logs: [] },
    { id: 'transfers', name: '5. Stock Transfers', description: 'Transfer workflow validation', status: 'pending', logs: [] },
    { id: 'adjustments', name: '6. Stock Adjustments', description: 'Cycle Count & Damage workflows', status: 'pending', logs: [] },
]

export default function SystemHealthPage() {
    const [modules, setModules] = useState<TestModule[]>(INITIAL_MODULES)
    const [isRunning, setIsRunning] = useState(false)
    const [currentTestId, setCurrentTestId] = useState<string | null>(null)
    const [showConfirm, setShowConfirm] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)
    const supabase = createClient()

    // Auto-scroll logs
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [modules])

    const updateModule = (id: string, updates: Partial<TestModule>) => {
        setModules(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m))
    }

    const log = (id: string, message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
        const prefix = type === 'success' ? '✅ ' : type === 'error' ? '❌ ' : type === 'warn' ? '⚠️ ' : 'ℹ️ '
        const timestamp = new Date().toLocaleTimeString([], { hour12: false })
        setModules(prev => prev.map(m => {
            if (m.id === id) {
                return { ...m, logs: [...m.logs, `[${timestamp}] ${prefix}${message}`] }
            }
            return m
        }))
    }

    const runTests = async () => {
        setShowConfirm(false)
        setIsRunning(true)
        setModules(INITIAL_MODULES) // Reset

        try {
            await cleanupStaleData() // Pre-test cleanup
            await runDatabaseTest()
            await runAuthTest()
            await runProductsLifecycleTest()
            await runInventoryTest()
            await runTransfersWorkflowTest()
            await runAdjustmentsWorkflowTest()
        } catch (error) {
            console.error('Global Test Error:', error)
        } finally {
            await cleanupStaleData() // Post-test cleanup (Catch anything missed)
            setIsRunning(false)
            setCurrentTestId(null)
        }
    }

    // --- UTILS ---
    const cleanupStaleData = async () => {
        log('db', '🧹 invoking server-side cleanup...', 'info')
        try {
            const response = await fetch('/api/system-cleanup', {
                method: 'POST',
            })

            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.error || 'API Request Failed')
            }

            const result = await response.json()
            result.logs.forEach((msg: string) => log('db', msg, msg.includes('❌') ? 'error' : 'success'))

        } catch (e: any) {
            console.error('Cleanup failed', e)
            log('db', `Cleanup API Failed: ${e.message}`, 'error')
        }
    }

    // --- 1. DATABASE TEST ---
    const runDatabaseTest = async () => {
        const id = 'db'
        setCurrentTestId(id)
        updateModule(id, { status: 'running' })
        log(id, 'Starting connectivity check...')

        try {
            const start = performance.now()
            const { error } = await supabase.from('products').select('count').single()
            if (error) throw error
            const duration = Math.round(performance.now() - start)

            log(id, `Connection OK (${duration}ms)`, 'success')
            updateModule(id, { status: 'success' })
        } catch (error: any) {
            log(id, `Connection Failed: ${error.message}`, 'error')
            updateModule(id, { status: 'failure' })
            throw error // Stop everything if DB is down
        }
    }

    // --- 2. AUTH TEST ---
    const runAuthTest = async () => {
        const id = 'auth'
        setCurrentTestId(id)
        updateModule(id, { status: 'running' })

        try {
            const { data: { user }, error } = await supabase.auth.getUser()
            if (error) throw error
            if (!user) throw new Error('No active session')

            log(id, `Authenticated as: ${user.email}`, 'success')
            log(id, `User ID: ${user.id}`)
            updateModule(id, { status: 'success' })
        } catch (error: any) {
            log(id, `Auth Error: ${error.message}`, 'error')
            updateModule(id, { status: 'failure' })
            throw error // Stop if not logged in
        }
    }

    // --- 3. PRODUCTS LIFECYCLE (CRUD) ---
    const runProductsLifecycleTest = async () => {
        const id = 'products'
        setCurrentTestId(id)
        updateModule(id, { status: 'running' })

        let testProductId: string | null = null

        try {
            // Setup
            const { data: cat } = await supabase.from('product_categories').select('id').limit(1).single()
            const { data: uom } = await supabase.from('units_of_measure').select('id').limit(1).single()
            if (!cat || !uom) throw new Error('Seed data missing (categories/units)')

            // CREATE
            const sku = `TEST-PRD-${Date.now()}`
            log(id, `Creating product: ${sku}`)
            const { data: product, error: createError } = await supabase.from('products').insert({
                name: 'System Health Test Product',
                sku: sku,
                category_id: cat.id,
                uom_id: uom.id,
                is_active: true,
                reorder_point: 10,
                reorder_quantity: 50,
                min_stock_level: 5
            }).select().single()

            if (createError) throw createError
            testProductId = product.id
            log(id, 'Create successful', 'success')

            // READ
            const { data: read, error: readError } = await supabase.from('products').select('*').eq('id', product.id).single()
            if (readError || !read) throw new Error('Read failed')
            log(id, 'Read verification successful', 'success')

            // UPDATE
            const { error: updateError } = await supabase.from('products').update({ name: 'UPDATED Test Product' }).eq('id', product.id)
            if (updateError) throw updateError
            log(id, 'Update successful', 'success')

            updateModule(id, { status: 'success' })

        } catch (error: any) {
            log(id, `Test Failed: ${error.message}`, 'error')
            updateModule(id, { status: 'failure' })
        } finally {
            // DELETE (Cleanup)
            if (testProductId) {
                log(id, 'Cleaning up...')
                await supabase.from('inventory_transactions').delete().eq('product_id', testProductId) // Just in case
                await supabase.from('products').delete().eq('id', testProductId)
                log(id, 'Test data deleted', 'success')
            }
        }
    }

    // --- 4. INVENTORY TEST ---
    const runInventoryTest = async () => {
        const id = 'inventory'
        setCurrentTestId(id)
        updateModule(id, { status: 'running' })

        let testProductId: string | null = null

        try {
            // Get Deps
            const { data: cat } = await supabase.from('product_categories').select('id').limit(1).single()
            const { data: uom } = await supabase.from('units_of_measure').select('id').limit(1).single()
            const { data: loc } = await supabase.from('locations').select('id, name').limit(1).single()
            if (!cat || !uom || !loc) throw new Error('Missing dependencies')

            // Create Temp Product
            const sku = `TEST-INV-${Date.now()}`
            const { data: product } = await supabase.from('products').insert({
                name: 'Inventory Test Product',
                sku: sku, category_id: cat.id, uom_id: uom.id, is_active: true, reorder_point: 0, reorder_quantity: 0, min_stock_level: 0
            }).select().single()

            if (!product) throw new Error('Failed to create temp product')
            testProductId = product.id

            // Initialize Stock
            log(id, `Initializing stock for ${product.sku} at ${loc.name}`)
            const { error: initError } = await supabase.from('inventory_stock').insert({
                product_id: product.id,
                location_id: loc.id,
                quantity_on_hand: 100,
                quantity_available: 100,
                quantity_reserved: 0,
                average_cost: 50,
                total_value: 5000,
                last_updated: new Date().toISOString()
            })
            if (initError) throw initError
            log(id, 'Stock initialized (100 qty)', 'success')

            // Verify Read
            const { data: stock } = await supabase.from('inventory_stock').select('*')
                .eq('product_id', product.id).eq('location_id', loc.id).single()

            if (!stock || stock.quantity_on_hand !== 100) throw new Error('Stock verification failed')

            updateModule(id, { status: 'success' })

        } catch (error: any) {
            log(id, `Inventory Test Failed: ${error.message}`, 'error')
            updateModule(id, { status: 'failure' })
        } finally {
            if (testProductId) {
                // Cleanup
                await supabase.from('inventory_stock').delete().eq('product_id', testProductId)
                await supabase.from('inventory_transactions').delete().eq('product_id', testProductId) // Add this
                await supabase.from('products').delete().eq('id', testProductId)
                log(id, 'Cleanup complete')
            }
        }
    }

    // --- 5. TRANSFERS TEST ---
    const runTransfersTest = async () => { /* Alias for compatibility */ await runTransfersWorkflowTest() }

    // RENAMED TO MATCH INTERFACE
    const runTransfersWorkflowTest = async () => {
        const id = 'transfers'
        setCurrentTestId(id)
        updateModule(id, { status: 'running' })

        let testProductId: string | null = null
        let transferId: string | null = null

        try {
            // Need 2 locations
            const { data: locs } = await supabase.from('locations').select('id, name').limit(2)
            if (locs?.length !== 2) {
                log(id, 'Skipping: Need 2 locations', 'warn')
                updateModule(id, { status: 'skipped' })
                return
            }
            // Get Metadata
            const { data: cat } = await supabase.from('product_categories').select('id').limit(1).single()
            const { data: uom } = await supabase.from('units_of_measure').select('id').limit(1).single()

            // Create Product & Stock at Loc 1
            const { data: product } = await supabase.from('products').insert({
                name: 'Transfer Test Item', sku: `TEST-TRF-ITEM-${Date.now()}`,
                category_id: cat?.id, uom_id: uom?.id, is_active: true, reorder_point: 0, reorder_quantity: 0, min_stock_level: 0
            }).select().single()

            if (!product) throw new Error('Product creation failed')
            testProductId = product.id

            await supabase.from('inventory_stock').insert({
                product_id: product.id, location_id: locs[0].id,
                quantity_on_hand: 50, quantity_available: 50, quantity_reserved: 0, average_cost: 10, total_value: 500, last_updated: new Date().toISOString()
            })

            // 1. Create Draft Transfer
            const trfNum = `TEST-TRF-${Date.now()}`
            log(id, `Creating transfer ${trfNum} (${locs[0].name} -> ${locs[1].name})`)
            const { data: trf, error: trfErr } = await supabase.from('stock_transfers').insert({
                transfer_number: trfNum, from_location_id: locs[0].id, to_location_id: locs[1].id, status: 'DRAFT', transfer_date: new Date().toISOString()
            }).select().single()
            if (trfErr) throw trfErr
            transferId = trf.id

            // 2. Add Item
            await supabase.from('stock_transfer_items').insert({
                transfer_id: trf.id, product_id: product.id, quantity_requested: 10
            })

            // 3. Submit
            log(id, 'Submitting...', 'info')
            await supabase.from('stock_transfers').update({ status: 'PENDING_APPROVAL' }).eq('id', trf.id)

            // 4. Approve
            log(id, 'Approving...', 'info')
            await supabase.from('stock_transfers').update({ status: 'APPROVED' }).eq('id', trf.id)

            log(id, 'Workflow completed successfully', 'success')
            updateModule(id, { status: 'success' })

        } catch (error: any) {
            log(id, `Transfer Failed: ${error.message}`, 'error')
            updateModule(id, { status: 'failure' })
        } finally {
            // Enhanced Cleanup
            if (transferId) {
                await supabase.from('stock_transfer_items').delete().eq('transfer_id', transferId)
                await supabase.from('stock_transfers').delete().eq('id', transferId)
            }
            if (testProductId) {
                await supabase.from('inventory_stock').delete().eq('product_id', testProductId)
                await supabase.from('inventory_transactions').delete().eq('product_id', testProductId) // Add this
                await supabase.from('products').delete().eq('id', testProductId)
                log(id, 'Cleanup complete')
            }
        }
    }

    // --- 6. ADJUSTMENTS TEST ---
    const runAdjustmentsTest = async () => { /* Alias */ await runAdjustmentsWorkflowTest() }

    // RENAMED TO MATCH INTERFACE
    const runAdjustmentsWorkflowTest = async () => {
        const id = 'adjustments'
        setCurrentTestId(id)
        updateModule(id, { status: 'running' })

        let testProductId: string | null = null
        let adjId: string | null = null

        try {
            // Setup
            const { data: loc } = await supabase.from('locations').select('id, name').limit(1).single()
            const { data: cat } = await supabase.from('product_categories').select('id').limit(1).single()
            const { data: uom } = await supabase.from('units_of_measure').select('id').limit(1).single()

            // Temp Product w/ Stock
            const { data: product } = await supabase.from('products').insert({
                name: 'Adjustment Test Item', sku: `TEST-ADJ-ITEM-${Date.now()}`,
                category_id: cat?.id, uom_id: uom?.id, is_active: true, reorder_point: 0, reorder_quantity: 0, min_stock_level: 0
            }).select().single()

            if (!product) throw new Error('Product creation failed')
            testProductId = product.id

            // Init Stock: 100
            await supabase.from('inventory_stock').insert({
                product_id: product.id, location_id: loc?.id,
                quantity_on_hand: 100, quantity_available: 100, quantity_reserved: 0, average_cost: 10, total_value: 1000, last_updated: new Date().toISOString()
            })

            // 1. Create Adjustment (Cycle Count +5)
            const adjNum = `TEST-ADJ-${Date.now()}`
            log(id, `Creating adjustment ${adjNum} (+5 items)`)
            const { data: adj, error: adjErr } = await supabase.from('stock_adjustments').insert({
                adjustment_number: adjNum, location_id: loc?.id, adjustment_type: 'CYCLE_COUNT',
                adjustment_date: new Date().toISOString(), reason: 'System Health Check', status: 'DRAFT', created_by: null
            }).select().single()
            if (adjErr) throw adjErr
            adjId = adj.id

            // 2. Add Item (System: 100, Physical: 105)
            await supabase.from('stock_adjustment_items').insert({
                adjustment_id: adj.id, product_id: product.id, system_quantity: 100, physical_quantity: 105, unit_cost: 10
            })

            // 3. Submit & Approve
            log(id, 'Submitting & Approving...', 'info')
            await supabase.from('stock_adjustments').update({ status: 'PENDING_APPROVAL' }).eq('id', adj.id)
            await supabase.from('stock_adjustments').update({ status: 'APPROVED' }).eq('id', adj.id)

            // 4. Verify Trigger
            log(id, 'Verifying stock update...', 'info')
            await new Promise(r => setTimeout(r, 1500)) // Wait for trigger

            const { data: finalStock } = await supabase.from('inventory_stock').select('quantity_on_hand')
                .eq('product_id', product.id).single()

            if (finalStock?.quantity_on_hand === 105) {
                log(id, `Stock updated correctly: 100 -> 105`, 'success')
                updateModule(id, { status: 'success' })
            } else {
                throw new Error(`Stock mismatch: Expected 105, got ${finalStock?.quantity_on_hand}`)
            }

        } catch (error: any) {
            log(id, `Adjustment Failed: ${error.message}`, 'error')
            updateModule(id, { status: 'failure' })
        } finally {
            // Enhanced Cleanup
            if (adjId) {
                // Delete items first to satisfy FK
                await supabase.from('stock_adjustment_items').delete().eq('adjustment_id', adjId)
                await supabase.from('stock_adjustments').delete().eq('id', adjId)
            }
            if (testProductId) {
                // Delete stock first
                await supabase.from('inventory_stock').delete().eq('product_id', testProductId)
                // Delete any transaction logs if they exist (best effort)
                await supabase.from('inventory_transactions').delete().eq('product_id', testProductId)
                await supabase.from('products').delete().eq('id', testProductId)
                log(id, 'Cleanup complete')
            }
        }
    }

    return (
        <div className="container mx-auto p-8 max-w-6xl space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <ShieldCheck className="h-8 w-8 text-green-600" />
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">System Health Check</h1>
                    </div>
                    <p className="text-slate-500 mt-2">Comprehensive diagnostics suite with safe execution environment.</p>
                </div>
                <Button
                    size="lg"
                    onClick={() => setShowConfirm(true)}
                    disabled={isRunning}
                    className="h-12 px-8 bg-slate-900 hover:bg-slate-800 shadow-xl transition-all"
                >
                    {isRunning ? (
                        <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Running Diagnostics...
                        </>
                    ) : (
                        <>
                            <Play className="mr-2 h-4 w-4" />
                            Start Comprehensive Diagnostics
                        </>
                    )}
                </Button>
            </div>

            <Progress value={(modules.filter(m => m.status === 'success' || m.status === 'failure' || m.status === 'skipped').length / modules.length) * 100} className="h-2" />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Modules List */}
                <div className="space-y-4">
                    {modules.map((module) => (
                        <Card
                            key={module.id}
                            className={`transition-all duration-300 border-l-4 ${currentTestId === module.id ? 'border-l-blue-500 shadow-lg scale-[1.01] ring-1 ring-blue-100' :
                                module.status === 'success' ? 'border-l-green-500 opacity-90' :
                                    module.status === 'failure' ? 'border-l-red-500' :
                                        'border-l-slate-200'
                                }`}
                        >
                            <CardContent className="p-5 flex items-start gap-4">
                                <div className="mt-1">
                                    {module.status === 'pending' && <Circle className="h-5 w-5 text-slate-300" />}
                                    {module.status === 'running' && <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />}
                                    {module.status === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                                    {module.status === 'failure' && <AlertCircle className="h-5 w-5 text-red-500" />}
                                    {module.status === 'skipped' && <Circle className="h-5 w-5 text-amber-300" />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <h3 className="font-bold text-slate-900">{module.name}</h3>
                                        {module.status !== 'pending' && (
                                            <Badge variant={
                                                module.status === 'success' ? 'default' :
                                                    module.status === 'failure' ? 'destructive' :
                                                        module.status === 'running' ? 'secondary' : 'outline'
                                            } className={module.status === 'success' ? 'bg-green-600' : ''}>
                                                {module.status.toUpperCase()}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-500">{module.description}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Console Output */}
                <Card className="bg-slate-950 text-slate-200 h-[650px] flex flex-col font-mono text-sm shadow-2xl border-slate-800 overflow-hidden">
                    <CardHeader className="border-b border-slate-800 bg-slate-900/50 py-3 px-4">
                        <div className="flex items-center gap-2">
                            <Terminal className="h-4 w-4 text-slate-400" />
                            <CardTitle className="text-sm font-medium text-slate-400">Diagnostic Logs</CardTitle>
                        </div>
                    </CardHeader>
                    <div className="flex-1 overflow-auto p-4 space-y-1.5" ref={scrollRef}>
                        {modules.flatMap(m => m.logs).length === 0 && (
                            <div className="text-slate-600 italic text-center mt-20">System ready. Awaiting initialization command...</div>
                        )}
                        {modules.flatMap(m => m.logs).map((log, i) => (
                            <div key={i} className={`
                                ${log.includes('❌') ? 'text-red-400 font-bold bg-red-950/20 py-0.5 rounded px-2' : ''}
                                ${log.includes('✅') ? 'text-green-400' : ''}
                                ${log.includes('⚠️') ? 'text-amber-400' : ''}
                                ${log.includes('Starting') ? 'text-blue-400 mt-4 border-t border-slate-800 pt-4 font-bold' : ''}
                                tracking-tight
                            `}>
                                {log}
                            </div>
                        ))}
                        {isRunning && (
                            <div className="animate-pulse text-blue-500">_</div>
                        )}
                    </div>
                </Card>
            </div>

            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Start System Diagnostics?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will create execution of comprehensive tests across all modules.
                            It will create temporary data (prefixed with 'TEST-') and attempt to clean it up automatically.

                            Your existing data should be safe, but please ensure no one is actively editing critical records.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={runTests} className="bg-slate-900 text-white hover:bg-slate-800">
                            Start Diagnostics
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
