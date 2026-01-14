# 🚗 Fleet Management - UPDATED Workflow Guide
## Based on Client Clarifications (Jan 14, 2026)

---

## 📋 CLARIFICATIONS RECEIVED

### **1. Stock Management:**
✅ **Stock STAYS in the vehicle overnight** (not returned to warehouse daily)
- Vehicles maintain rolling stock inventory
- Only restocked when running low
- More efficient for daily operations

### **2. Cash Handling:**
✅ **Cash deposited DAILY** (end of each day)
- Driver returns to office/warehouse daily
- Cash handed over to cashier/accounts
- Reconciliation performed daily

### **3. Routes:**
✅ **DYNAMIC routes** (not fixed)
- Routes change based on traffic
- Target new markets/customers as needed
- Flexible planning day-to-day

### **4. Fuel:**
✅ **Drivers get fuel ALLOWANCES** (not fuel cards)
- Driver receives allowance amount
- Driver purchases fuel and submits receipts
- Allowance vs actual tracked

### **5. Maintenance:**
✅ **EXTERNAL service centers** (with some in-house capability)
- Major repairs at external centers
- Minor fixes in-house if possible
- Track both types

### **6. Driver Compensation:**
✅ **FIXED salaries** (no sales commission for drivers)
- Drivers are NOT on commission
- Only salespeople in stores get commission
- Drivers get fixed monthly salary

---

## 🔄 UPDATED DAILY WORKFLOW

### **Morning Routine (8:00 AM):**

```
1. Driver arrives at warehouse/office
2. Check vehicle stock level
3. IF stock low:
   → Stock Transfer: Warehouse → Vehicle
4. ELSE:
   → No transfer needed (stock stays in vehicle)
5. Fuel allowance given (if needed)
6. Dynamic route discussed with manager
7. Vehicle departs
```

**Implementation:**
```typescript
// Check current stock in vehicle
const { data: vehicleStock } = await supabase
  .from('inventory_transactions')
  .select('*')
  .eq('location_id', vehicleLocationId)
  .eq('product_id', productId);

// Only transfer if stock is low
if (currentStock < reorderLevel) {
  // Create stock transfer
  await supabase.from('stock_transfers').insert({
    from_location_id: warehouseId,
    to_location_id: vehicleId,
    // ... items
  });
}
```

---

### **During Day (Field Operations):**

```
1. Driver visits customers (dynamic route)
2. Sales made via Mobile POS
   → Location: Vehicle-X
   → Payment: Cash or Credit
   → Stock deducts from vehicle automatically
3. Fuel purchased using allowance
   → Driver keeps receipts
4. Continue sales throughout day
```

**No changes needed** - existing POS and inventory system handles this!

---

### **Evening Routine (6:00 PM):**

```
1. Driver returns to office/warehouse
2. CASH HANDOVER (CRITICAL):
   ✓ Count cash collected
   ✓ Hand over to cashier/accounts
   ✓ Get receipt for cash deposited
   
3. FUEL RECEIPTS:
   ✓ Submit fuel receipts
   ✓ Record actual fuel cost vs allowance
   
4. DAILY REPORT:
   ✓ Opening stock value (vehicle inventory start of day)
   ✓ Closing stock value (vehicle inventory end of day)
   ✓ Cash collected (now deposited)
   ✓ Credit sales
   ✓ Fuel allowance given
   ✓ Fuel actual cost (from receipts)
   ✓ Customers visited
   ✓ Successful sales
   
5. STOCK REMAINS IN VEHICLE overnight
6. Vehicle locked and parked
```

---

## 🆕 ADDITIONAL FEATURES NEEDED

Based on clarifications, we need to add:

### **1. Fuel Allowance Tracking**

```sql
-- Add to vehicle_daily_reports table
ALTER TABLE vehicle_daily_reports 
ADD COLUMN fuel_allowance_given numeric(15,2) DEFAULT 0,
ADD COLUMN fuel_allowance_variance numeric(15,2) 
  GENERATED ALWAYS AS (fuel_allowance_given - fuel_cost) STORED;

-- Track allowance vs actual
-- Positive variance = driver saved money
-- Negative variance = driver spent more (needs approval)
```

### **2. Cash Deposit Tracking**

```sql
-- New table for daily cash deposits
CREATE TABLE IF NOT EXISTS public.vehicle_cash_deposits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    deposit_date date NOT NULL DEFAULT CURRENT_DATE,
    vehicle_id uuid NOT NULL REFERENCES vehicles(id),
    driver_id uuid NOT NULL REFERENCES employees(id),
    cash_collected numeric(15,2) NOT NULL,
    cash_deposited numeric(15,2) NOT NULL,
    variance numeric(15,2) GENERATED ALWAYS AS (cash_deposited - cash_collected) STORED,
    received_by uuid REFERENCES auth.users(id),
    receipt_number text,
    notes text,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT unique_vehicle_deposit_date UNIQUE (vehicle_id, deposit_date)
);

CREATE INDEX idx_cash_deposits_date ON vehicle_cash_deposits(deposit_date);
CREATE INDEX idx_cash_deposits_vehicle ON vehicle_cash_deposits(vehicle_id);

COMMENT ON TABLE vehicle_cash_deposits IS 'Daily cash deposits from vehicles with variance tracking';
```

### **3. Dynamic Route Recording**

```sql
-- Modify route_assignments to support ad-hoc routes
ALTER TABLE route_assignments
ADD COLUMN route_description text,
ADD COLUMN is_adhoc boolean DEFAULT false;

-- route_id can be NULL if ad-hoc route
-- route_description captures "Rawalpindi Market Area" or "New customer prospecting"
```

### **4. Fuel Receipt Tracking**

```sql
-- Modify fuel_logs
ALTER TABLE fuel_logs
ADD COLUMN allowance_amount numeric(15,2),
ADD COLUMN variance numeric(15,2) 
  GENERATED ALWAYS AS (allowance_amount - total_amount) STORED;

-- Track if driver stayed within allowance
```

---

## 📊 UPDATED RPC FUNCTIONS

### **1. Record Daily Cash Deposit**

```sql
CREATE OR REPLACE FUNCTION record_vehicle_cash_deposit(
    p_deposit_date date,
    p_vehicle_id uuid,
    p_driver_id uuid,
    p_cash_collected numeric,
    p_cash_deposited numeric,
    p_received_by uuid,
    p_receipt_number text DEFAULT NULL,
    p_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_variance numeric;
BEGIN
    v_variance := p_cash_deposited - p_cash_collected;
    
    -- Check for shortage
    IF v_variance < 0 THEN
        -- Alert: Cash shortage detected
        NULL; -- Can add notification logic here
    END IF;
    
    -- Insert deposit record
    INSERT INTO vehicle_cash_deposits (
        deposit_date,
        vehicle_id,
        driver_id,
        cash_collected,
        cash_deposited,
        received_by,
        receipt_number,
        notes
    ) VALUES (
        p_deposit_date,
        p_vehicle_id,
        p_driver_id,
        p_cash_collected,
        p_cash_deposited,
        p_received_by,
        p_receipt_number,
        p_notes
    )
    ON CONFLICT (vehicle_id, deposit_date)
    DO UPDATE SET
        cash_collected = EXCLUDED.cash_collected,
        cash_deposited = EXCLUDED.cash_deposited,
        received_by = EXCLUDED.received_by,
        receipt_number = EXCLUDED.receipt_number,
        notes = EXCLUDED.notes;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Cash deposit recorded successfully',
        'variance', v_variance,
        'alert', CASE WHEN v_variance < 0 THEN 'Cash shortage detected' ELSE NULL END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION record_vehicle_cash_deposit TO authenticated, service_role;
```

---

### **2. Record Fuel with Allowance**

```sql
-- Update existing function to include allowance
CREATE OR REPLACE FUNCTION record_fuel_entry(
    p_vehicle_id uuid,
    p_driver_id uuid,
    p_fuel_date date,
    p_fuel_type text,
    p_quantity_liters numeric,
    p_price_per_liter numeric,
    p_odometer_reading numeric,
    p_allowance_amount numeric DEFAULT NULL, -- NEW
    p_fuel_station text DEFAULT NULL,
    p_payment_method text DEFAULT 'CASH',
    p_receipt_number text DEFAULT NULL,
    p_location_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_fuel_log_number text;
    v_total_amount numeric;
    v_variance numeric;
BEGIN
    -- Generate fuel log number
    SELECT 'FUEL-' || TO_CHAR(p_fuel_date, 'YYYYMM') || '-' || 
           LPAD(COALESCE(MAX(SUBSTRING(fuel_log_number FROM 14)::integer), 0) + 1::text, 4, '0')
    INTO v_fuel_log_number
    FROM fuel_logs
    WHERE fuel_log_number LIKE 'FUEL-' || TO_CHAR(p_fuel_date, 'YYYYMM') || '%';

    v_total_amount := p_quantity_liters * p_price_per_liter;
    
    IF p_allowance_amount IS NOT NULL THEN
        v_variance := p_allowance_amount - v_total_amount;
    END IF;

    -- Insert fuel log
    INSERT INTO fuel_logs (
        fuel_log_number,
        vehicle_id,
        driver_id,
        fuel_date,
        fuel_station,
        fuel_type,
        quantity_liters,
        price_per_liter,
        odometer_reading,
        allowance_amount,
        payment_method,
        receipt_number,
        location_id,
        created_by
    ) VALUES (
        v_fuel_log_number,
        p_vehicle_id,
        p_driver_id,
        p_fuel_date,
        p_fuel_station,
        p_fuel_type,
        p_quantity_liters,
        p_price_per_liter,
        p_odometer_reading,
        p_allowance_amount,
        p_payment_method,
        p_receipt_number,
        p_location_id,
        auth.uid()
    );

    RETURN json_build_object(
        'success', true,
        'message', 'Fuel entry recorded successfully',
        'fuel_log_number', v_fuel_log_number,
        'total_amount', v_total_amount,
        'allowance_given', p_allowance_amount,
        'variance', v_variance,
        'alert', CASE 
            WHEN v_variance < 0 THEN 'Fuel cost exceeded allowance by PKR ' || ABS(v_variance)
            WHEN v_variance > 0 THEN 'Driver saved PKR ' || v_variance
            ELSE NULL 
        END
    );
END;
$$;
```

---

### **3. Assign Dynamic Route**

```sql
CREATE OR REPLACE FUNCTION assign_daily_route(
    p_assignment_date date,
    p_vehicle_id uuid,
    p_driver_id uuid,
    p_route_id uuid DEFAULT NULL,
    p_route_description text DEFAULT NULL, -- NEW (for ad-hoc routes)
    p_is_adhoc boolean DEFAULT false, -- NEW
    p_start_odometer numeric DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if assignment already exists
    IF EXISTS (
        SELECT 1 FROM route_assignments
        WHERE vehicle_id = p_vehicle_id
          AND assignment_date = p_assignment_date
    ) THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Route already assigned for this vehicle on this date'
        );
    END IF;

    -- Create assignment
    INSERT INTO route_assignments (
        assignment_date,
        vehicle_id,
        driver_id,
        route_id,
        route_description,
        is_adhoc,
        start_odometer,
        status
    ) VALUES (
        p_assignment_date,
        p_vehicle_id,
        p_driver_id,
        p_route_id,
        p_route_description,
        p_is_adhoc,
        p_start_odometer,
        'PLANNED'
    );

    RETURN json_build_object(
        'success', true,
        'message', CASE 
            WHEN p_is_adhoc THEN 'Ad-hoc route assigned: ' || p_route_description
            ELSE 'Route assigned successfully'
        END
    );
END;
$$;
```

---

## 📊 UPDATED DAILY REPORT

### **Enhanced Daily Report Function:**

```sql
CREATE OR REPLACE FUNCTION create_vehicle_daily_report(
    p_report_date date,
    p_vehicle_id uuid,
    p_driver_id uuid,
    p_route_assignment_id uuid DEFAULT NULL,
    p_opening_stock_value numeric DEFAULT 0,
    p_closing_stock_value numeric DEFAULT 0,
    p_cash_collected numeric DEFAULT 0,
    p_credit_sales numeric DEFAULT 0,
    p_fuel_allowance_given numeric DEFAULT 0, -- NEW
    p_fuel_cost numeric DEFAULT 0,
    p_other_expenses numeric DEFAULT 0,
    p_customers_visited integer DEFAULT 0,
    p_successful_sales integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_sales numeric;
    v_distance_traveled numeric;
    v_fuel_consumed numeric;
    v_fuel_efficiency numeric;
    v_fuel_variance numeric;
BEGIN
    -- Calculate total sales (stock sold)
    v_total_sales := (p_opening_stock_value - p_closing_stock_value);
    
    -- Note: Cash + Credit should equal stock sold
    -- If not, there's a discrepancy

    -- Get distance traveled from route assignment
    IF p_route_assignment_id IS NOT NULL THEN
        SELECT distance_traveled
        INTO v_distance_traveled
        FROM route_assignments
        WHERE id = p_route_assignment_id;
    END IF;

    -- Get fuel consumed on this date
    SELECT COALESCE(SUM(quantity_liters), 0)
    INTO v_fuel_consumed
    FROM fuel_logs
    WHERE vehicle_id = p_vehicle_id
      AND fuel_date = p_report_date;

    -- Calculate fuel efficiency
    IF v_fuel_consumed > 0 AND v_distance_traveled > 0 THEN
        v_fuel_efficiency := v_distance_traveled / v_fuel_consumed;
    END IF;
    
    -- Calculate fuel allowance variance
    v_fuel_variance := p_fuel_allowance_given - p_fuel_cost;

    -- Insert or update report
    INSERT INTO vehicle_daily_reports (
        report_date,
        vehicle_id,
        driver_id,
        route_assignment_id,
        opening_stock_value,
        closing_stock_value,
        total_sales,
        cash_collected,
        credit_sales,
        fuel_allowance_given,
        fuel_cost,
        other_expenses,
        customers_visited,
        successful_sales,
        distance_traveled,
        fuel_consumed,
        fuel_efficiency,
        status
    ) VALUES (
        p_report_date,
        p_vehicle_id,
        p_driver_id,
        p_route_assignment_id,
        p_opening_stock_value,
        p_closing_stock_value,
        v_total_sales,
        p_cash_collected,
        p_credit_sales,
        p_fuel_allowance_given,
        p_fuel_cost,
        p_other_expenses,
        p_customers_visited,
        p_successful_sales,
        v_distance_traveled,
        v_fuel_consumed,
        v_fuel_efficiency,
        'SUBMITTED'
    )
    ON CONFLICT (vehicle_id, report_date)
    DO UPDATE SET
        opening_stock_value = EXCLUDED.opening_stock_value,
        closing_stock_value = EXCLUDED.closing_stock_value,
        total_sales = EXCLUDED.total_sales,
        cash_collected = EXCLUDED.cash_collected,
        credit_sales = EXCLUDED.credit_sales,
        fuel_allowance_given = EXCLUDED.fuel_allowance_given,
        fuel_cost = EXCLUDED.fuel_cost,
        other_expenses = EXCLUDED.other_expenses,
        customers_visited = EXCLUDED.customers_visited,
        successful_sales = EXCLUDED.successful_sales,
        distance_traveled = EXCLUDED.distance_traveled,
        fuel_consumed = EXCLUDED.fuel_consumed,
        fuel_efficiency = EXCLUDED.fuel_efficiency,
        status = 'SUBMITTED',
        submitted_at = now();

    RETURN json_build_object(
        'success', true,
        'message', 'Daily report submitted successfully',
        'total_sales', v_total_sales,
        'fuel_efficiency', v_fuel_efficiency,
        'fuel_allowance_variance', v_fuel_variance,
        'alerts', json_build_array(
            CASE WHEN v_fuel_variance < 0 
                THEN json_build_object('type', 'warning', 'message', 'Fuel cost exceeded allowance')
                ELSE NULL END,
            CASE WHEN (p_cash_collected + p_credit_sales) != v_total_sales
                THEN json_build_object('type', 'error', 'message', 'Sales amount mismatch')
                ELSE NULL END
        )
    );
END;
$$;
```

---

## 🎯 UPDATED DAILY WORKFLOW EXAMPLE

### **January 13, 2026 - Vehicle VEH-001:**

**Morning (8:00 AM):**
```typescript
// 1. Check vehicle stock
const { data: currentStock } = await supabase
  .from('inventory_stock_levels')
  .select('*')
  .eq('location_id', vehicle1LocationId);

// Current stock: PKR 200,000 (enough for today)
// NO stock transfer needed

// 2. Give fuel allowance
const fuelAllowance = 3000; // PKR 3,000 for the day

// 3. Assign ad-hoc route
await supabase.rpc('assign_daily_route', {
  p_assignment_date: '2026-01-13',
  p_vehicle_id: vehicle1Id,
  p_driver_id: driverId,
  p_route_id: null,
  p_route_description: 'Rawalpindi Commercial Market - New customer prospecting',
  p_is_adhoc: true,
  p_start_odometer: 15500
});
```

**During Day:**
```typescript
// 4. Driver buys fuel
await supabase.rpc('record_fuel_entry', {
  p_vehicle_id: vehicle1Id,
  p_driver_id: driverId,
  p_fuel_date: '2026-01-13',
  p_fuel_type: 'PETROL',
  p_quantity_liters: 25,
  p_price_per_liter: 290,
  p_odometer_reading: 15520,
  p_allowance_amount: 3000, // Allowance given
  p_fuel_station: 'PSO Rawalpindi',
  p_receipt_number: 'PSO-12345'
});

// Total fuel cost: 25 × 290 = PKR 7,250
// Allowance: PKR 3,000
// Variance: -4,250 (OVER budget - needs manager approval)

// 5. Sales throughout day (POS handles automatically)
```

**Evening (6:00 PM):**
```typescript
// 6. Complete route
await supabase.rpc('complete_daily_route', {
  p_assignment_id: assignmentId,
  p_end_odometer: 15650,
  p_end_time: '18:00:00'
});
// Distance: 150 km

// 7. Cash deposit
await supabase.rpc('record_vehicle_cash_deposit', {
  p_deposit_date: '2026-01-13',
  p_vehicle_id: vehicle1Id,
  p_driver_id: driverId,
  p_cash_collected: 85000,
  p_cash_deposited: 85000, // Perfect match
  p_received_by: cashierId,
  p_receipt_number: 'CASH-2026-001'
});

// 8. Daily report
await supabase.rpc('create_vehicle_daily_report', {
  p_report_date: '2026-01-13',
  p_vehicle_id: vehicle1Id,
  p_driver_id: driverId,
  p_route_assignment_id: assignmentId,
  p_opening_stock_value: 200000, // Stock in vehicle at start
  p_closing_stock_value: 100000, // Stock remaining in vehicle
  p_cash_collected: 85000,
  p_credit_sales: 15000,
  p_fuel_allowance_given: 3000,
  p_fuel_cost: 7250,
  p_other_expenses: 500,
  p_customers_visited: 20,
  p_successful_sales: 15
});

// Results:
// Total Sales: PKR 100,000 (stock sold)
// Cash + Credit: PKR 100,000 ✓ Match!
// Fuel Efficiency: 150km / 25L = 6 km/L
// Fuel Variance: -PKR 4,250 (needs approval)

// 9. Stock stays in vehicle (PKR 100,000)
// 10. Vehicle locked
```

---

## 🚨 IMPORTANT ALERTS & VALIDATIONS

### **1. Fuel Allowance Variance:**
```typescript
if (fuelVariance < 0) {
  // Driver spent MORE than allowance
  alert('⚠️ Fuel cost exceeded allowance by PKR ' + Math.abs(fuelVariance));
  // Requires manager approval
}
```

### **2. Cash Shortage:**
```typescript
if (cashVariance < 0) {
  // Cash deposited LESS than collected
  alert('🚨 Cash shortage detected: PKR ' + Math.abs(cashVariance));
  // Immediate investigation required
}
```

### **3. Sales Mismatch:**
```typescript
if ((cashCollected + creditSales) !== totalSales) {
  // Sales amount doesn't match stock sold
  alert('⚠️ Sales reconciliation error');
  // Check for missing transactions
}
```

---

## ✅ SUMMARY OF CHANGES

**Based on Client Clarifications:**

1. ✅ **Stock Management:**
   - Removed daily stock return workflow
   - Added rolling stock tracking in vehicles
   - Only restock when low

2. ✅ **Cash Handling:**
   - Added `vehicle_cash_deposits` table
   - Daily cash deposit tracking
   - Variance detection (shortage alerts)

3. ✅ **Routes:**
   - Added ad-hoc route support
   - `route_description` field for dynamic routes
   - `is_adhoc` flag

4. ✅ **Fuel:**
   - Added `allowance_amount` to fuel_logs
   - Variance tracking (allowance vs actual)
   - Over-budget alerts

5. ✅ **Maintenance:**
   - Already supports external service centers
   - Service provider field captures this

6. ✅ **Driver Compensation:**
   - No commission tracking needed
   - Drivers on fixed salary (in HR module)
   - Only salespeople get commission

---

## 📋 NEXT STEPS

1. **Apply Schema Updates:**
   - Add fuel allowance columns
   - Add cash deposit table
   - Add dynamic route fields

2. **Update Functions:**
   - Fuel entry with allowance
   - Cash deposit recording
   - Dynamic route assignment

3. **Build UI:**
   - Cash deposit form (end of day)
   - Fuel allowance tracking
   - Variance alerts dashboard
   - Stock level monitoring per vehicle

4. **Manager Dashboard:**
   - Fuel over-budget alerts
   - Cash shortage alerts
   - Vehicle stock levels
   - Daily performance summary

---

**This matches the ACTUAL business workflow!** ✅

Would you like me to create the schema updates and UI components for these changes?
