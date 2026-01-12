export type Product = {
    id: string
    sku: string
    barcode: string | null
    name: string
    description: string | null
    category_id: string
    uom_id: string
    cost_price: number | null
    selling_price: number | null
    wholesale_price: number | null
    reorder_point: number
    reorder_quantity: number
    min_stock_level: number
    max_stock_level: number | null
    is_active: boolean
    is_serialized: boolean
    is_batchable: boolean
    notes: string | null
    image_url: string | null
    created_at: string
    updated_at: string
}

export type ProductCategory = {
    id: string
    code: string
    name: string
    parent_id: string | null
    costing_method: 'AVCO' | 'FIFO'
    description: string | null
    is_active: boolean
    created_at: string
}

export type UnitOfMeasure = {
    id: string
    code: string
    name: string
    description: string | null
}

export type ProductWithDetails = Product & {
    product_categories: ProductCategory
    units_of_measure: UnitOfMeasure
}

export type Location = {
    id: string
    type_id: string
    code: string
    name: string
    address: string | null
    contact_person: string | null
    contact_phone: string | null
    is_active: boolean
    vehicle_number: string | null
    assigned_salesperson_id: string | null
    created_at: string
    updated_at: string
}

export type LocationType = {
    id: string
    name: string
    description: string | null
}

export type LocationWithType = Location & {
    location_types: LocationType
}

export type InventoryStock = {
    id: string
    product_id: string
    location_id: string
    quantity_on_hand: number
    quantity_reserved: number
    quantity_available: number
    average_cost: number
    total_value: number
    last_stock_take_date: string | null
    last_updated: string
}

export type InventoryStockWithDetails = InventoryStock & {
    products: Product
    locations: LocationWithType
}

export type StockTransfer = {
    id: string
    transfer_number: string
    from_location_id: string
    to_location_id: string
    status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED'
    requested_by: string | null
    approved_by: string | null
    received_by: string | null
    transfer_date: string
    expected_delivery_date: string | null
    actual_delivery_date: string | null
    notes: string | null
    created_at: string
    updated_at: string
}

export type StockTransferItem = {
    id: string
    transfer_id: string
    product_id: string
    quantity_requested: number
    quantity_sent: number | null
    quantity_received: number | null
    unit_cost: number | null
    notes: string | null
}

export type StockTransferWithDetails = StockTransfer & {
    from_location: Location
    to_location: Location
    stock_transfer_items: (StockTransferItem & {
        products: Product
    })[]
}

export type StockAdjustment = {
    id: string
    adjustment_number: string
    location_id: string
    adjustment_type: 'CYCLE_COUNT' | 'DAMAGE' | 'EXPIRY' | 'LOSS' | 'FOUND' | 'OTHER'
    status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED'
    adjustment_date: string
    reason: string
    approved_by: string | null
    created_by: string | null
    created_at: string
    updated_at: string
}

export type StockAdjustmentItem = {
    id: string
    adjustment_id: string
    product_id: string
    system_quantity: number
    physical_quantity: number
    difference: number
    unit_cost: number | null
    value_difference: number | null
    notes: string | null
}

export type StockAdjustmentWithDetails = StockAdjustment & {
    locations: Location
    stock_adjustment_items: (StockAdjustmentItem & {
        products: Product
    })[]
}

export type InventoryTransaction = {
    id: string
    transaction_type_id: string
    transaction_number: string
    product_id: string
    from_location_id: string | null
    to_location_id: string | null
    quantity: number
    unit_cost: number | null
    reference_type: string | null
    reference_id: string | null
    reference_number: string | null
    batch_number: string | null
    serial_number: string | null
    expiry_date: string | null
    notes: string | null
    created_by: string | null
    created_at: string
}
