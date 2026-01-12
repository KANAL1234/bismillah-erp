-- Update adjust_inventory_stock to handle available quantity and total value
CREATE OR REPLACE FUNCTION adjust_inventory_stock(
  p_product_id UUID,
  p_location_id UUID,
  p_quantity_change DECIMAL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if stock record exists
  IF EXISTS (
    SELECT 1 FROM inventory_stock 
    WHERE product_id = p_product_id AND location_id = p_location_id
  ) THEN
    -- Update existing: increment both on_hand and available
    -- Also recalculate total_value based on average_cost
    UPDATE inventory_stock
    SET quantity_on_hand = quantity_on_hand + p_quantity_change,
        quantity_available = quantity_available + p_quantity_change,
        total_value = (quantity_on_hand + p_quantity_change) * COALESCE(average_cost, 0),
        last_updated = NOW()
    WHERE product_id = p_product_id AND location_id = p_location_id;
  ELSE
    -- Create new record (if adding stock)
    IF p_quantity_change > 0 THEN
      -- For new records, on_hand and available are the same
      -- total_value is 0 until cost is updated, or we use a default
      INSERT INTO inventory_stock (
        product_id, 
        location_id, 
        quantity_on_hand, 
        quantity_available,
        total_value
      )
      VALUES (
        p_product_id, 
        p_location_id, 
        p_quantity_change, 
        p_quantity_change,
        0
      );
    ELSE
      RAISE EXCEPTION 'Cannot create negative stock for new location';
    END IF;
  END IF;
END;
$$;
