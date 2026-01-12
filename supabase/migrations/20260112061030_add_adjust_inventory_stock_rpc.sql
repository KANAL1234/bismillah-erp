-- Function to adjust inventory stock safely
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
    -- Update existing
    UPDATE inventory_stock
    SET quantity_on_hand = quantity_on_hand + p_quantity_change,
        last_updated = NOW()
    WHERE product_id = p_product_id AND location_id = p_location_id;
  ELSE
    -- Create new record (if adding stock)
    IF p_quantity_change > 0 THEN
      INSERT INTO inventory_stock (product_id, location_id, quantity_on_hand)
      VALUES (p_product_id, p_location_id, p_quantity_change);
    ELSE
      RAISE EXCEPTION 'Cannot create negative stock for new location';
    END IF;
  END IF;
END;
$$;
