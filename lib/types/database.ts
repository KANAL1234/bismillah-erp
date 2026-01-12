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
