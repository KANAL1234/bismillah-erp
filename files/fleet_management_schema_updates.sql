-- ========================================
-- FLEET MANAGEMENT - SCHEMA UPDATES
-- Based on Client Clarifications (Jan 14, 2026)
-- ========================================

-- ========================================
-- 1. ADD FUEL ALLOWANCE TRACKING
-- ========================================

ALTER TABLE fuel_logs
ADD COLUMN IF NOT EXISTS allowance_amount numeric(15,2),
ADD COLUMN IF NOT EXISTS variance numeric(15,2) 
  GENERATED ALWAYS AS (COALESCE(allowance_amount, 0) - total_amount) STORED;

COMMENT ON COLUMN fuel_logs.allowance_amount IS 'Fuel allowance given to driver for this entry';
COMMENT ON COLUMN fuel_logs.variance IS 'Allowance variance: Positive = saved money, Negative = over budget';

-- ========================================
-- 2. VEHICLE CASH DEPOSITS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS public.vehicle_cash_deposits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    deposit_date date NOT NULL DEFAULT CURRENT_DATE,
    vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    driver_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    cash_collected numeric(15,2) NOT NULL,
    cash_deposited numeric(15,2) NOT NULL,
    variance numeric(15,2) GENERATED ALWAYS AS (cash_deposited - cash_collected) STORED,
    received_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    receipt_number text,
    notes text,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT unique_vehicle_deposit_date UNIQUE (vehicle_id, deposit_date)
);

CREATE INDEX idx_cash_deposits_date ON vehicle_cash_deposits(deposit_date);
CREATE INDEX idx_cash_deposits_vehicle ON vehicle_cash_deposits(vehicle_id);
CREATE INDEX idx_cash_deposits_driver ON vehicle_cash_deposits(driver_id);
CREATE INDEX idx_cash_deposits_variance ON vehicle_cash_deposits(variance) WHERE variance != 0;

COMMENT ON TABLE vehicle_cash_deposits IS 'Daily cash deposits from vehicles with variance tracking (shortage detection)';
COMMENT ON COLUMN vehicle_cash_deposits.variance IS 'Cash variance: Negative = shortage, Positive = excess';

-- Enable RLS
ALTER TABLE vehicle_cash_deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view cash deposits" ON vehicle_cash_deposits FOR SELECT TO authenticated USING (true);

-- ========================================
-- 3. DYNAMIC ROUTES SUPPORT
-- ========================================

ALTER TABLE route_assignments
ADD COLUMN IF NOT EXISTS route_description text,
ADD COLUMN IF NOT EXISTS is_adhoc boolean DEFAULT false;

COMMENT ON COLUMN route_assignments.route_description IS 'Description for ad-hoc/dynamic routes (e.g., "Rawalpindi Market Area - New customer prospecting")';
COMMENT ON COLUMN route_assignments.is_adhoc IS 'True if route is dynamic/ad-hoc, False if using pre-defined route';

-- ========================================
-- 4. FUEL ALLOWANCE IN DAILY REPORTS
-- ========================================

ALTER TABLE vehicle_daily_reports
ADD COLUMN IF NOT EXISTS fuel_allowance_given numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS fuel_allowance_variance numeric(15,2) 
  GENERATED ALWAYS AS (COALESCE(fuel_allowance_given, 0) - COALESCE(fuel_cost, 0)) STORED;

COMMENT ON COLUMN vehicle_daily_reports.fuel_allowance_given IS 'Total fuel allowance given to driver for the day';
COMMENT ON COLUMN vehicle_daily_reports.fuel_allowance_variance IS 'Allowance vs actual: Positive = saved, Negative = over budget';

-- ========================================
-- 5. UPDATED FUNCTIONS
-- ========================================

-- Update record_fuel_entry to include allowance
CREATE OR REPLACE FUNCTION record_fuel_entry(
    p_vehicle_id uuid,
    p_driver_id uuid,
    p_fuel_date date,
    p_fuel_type text,
    p_quantity_liters numeric,
    p_price_per_liter numeric,
    p_odometer_reading numeric,
    p_allowance_amount numeric DEFAULT NULL,
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
    v_alert text;
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
        
        IF v_variance < 0 THEN
            v_alert := 'Fuel cost exceeded allowance by PKR ' || ABS(v_variance);
        ELSIF v_variance > 0 THEN
            v_alert := 'Driver saved PKR ' || v_variance || ' from allowance';
        END IF;
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
        'alert', v_alert
    );
END;
$$;

-- New function to record cash deposits
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
    v_alert text;
BEGIN
    v_variance := p_cash_deposited - p_cash_collected;
    
    -- Check for shortage
    IF v_variance < 0 THEN
        v_alert := 'ALERT: Cash shortage of PKR ' || ABS(v_variance);
    ELSIF v_variance > 0 THEN
        v_alert := 'NOTE: Excess cash of PKR ' || v_variance;
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
        'cash_collected', p_cash_collected,
        'cash_deposited', p_cash_deposited,
        'variance', v_variance,
        'alert', v_alert,
        'severity', CASE 
            WHEN v_variance < 0 THEN 'critical'
            WHEN v_variance > 0 THEN 'warning'
            ELSE 'success'
        END
    );
END;
$$;

-- Update assign_daily_route to support ad-hoc routes
CREATE OR REPLACE FUNCTION assign_daily_route(
    p_assignment_date date,
    p_vehicle_id uuid,
    p_driver_id uuid,
    p_route_id uuid DEFAULT NULL,
    p_route_description text DEFAULT NULL,
    p_is_adhoc boolean DEFAULT false,
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

    -- Validate: either route_id OR route_description required
    IF p_route_id IS NULL AND p_route_description IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Either route_id or route_description is required'
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
        END,
        'is_adhoc', p_is_adhoc
    );
END;
$$;

-- Get cash shortage alerts
CREATE OR REPLACE FUNCTION get_cash_shortage_alerts(
    p_date_from date DEFAULT NULL,
    p_date_to date DEFAULT NULL
)
RETURNS TABLE (
    deposit_date date,
    vehicle_code text,
    registration_number text,
    driver_name text,
    cash_collected numeric,
    cash_deposited numeric,
    shortage numeric,
    received_by_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vcd.deposit_date,
        v.vehicle_code,
        v.registration_number,
        e.full_name as driver_name,
        vcd.cash_collected,
        vcd.cash_deposited,
        ABS(vcd.variance) as shortage,
        up.full_name as received_by_name
    FROM vehicle_cash_deposits vcd
    JOIN vehicles v ON v.id = vcd.vehicle_id
    JOIN employees e ON e.id = vcd.driver_id
    LEFT JOIN user_profiles up ON up.id = vcd.received_by
    WHERE vcd.variance < 0 -- Only shortages
      AND vcd.deposit_date BETWEEN COALESCE(p_date_from, '2000-01-01') 
                               AND COALESCE(p_date_to, CURRENT_DATE)
    ORDER BY vcd.deposit_date DESC, ABS(vcd.variance) DESC;
END;
$$;

-- Get fuel over-budget alerts
CREATE OR REPLACE FUNCTION get_fuel_overbudget_alerts(
    p_date_from date DEFAULT NULL,
    p_date_to date DEFAULT NULL
)
RETURNS TABLE (
    fuel_date date,
    vehicle_code text,
    registration_number text,
    driver_name text,
    allowance_given numeric,
    actual_cost numeric,
    over_budget numeric,
    fuel_station text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fl.fuel_date,
        v.vehicle_code,
        v.registration_number,
        e.full_name as driver_name,
        fl.allowance_amount as allowance_given,
        fl.total_amount as actual_cost,
        ABS(fl.variance) as over_budget,
        fl.fuel_station
    FROM fuel_logs fl
    JOIN vehicles v ON v.id = fl.vehicle_id
    JOIN employees e ON e.id = fl.driver_id
    WHERE fl.variance < 0 -- Only over budget
      AND fl.allowance_amount IS NOT NULL
      AND fl.fuel_date BETWEEN COALESCE(p_date_from, '2000-01-01') 
                           AND COALESCE(p_date_to, CURRENT_DATE)
    ORDER BY fl.fuel_date DESC, ABS(fl.variance) DESC;
END;
$$;

-- ========================================
-- GRANT PERMISSIONS
-- ========================================

GRANT EXECUTE ON FUNCTION record_vehicle_cash_deposit TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_cash_shortage_alerts TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_fuel_overbudget_alerts TO authenticated, service_role;

-- ========================================
-- VERIFICATION
-- ========================================

SELECT 'Fleet Management Schema Updated Successfully!' as status,
       EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'fuel_logs' AND column_name = 'allowance_amount') as fuel_allowance_added,
       EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_name = 'vehicle_cash_deposits') as cash_deposits_table_created,
       EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'route_assignments' AND column_name = 'is_adhoc') as dynamic_routes_added;
