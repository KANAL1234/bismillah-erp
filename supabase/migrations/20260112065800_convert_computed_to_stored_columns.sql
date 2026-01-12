-- Migration to convert computed columns to stored columns
-- This allows direct updates to quantity_available and total_value

-- Step 1: Drop the generated column constraints
ALTER TABLE inventory_stock 
  ALTER COLUMN quantity_available DROP EXPRESSION IF EXISTS;

ALTER TABLE inventory_stock 
  ALTER COLUMN total_value DROP EXPRESSION IF EXISTS;

-- Step 2: Set default values for existing rows if needed
-- Update quantity_available to match the computed value
UPDATE inventory_stock 
SET quantity_available = quantity_on_hand - quantity_reserved
WHERE quantity_available IS NULL OR quantity_available != (quantity_on_hand - quantity_reserved);

-- Update total_value to match the computed value
UPDATE inventory_stock 
SET total_value = quantity_on_hand * average_cost
WHERE total_value IS NULL OR total_value != (quantity_on_hand * average_cost);

-- Step 3: Add NOT NULL constraints if desired
ALTER TABLE inventory_stock 
  ALTER COLUMN quantity_available SET NOT NULL;

ALTER TABLE inventory_stock 
  ALTER COLUMN total_value SET NOT NULL;

-- Step 4: Add default values for new inserts
ALTER TABLE inventory_stock 
  ALTER COLUMN quantity_available SET DEFAULT 0;

ALTER TABLE inventory_stock 
  ALTER COLUMN total_value SET DEFAULT 0;
