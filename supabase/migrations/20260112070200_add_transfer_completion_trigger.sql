-- Trigger function to automatically update inventory when transfer is completed
-- This makes inventory updates happen at the database level

CREATE OR REPLACE FUNCTION handle_transfer_completion()
RETURNS TRIGGER AS $$
DECLARE
    transfer_item RECORD;
BEGIN
    -- Only proceed if status changed to COMPLETED
    IF NEW.status = 'COMPLETED' AND (OLD.status IS NULL OR OLD.status != 'COMPLETED') THEN
        
        -- Loop through all items in this transfer
        FOR transfer_item IN 
            SELECT 
                product_id,
                quantity_requested,
                COALESCE(quantity_received, quantity_requested) as qty_to_transfer,
                unit_cost
            FROM stock_transfer_items
            WHERE transfer_id = NEW.id
        LOOP
            -- Update FROM location: reduce stock
            UPDATE inventory_stock
            SET 
                quantity_on_hand = quantity_on_hand - transfer_item.quantity_requested,
                quantity_available = quantity_available - transfer_item.quantity_requested,
                total_value = (quantity_on_hand - transfer_item.quantity_requested) * average_cost,
                last_updated = NOW()
            WHERE 
                product_id = transfer_item.product_id 
                AND location_id = NEW.from_location_id;
            
            -- Update TO location: increase stock
            -- First check if record exists
            IF EXISTS (
                SELECT 1 FROM inventory_stock 
                WHERE product_id = transfer_item.product_id 
                AND location_id = NEW.to_location_id
            ) THEN
                -- Update existing record
                UPDATE inventory_stock
                SET 
                    quantity_on_hand = quantity_on_hand + transfer_item.qty_to_transfer,
                    quantity_available = quantity_available + transfer_item.qty_to_transfer,
                    total_value = (quantity_on_hand + transfer_item.qty_to_transfer) * average_cost,
                    last_updated = NOW()
                WHERE 
                    product_id = transfer_item.product_id 
                    AND location_id = NEW.to_location_id;
            ELSE
                -- Create new record
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
                    transfer_item.product_id,
                    NEW.to_location_id,
                    transfer_item.qty_to_transfer,
                    transfer_item.qty_to_transfer,
                    0,
                    transfer_item.unit_cost,
                    transfer_item.qty_to_transfer * transfer_item.unit_cost,
                    NOW()
                );
            END IF;
            
            -- Update the transfer item quantities
            UPDATE stock_transfer_items
            SET 
                quantity_sent = transfer_item.quantity_requested,
                quantity_received = transfer_item.qty_to_transfer
            WHERE 
                transfer_id = NEW.id 
                AND product_id = transfer_item.product_id;
                
        END LOOP;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_transfer_completion ON stock_transfers;

-- Create the trigger
CREATE TRIGGER trigger_transfer_completion
    AFTER UPDATE ON stock_transfers
    FOR EACH ROW
    EXECUTE FUNCTION handle_transfer_completion();

-- Add comment for documentation
COMMENT ON FUNCTION handle_transfer_completion() IS 
'Automatically updates inventory stock levels when a transfer status changes to COMPLETED. 
Reduces stock at FROM location and increases stock at TO location.';
