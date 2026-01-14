-- Migration to add LBAC to inventory valuation functions (CORRECTED ATTEMPT 2)

-- Function: Cost Layer Report with LBAC
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
      -- LBAC Check: Ensure user has access to the location
      AND (
          EXISTS (
              SELECT 1 FROM user_allowed_locations ual
              WHERE ual.user_id = auth.uid()
              AND ual.location_id = cl.location_id
          )
          OR 
          -- Allow if user is admin
          EXISTS (
              SELECT 1 FROM user_roles ur
              JOIN roles r ON ur.role_id = r.id
              WHERE ur.user_id = auth.uid() AND r.role_name = 'admin'
          )
      )
    ORDER BY p.sku, l.name, cl.layer_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Inventory Valuation Report with LBAC
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
      -- LBAC Check
      AND (
          EXISTS (
              SELECT 1 FROM user_allowed_locations ual
              WHERE ual.user_id = auth.uid()
              AND ual.location_id = ist.location_id
          )
          OR 
          -- Allow if user is admin
          EXISTS (
              SELECT 1 FROM user_roles ur
              JOIN roles r ON ur.role_id = r.id
              WHERE ur.user_id = auth.uid() AND r.role_name = 'admin'
          )
      )
    GROUP BY p.sku, p.name, l.name, pc.costing_method, 
             ist.quantity_available, ist.average_cost, ist.total_value
    ORDER BY p.sku, l.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
