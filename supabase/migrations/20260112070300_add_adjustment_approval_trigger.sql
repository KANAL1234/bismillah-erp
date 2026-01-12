-- Trigger function to automatically update inventory when adjustment is approved
-- This makes inventory updates happen at the database level

CREATE OR REPLACE FUNCTION handle_adjustment_approval()
RETURNS TRIGGER AS $$
DECLARE
    adjustment_item RECORD;
    difference INTEGER;
BEGIN
    -- Only proceed if status changed to APPROVED
    IF NEW.status = 'APPROVED' AND (OLD.status IS NULL OR OLD.status != 'APPROVED') THEN
        
        -- Loop through all items in this adjustment
        FOR adjustment_item IN 
            SELECT 
                product_id,
                system_quantity,
                physical_quantity,
                unit_cost
            FROM stock_adjustment_items
            WHERE adjustment_id = NEW.id
        LOOP
            -- Calculate the difference
            difference := adjustment_item.physical_quantity - adjustment_item.system_quantity;
            
            -- Update inventory stock
            IF EXISTS (
                SELECT 1 FROM inventory_stock 
                WHERE product_id = adjustment_item.product_id 
                AND location_id = NEW.location_id
            ) THEN
                -- Update existing record
                UPDATE inventory_stock
                SET 
                    quantity_on_hand = quantity_on_hand + difference,
                    quantity_available = quantity_available + difference,
                    total_value = (quantity_on_hand + difference) * average_cost,
                    last_updated = NOW()
                WHERE 
                    product_id = adjustment_item.product_id 
                    AND location_id = NEW.location_id;
            ELSE
                -- Create new record (only if difference is positive)
                IF difference > 0 THEN
                    INSERT INTO inventory_stock (
                        product_id,
                        location_id,
                        quantity_on_hand,
                        quantity_available,
                        quantity_reserved,
                        average_cost,
                        total_value,
                        last_updated
                    ) VALUES (
                        adjustment_item.product_id,
                        NEW.location_id,
                        difference,
                        difference,
                        0,
                        adjustment_item.unit_cost,
                        difference * adjustment_item.unit_cost,
                        NOW()
                    );
                END IF;
            END IF;
            
        END LOOP;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_adjustment_approval ON stock_adjustments;

-- Create the trigger
CREATE TRIGGER trigger_adjustment_approval
    AFTER UPDATE ON stock_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION handle_adjustment_approval();

-- Add comment for documentation
COMMENT ON FUNCTION handle_adjustment_approval() IS 
'Automatically updates inventory stock levels when an adjustment status changes to APPROVED. 
Adjusts stock based on the difference between physical and system quantities.';
