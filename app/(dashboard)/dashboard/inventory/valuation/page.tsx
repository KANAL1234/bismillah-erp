'use client'

import { useState } from 'react'
import { useCostLayers, useInventoryValuation } from '@/lib/queries/cost-layers'
import { useLocations } from '@/lib/queries/locations'
import { PermissionGuard } from '@/components/permission-guard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Layers, TrendingUp, Package, Download } from 'lucide-react'
import { format } from 'date-fns'

export default function InventoryValuationPage() {
    return (
        <PermissionGuard permission="inventory.reports.view">
            <InventoryValuationContent />
        </PermissionGuard>
    )
}

function InventoryValuationContent() {
    const [selectedLocation, setSelectedLocation] = useState<string>('all')
    const { data: locations } = useLocations()
    const { data: valuation, isLoading: valuationLoading } = useInventoryValuation(
        selectedLocation === 'all' ? undefined : selectedLocation
    )
    const { data: costLayers, isLoading: layersLoading } = useCostLayers(
        undefined,
        selectedLocation === 'all' ? undefined : selectedLocation
    )

    const totalValue = valuation?.reduce((sum: number, item: any) => sum + Number(item.total_value || 0), 0) || 0
    const totalQuantity = valuation?.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0) || 0
    const fifoProducts = valuation?.filter((v: any) => v.costing_method === 'FIFO').length || 0
    const avcoProducts = valuation?.filter((v: any) => v.costing_method === 'AVCO').length || 0

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">Inventory Valuation</h2>
                    <p className="text-slate-500 mt-1">AVCO & FIFO cost layer analysis</p>
                </div>
                <div className="flex gap-2">
                    <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="All Locations" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Locations</SelectItem>
                            {locations?.map((location) => (
                                <SelectItem key={location.id} value={location.id}>
                                    {location.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Inventory Value</CardTitle>
                        <TrendingUp className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Rs. {totalValue.toLocaleString()}</div>
                        <p className="text-xs text-slate-500">{totalQuantity.toLocaleString()} units</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">FIFO Products</CardTitle>
                        <Layers className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{fifoProducts}</div>
                        <p className="text-xs text-slate-500">First-In-First-Out</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">AVCO Products</CardTitle>
                        <Package className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{avcoProducts}</div>
                        <p className="text-xs text-slate-500">Average Cost</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Cost Layers</CardTitle>
                        <Layers className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{costLayers?.length || 0}</div>
                        <p className="text-xs text-slate-500">Active layers</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="valuation" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="valuation">Inventory Valuation</TabsTrigger>
                    <TabsTrigger value="layers">Cost Layers</TabsTrigger>
                </TabsList>

                <TabsContent value="valuation" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Inventory Valuation by Product</CardTitle>
                            <CardDescription>Current stock value with costing method breakdown</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {valuationLoading ? (
                                <div className="p-8 text-center text-slate-500">Loading valuation...</div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Product</TableHead>
                                            <TableHead>Location</TableHead>
                                            <TableHead>Method</TableHead>
                                            <TableHead className="text-right">Quantity</TableHead>
                                            <TableHead className="text-right">Avg Cost</TableHead>
                                            <TableHead className="text-right">Total Value</TableHead>
                                            <TableHead className="text-right">Layers</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {valuation?.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                                                    No inventory found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            valuation?.map((item: any, idx: number) => (
                                                <TableRow key={idx}>
                                                    <TableCell>
                                                        <div className="font-medium">{item.product_name}</div>
                                                        <div className="text-xs text-slate-500">{item.product_code}</div>
                                                    </TableCell>
                                                    <TableCell className="text-sm">{item.location_name}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={item.costing_method === 'FIFO' ? 'default' : 'secondary'}>
                                                            {item.costing_method}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        {Number(item.quantity).toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        Rs. {Number(item.average_cost).toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-bold">
                                                        Rs. {Number(item.total_value).toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant="outline">
                                                            {item.cost_layers_count || 0}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="layers" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Cost Layers (FIFO Tracking)</CardTitle>
                            <CardDescription>Detailed cost layer breakdown for FIFO products</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {layersLoading ? (
                                <div className="p-8 text-center text-slate-500">Loading cost layers...</div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Product</TableHead>
                                            <TableHead>Location</TableHead>
                                            <TableHead>Layer Date</TableHead>
                                            <TableHead>Reference</TableHead>
                                            <TableHead className="text-right">Unit Cost</TableHead>
                                            <TableHead className="text-right">Original Qty</TableHead>
                                            <TableHead className="text-right">Remaining</TableHead>
                                            <TableHead className="text-right">Layer Value</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {costLayers?.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                                                    No cost layers found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            costLayers?.map((layer: any, idx: number) => (
                                                <TableRow key={idx}>
                                                    <TableCell>
                                                        <div className="font-medium">{layer.product_name}</div>
                                                        <div className="text-xs text-slate-500">{layer.product_code}</div>
                                                    </TableCell>
                                                    <TableCell className="text-sm">{layer.location_name}</TableCell>
                                                    <TableCell className="text-sm">
                                                        {format(new Date(layer.layer_date), 'MMM d, yyyy')}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-sm">{layer.reference_type}</div>
                                                        <div className="text-xs text-slate-500">{layer.reference_number}</div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        Rs. {Number(layer.unit_cost).toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        {Number(layer.original_qty).toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-bold">
                                                        {Number(layer.remaining_qty).toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-bold text-green-600">
                                                        Rs. {Number(layer.layer_value).toLocaleString()}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
