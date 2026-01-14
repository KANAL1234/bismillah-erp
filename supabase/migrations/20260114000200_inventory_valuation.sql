-- =====================================================
-- Inventory Valuation: AVCO & FIFO Cost Layer Tracking
-- =====================================================
-- This migration adds comprehensive cost layer tracking
-- to support both AVCO and FIFO inventory valuation methods

-- =====================================================
-- 1. CREATE COST LAYERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.inventory_cost_layers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    
    -- Layer identification
    layer_date timestamp with time zone NOT NULL DEFAULT now(),
    reference_type text NOT NULL,
    reference_id uuid,
    reference_number text,
    
    -- Cost information
    unit_cost numeric(15,2) NOT NULL,
    original_quantity numeric(15,2) NOT NULL,
    remaining_quantity numeric(15,2) NOT NULL,
    
    -- Metadata
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT chk_remaining_qty CHECK (remaining_quantity >= 0 AND remaining_quantity <= original_quantity),
    CONSTRAINT chk_cost_layer_ref_type CHECK (reference_type IN ('GRN', 'ADJUSTMENT', 'OPENING', 'TRANSFER_IN', 'RETURN', 'MANUAL'))
);

COMMENT ON TABLE inventory_cost_layers IS 'Tracks cost layers for FIFO inventory valuation';
COMMENT ON COLUMN inventory_cost_layers.unit_cost IS 'Cost per unit for this layer';
COMMENT ON COLUMN inventory_cost_layers.original_quantity IS 'Initial quantity in this layer';
COMMENT ON COLUMN inventory_cost_layers.remaining_quantity IS 'Quantity still available in this layer';

-- =====================================================
-- 2. CREATE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_cost_layers_product_location 
ON inventory_cost_layers(product_id, location_id);

CREATE INDEX IF NOT EXISTS idx_cost_layers_remaining 
ON inventory_cost_layers(product_id, location_id, remaining_quantity) 
WHERE remaining_quantity > 0;

CREATE INDEX IF NOT EXISTS idx_cost_layers_date 
ON inventory_cost_layers(layer_date);

CREATE INDEX IF NOT EXISTS idx_cost_layers_reference 
ON inventory_cost_layers(reference_type, reference_id);

-- =====================================================
-- 3. ADD CONSTRAINT TO PRODUCT CATEGORIES
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_costing_method'
    ) THEN
        ALTER TABLE product_categories 
        ADD CONSTRAINT chk_costing_method 
        CHECK (costing_method IN ('AVCO', 'FIFO'));
    END IF;
END $$;

-- =====================================================
-- 4. CREATE COST LAYER MANAGEMENT FUNCTIONS
-- =====================================================

-- Function: Create Cost Layer
CREATE OR REPLACE FUNCTION create_cost_layer(
    p_product_id uuid,
    p_location_id uuid,
    p_unit_cost numeric,
    p_quantity numeric,
    p_reference_type text,
    p_reference_id uuid DEFAULT NULL,
    p_reference_number text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
    v_layer_id uuid;
BEGIN
    INSERT INTO inventory_cost_layers (
        product_id,
        location_id,
        unit_cost,
        original_quantity,
        remaining_quantity,
        reference_type,
        reference_id,
        reference_number
    ) VALUES (
        p_product_id,
        p_location_id,
        p_unit_cost,
        p_quantity,
        p_quantity,
        p_reference_type,
        p_reference_id,
        p_reference_number
    ) RETURNING id INTO v_layer_id;
    
    RETURN v_layer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_cost_layer IS 'Creates a new cost layer for FIFO tracking';

-- Function: Consume Cost Layers (FIFO)
CREATE OR REPLACE FUNCTION consume_cost_layers_fifo(
    p_product_id uuid,
    p_location_id uuid,
    p_quantity_to_consume numeric
) RETURNS TABLE(layer_id uuid, quantity_consumed numeric, unit_cost numeric, layer_value numeric) AS $$
DECLARE
    v_remaining numeric := p_quantity_to_consume;
    v_layer RECORD;
    v_consume_qty numeric;
BEGIN
    -- Get cost layers in FIFO order (oldest first)
    FOR v_layer IN 
        SELECT id, remaining_quantity, unit_cost
        FROM inventory_cost_layers
        WHERE product_id = p_product_id
          AND location_id = p_location_id
          AND remaining_quantity > 0
        ORDER BY layer_date ASC, created_at ASC
        FOR UPDATE
    LOOP
        IF v_remaining <= 0 THEN
            EXIT;
        END IF;
        
        -- Determine how much to consume from this layer
        v_consume_qty := LEAST(v_layer.remaining_quantity, v_remaining);
        
        -- Update the layer
        UPDATE inventory_cost_layers
        SET remaining_quantity = remaining_quantity - v_consume_qty,
            updated_at = now()
        WHERE id = v_layer.id;
        
        -- Return the consumption details
        layer_id := v_layer.id;
        quantity_consumed := v_consume_qty;
        unit_cost := v_layer.unit_cost;
        layer_value := v_consume_qty * v_layer.unit_cost;
        RETURN NEXT;
        
        v_remaining := v_remaining - v_consume_qty;
    END LOOP;
    
    IF v_remaining > 0.001 THEN
        RAISE EXCEPTION 'Insufficient cost layers to consume % units (% remaining)', 
            p_quantity_to_consume, v_remaining;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION consume_cost_layers_fifo IS 'Consumes cost layers in FIFO order and returns cost details';

-- Function: Calculate AVCO
CREATE OR REPLACE FUNCTION calculate_avco(
    p_product_id uuid,
    p_location_id uuid
) RETURNS numeric AS $$
DECLARE
    v_total_value numeric;
    v_total_qty numeric;
    v_avg_cost numeric;
BEGIN
    SELECT 
        SUM(remaining_quantity * unit_cost),
        SUM(remaining_quantity)
    INTO v_total_value, v_total_qty
    FROM inventory_cost_layers
    WHERE product_id = p_product_id
      AND location_id = p_location_id
      AND remaining_quantity > 0;
    
    IF v_total_qty > 0 THEN
        v_avg_cost := v_total_value / v_total_qty;
    ELSE
        -- Fallback to current average cost in inventory_stock
        SELECT average_cost INTO v_avg_cost
        FROM inventory_stock
        WHERE product_id = p_product_id
          AND location_id = p_location_id;
    END IF;
    
    RETURN COALESCE(v_avg_cost, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calculate_avco IS 'Calculates weighted average cost from cost layers';

-- Function: Get Cost of Goods Sold (COGS)
CREATE OR REPLACE FUNCTION get_cogs_for_sale(
    p_product_id uuid,
    p_location_id uuid,
    p_quantity numeric
) RETURNS numeric AS $$
DECLARE
    v_costing_method text;
    v_cogs numeric := 0;
    v_layer RECORD;
BEGIN
    -- Get costing method from product category
    SELECT pc.costing_method INTO v_costing_method
    FROM products p
    JOIN product_categories pc ON p.category_id = pc.id
    WHERE p.id = p_product_id;
    
    IF v_costing_method = 'FIFO' THEN
        -- Calculate COGS using FIFO (consumes layers)
        FOR v_layer IN 
            SELECT * FROM consume_cost_layers_fifo(p_product_id, p_location_id, p_quantity)
        LOOP
            v_cogs := v_cogs + v_layer.layer_value;
        END LOOP;
    ELSE
        -- AVCO method (uses average cost, doesn't consume layers)
        SELECT average_cost * p_quantity INTO v_cogs
        FROM inventory_stock
        WHERE product_id = p_product_id
          AND location_id = p_location_id;
    END IF;
    
    RETURN COALESCE(v_cogs, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_cogs_for_sale IS 'Calculates COGS using FIFO or AVCO method based on product category';

-- =====================================================
-- 5. REPORTING FUNCTIONS
-- =====================================================

-- Function: Cost Layer Report
CREATE OR REPLACE FUNCTION get_cost_layer_report(
    p_product_id uuid DEFAULT NULL,
    p_location_id uuid DEFAULT NULL
) RETURNS TABLE(
    product_code text,
    product_name text,
    location_name text,
    layer_date timestamp with time zone,
    reference_type text,
    reference_number text,
    unit_cost numeric,
    original_qty numeric,
    remaining_qty numeric,
    consumed_qty numeric,
    layer_value numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.sku,
        p.name,
        l.name,
        cl.layer_date,
        cl.reference_type,
        cl.reference_number,
        cl.unit_cost,
        cl.original_quantity,
        cl.remaining_quantity,
        cl.original_quantity - cl.remaining_quantity,
        cl.remaining_quantity * cl.unit_cost
    FROM inventory_cost_layers cl
    JOIN products p ON cl.product_id = p.id
    JOIN locations l ON cl.location_id = l.id
    WHERE (p_product_id IS NULL OR cl.product_id = p_product_id)
      AND (p_location_id IS NULL OR cl.location_id = p_location_id)
      AND cl.remaining_quantity > 0
    ORDER BY p.sku, l.name, cl.layer_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_cost_layer_report IS 'Returns detailed cost layer report for inventory analysis';

-- Function: Inventory Valuation Report
CREATE OR REPLACE FUNCTION get_inventory_valuation(
    p_location_id uuid DEFAULT NULL
) RETURNS TABLE(
    product_code text,
    product_name text,
    location_name text,
    costing_method text,
    quantity numeric,
    average_cost numeric,
    total_value numeric,
    cost_layers_count bigint,
    oldest_layer_date timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.sku,
        p.name,
        l.name,
        pc.costing_method,
        ist.quantity_available,
        ist.average_cost,
        ist.total_value,
        COUNT(cl.id) FILTER (WHERE cl.remaining_quantity > 0),
        MIN(cl.layer_date) FILTER (WHERE cl.remaining_quantity > 0)
    FROM inventory_stock ist
    JOIN products p ON ist.product_id = p.id
    JOIN locations l ON ist.location_id = l.id
    JOIN product_categories pc ON p.category_id = pc.id
    LEFT JOIN inventory_cost_layers cl ON cl.product_id = p.id 
        AND cl.location_id = l.id
        AND cl.remaining_quantity > 0
    WHERE (p_location_id IS NULL OR ist.location_id = p_location_id)
      AND ist.quantity_available > 0
    GROUP BY p.sku, p.name, l.name, pc.costing_method, 
             ist.quantity_available, ist.average_cost, ist.total_value
    ORDER BY p.sku, l.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_inventory_valuation IS 'Returns comprehensive inventory valuation with cost layer details';

-- =====================================================
-- 6. MIGRATION: CREATE OPENING LAYERS FOR EXISTING STOCK
-- =====================================================

-- Create opening cost layers for all existing inventory
INSERT INTO inventory_cost_layers (
    product_id,
    location_id,
    unit_cost,
    original_quantity,
    remaining_quantity,
    reference_type,
    reference_number,
    layer_date
)
SELECT 
    product_id,
    location_id,
    COALESCE(average_cost, 0),
    quantity_available,
    quantity_available,
    'OPENING',
    'OPENING-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD'),
    CURRENT_TIMESTAMP
FROM inventory_stock
WHERE quantity_available > 0
ON CONFLICT DO NOTHING;

-- =====================================================
-- 7. GRANT PERMISSIONS
-- =====================================================

GRANT SELECT ON inventory_cost_layers TO authenticated;
GRANT EXECUTE ON FUNCTION create_cost_layer TO authenticated;
GRANT EXECUTE ON FUNCTION consume_cost_layers_fifo TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_avco TO authenticated;
GRANT EXECUTE ON FUNCTION get_cogs_for_sale TO authenticated;
GRANT EXECUTE ON FUNCTION get_cost_layer_report TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_valuation TO authenticated;
