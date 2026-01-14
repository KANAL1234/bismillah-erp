-- ========================================
-- FLEET MANAGEMENT RPC FUNCTIONS
-- Complete Business Logic
-- ========================================

-- ========================================
-- 1. RECORD FUEL ENTRY
-- ========================================

CREATE OR REPLACE FUNCTION record_fuel_entry(
    p_vehicle_id uuid,
    p_driver_id uuid,
    p_fuel_date date,
    p_fuel_type text,
    p_quantity_liters numeric,
    p_price_per_liter numeric,
    p_odometer_reading numeric,
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
BEGIN
    -- Generate fuel log number
    SELECT 'FUEL-' || TO_CHAR(p_fuel_date, 'YYYYMM') || '-' || 
           LPAD(COALESCE(MAX(SUBSTRING(fuel_log_number FROM 14)::integer), 0) + 1::text, 4, '0')
    INTO v_fuel_log_number
    FROM fuel_logs
    WHERE fuel_log_number LIKE 'FUEL-' || TO_CHAR(p_fuel_date, 'YYYYMM') || '%';

    v_total_amount := p_quantity_liters * p_price_per_liter;

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
        p_payment_method,
        p_receipt_number,
        p_location_id,
        auth.uid()
    );

    RETURN json_build_object(
        'success', true,
        'message', 'Fuel entry recorded successfully',
        'fuel_log_number', v_fuel_log_number,
        'total_amount', v_total_amount
    );
END;
$$;

-- ========================================
-- 2. RECORD MAINTENANCE
-- ========================================

CREATE OR REPLACE FUNCTION record_maintenance(
    p_vehicle_id uuid,
    p_maintenance_type_id uuid,
    p_maintenance_date date,
    p_odometer_reading numeric,
    p_description text,
    p_labor_cost numeric DEFAULT 0,
    p_parts_cost numeric DEFAULT 0,
    p_service_provider text DEFAULT NULL,
    p_downtime_days integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_maintenance_number text;
    v_total_cost numeric;
    v_frequency_km integer;
    v_frequency_days integer;
    v_next_service_date date;
    v_next_service_km numeric;
BEGIN
    -- Generate maintenance number
    SELECT 'MAINT-' || TO_CHAR(p_maintenance_date, 'YYYYMM') || '-' || 
           LPAD(COALESCE(MAX(SUBSTRING(maintenance_number FROM 16)::integer), 0) + 1::text, 4, '0')
    INTO v_maintenance_number
    FROM maintenance_logs
    WHERE maintenance_number LIKE 'MAINT-' || TO_CHAR(p_maintenance_date, 'YYYYMM') || '%';

    v_total_cost := p_labor_cost + p_parts_cost;

    -- Get recommended frequency
    SELECT recommended_frequency_km, recommended_frequency_days
    INTO v_frequency_km, v_frequency_days
    FROM maintenance_types
    WHERE id = p_maintenance_type_id;

    -- Calculate next service
    IF v_frequency_km IS NOT NULL THEN
        v_next_service_km := p_odometer_reading + v_frequency_km;
    END IF;

    IF v_frequency_days IS NOT NULL THEN
        v_next_service_date := p_maintenance_date + v_frequency_days;
    END IF;

    -- Insert maintenance log
    INSERT INTO maintenance_logs (
        maintenance_number,
        vehicle_id,
        maintenance_type_id,
        maintenance_date,
        odometer_reading,
        service_provider,
        description,
        labor_cost,
        parts_cost,
        downtime_days,
        next_service_date,
        next_service_km,
        status,
        performed_by
    ) VALUES (
        v_maintenance_number,
        p_vehicle_id,
        p_maintenance_type_id,
        p_maintenance_date,
        p_odometer_reading,
        p_service_provider,
        p_description,
        p_labor_cost,
        p_parts_cost,
        p_downtime_days,
        v_next_service_date,
        v_next_service_km,
        'COMPLETED',
        auth.uid()
    );

    RETURN json_build_object(
        'success', true,
        'message', 'Maintenance recorded successfully',
        'maintenance_number', v_maintenance_number,
        'total_cost', v_total_cost,
        'next_service_date', v_next_service_date,
        'next_service_km', v_next_service_km
    );
END;
$$;

-- ========================================
-- 3. ASSIGN DAILY ROUTE
-- ========================================

CREATE OR REPLACE FUNCTION assign_daily_route(
    p_assignment_date date,
    p_vehicle_id uuid,
    p_driver_id uuid,
    p_route_id uuid DEFAULT NULL,
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
        start_odometer,
        status
    ) VALUES (
        p_assignment_date,
        p_vehicle_id,
        p_driver_id,
        p_route_id,
        p_start_odometer,
        'PLANNED'
    );

    RETURN json_build_object(
        'success', true,
        'message', 'Route assigned successfully'
    );
END;
$$;

-- ========================================
-- 4. COMPLETE DAILY ROUTE
-- ========================================

CREATE OR REPLACE FUNCTION complete_daily_route(
    p_assignment_id uuid,
    p_end_odometer numeric,
    p_end_time time DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_time time;
    v_total_hours numeric;
BEGIN
    -- Get start time
    SELECT start_time INTO v_start_time
    FROM route_assignments
    WHERE id = p_assignment_id;

    -- Calculate total hours
    IF v_start_time IS NOT NULL AND p_end_time IS NOT NULL THEN
        v_total_hours := EXTRACT(EPOCH FROM (p_end_time - v_start_time)) / 3600;
    END IF;

    -- Update assignment
    UPDATE route_assignments
    SET end_odometer = p_end_odometer,
        end_time = p_end_time,
        total_hours = v_total_hours,
        status = 'COMPLETED',
        updated_at = now()
    WHERE id = p_assignment_id;

    RETURN json_build_object(
        'success', true,
        'message', 'Route completed successfully',
        'total_hours', v_total_hours
    );
END;
$$;

-- ========================================
-- 5. CREATE VEHICLE DAILY REPORT
-- ========================================

CREATE OR REPLACE FUNCTION create_vehicle_daily_report(
    p_report_date date,
    p_vehicle_id uuid,
    p_driver_id uuid,
    p_route_assignment_id uuid DEFAULT NULL,
    p_opening_stock_value numeric DEFAULT 0,
    p_closing_stock_value numeric DEFAULT 0,
    p_cash_collected numeric DEFAULT 0,
    p_credit_sales numeric DEFAULT 0,
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
BEGIN
    -- Calculate total sales
    v_total_sales := (p_opening_stock_value - p_closing_stock_value) + p_cash_collected + p_credit_sales;

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
        'fuel_efficiency', v_fuel_efficiency
    );
END;
$$;

-- ========================================
-- 6. GET VEHICLE PERFORMANCE REPORT
-- ========================================

CREATE OR REPLACE FUNCTION get_vehicle_performance_report(
    p_vehicle_id uuid DEFAULT NULL,
    p_date_from date DEFAULT NULL,
    p_date_to date DEFAULT NULL
)
RETURNS TABLE (
    vehicle_code text,
    registration_number text,
    assigned_driver text,
    total_sales numeric,
    cash_collected numeric,
    credit_sales numeric,
    total_fuel_cost numeric,
    total_maintenance_cost numeric,
    total_distance numeric,
    average_fuel_efficiency numeric,
    days_active integer,
    customers_visited integer,
    successful_sales integer,
    net_profit numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.vehicle_code,
        v.registration_number,
        e.full_name as assigned_driver,
        COALESCE(SUM(vdr.total_sales), 0) as total_sales,
        COALESCE(SUM(vdr.cash_collected), 0) as cash_collected,
        COALESCE(SUM(vdr.credit_sales), 0) as credit_sales,
        COALESCE(SUM(vdr.fuel_cost), 0) as total_fuel_cost,
        COALESCE(
            (SELECT SUM(total_cost)
             FROM maintenance_logs ml
             WHERE ml.vehicle_id = v.id
               AND ml.maintenance_date BETWEEN COALESCE(p_date_from, '2000-01-01') 
               AND COALESCE(p_date_to, CURRENT_DATE)),
            0
        ) as total_maintenance_cost,
        COALESCE(SUM(vdr.distance_traveled), 0) as total_distance,
        COALESCE(AVG(vdr.fuel_efficiency), 0) as average_fuel_efficiency,
        COUNT(DISTINCT vdr.report_date)::integer as days_active,
        COALESCE(SUM(vdr.customers_visited), 0)::integer as customers_visited,
        COALESCE(SUM(vdr.successful_sales), 0)::integer as successful_sales,
        COALESCE(SUM(vdr.total_sales), 0) - 
        COALESCE(SUM(vdr.fuel_cost), 0) - 
        COALESCE(
            (SELECT SUM(total_cost)
             FROM maintenance_logs ml
             WHERE ml.vehicle_id = v.id
               AND ml.maintenance_date BETWEEN COALESCE(p_date_from, '2000-01-01') 
               AND COALESCE(p_date_to, CURRENT_DATE)),
            0
        ) as net_profit
    FROM vehicles v
    LEFT JOIN employees e ON e.id = v.assigned_driver_id
    LEFT JOIN vehicle_daily_reports vdr ON vdr.vehicle_id = v.id
        AND vdr.report_date BETWEEN COALESCE(p_date_from, '2000-01-01') 
        AND COALESCE(p_date_to, CURRENT_DATE)
    WHERE (p_vehicle_id IS NULL OR v.id = p_vehicle_id)
      AND v.status = 'ACTIVE'
    GROUP BY v.id, v.vehicle_code, v.registration_number, e.full_name
    ORDER BY total_sales DESC;
END;
$$;

-- ========================================
-- 7. GET FUEL CONSUMPTION REPORT
-- ========================================

CREATE OR REPLACE FUNCTION get_fuel_consumption_report(
    p_vehicle_id uuid DEFAULT NULL,
    p_date_from date DEFAULT NULL,
    p_date_to date DEFAULT NULL
)
RETURNS TABLE (
    vehicle_code text,
    registration_number text,
    total_liters numeric,
    total_cost numeric,
    average_price_per_liter numeric,
    total_distance numeric,
    average_fuel_efficiency numeric,
    entries_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.vehicle_code,
        v.registration_number,
        COALESCE(SUM(fl.quantity_liters), 0) as total_liters,
        COALESCE(SUM(fl.total_amount), 0) as total_cost,
        COALESCE(AVG(fl.price_per_liter), 0) as average_price_per_liter,
        COALESCE(SUM(fl.distance_traveled), 0) as total_distance,
        COALESCE(AVG(fl.fuel_efficiency), 0) as average_fuel_efficiency,
        COUNT(fl.id) as entries_count
    FROM vehicles v
    LEFT JOIN fuel_logs fl ON fl.vehicle_id = v.id
        AND fl.fuel_date BETWEEN COALESCE(p_date_from, '2000-01-01') 
        AND COALESCE(p_date_to, CURRENT_DATE)
    WHERE (p_vehicle_id IS NULL OR v.id = p_vehicle_id)
      AND v.status = 'ACTIVE'
    GROUP BY v.id, v.vehicle_code, v.registration_number
    ORDER BY total_cost DESC;
END;
$$;

-- ========================================
-- 8. GET MAINTENANCE SCHEDULE
-- ========================================

CREATE OR REPLACE FUNCTION get_maintenance_schedule(
    p_vehicle_id uuid DEFAULT NULL
)
RETURNS TABLE (
    vehicle_code text,
    registration_number text,
    current_odometer numeric,
    maintenance_type text,
    last_service_date date,
    last_service_km numeric,
    next_service_date date,
    next_service_km numeric,
    days_until_due integer,
    km_until_due numeric,
    is_overdue boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.vehicle_code,
        v.registration_number,
        v.current_odometer,
        mt.type_name as maintenance_type,
        ml.maintenance_date as last_service_date,
        ml.odometer_reading as last_service_km,
        ml.next_service_date,
        ml.next_service_km,
        CASE 
            WHEN ml.next_service_date IS NOT NULL 
            THEN (ml.next_service_date - CURRENT_DATE)::integer
            ELSE NULL
        END as days_until_due,
        CASE 
            WHEN ml.next_service_km IS NOT NULL 
            THEN ml.next_service_km - v.current_odometer
            ELSE NULL
        END as km_until_due,
        CASE 
            WHEN ml.next_service_date IS NOT NULL 
                 AND ml.next_service_date < CURRENT_DATE 
            THEN true
            WHEN ml.next_service_km IS NOT NULL 
                 AND ml.next_service_km < v.current_odometer 
            THEN true
            ELSE false
        END as is_overdue
    FROM vehicles v
    CROSS JOIN maintenance_types mt
    LEFT JOIN LATERAL (
        SELECT *
        FROM maintenance_logs
        WHERE vehicle_id = v.id
          AND maintenance_type_id = mt.id
          AND status = 'COMPLETED'
        ORDER BY maintenance_date DESC
        LIMIT 1
    ) ml ON true
    WHERE (p_vehicle_id IS NULL OR v.id = p_vehicle_id)
      AND v.status = 'ACTIVE'
      AND mt.is_active = true
    ORDER BY v.vehicle_code, is_overdue DESC, days_until_due ASC;
END;
$$;

-- ========================================
-- 9. GET DRIVER PERFORMANCE
-- ========================================

CREATE OR REPLACE FUNCTION get_driver_performance(
    p_driver_id uuid DEFAULT NULL,
    p_date_from date DEFAULT NULL,
    p_date_to date DEFAULT NULL
)
RETURNS TABLE (
    driver_name text,
    employee_code text,
    total_sales numeric,
    cash_collected numeric,
    credit_sales numeric,
    customers_visited integer,
    successful_sales integer,
    days_worked integer,
    average_sales_per_day numeric,
    success_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.full_name as driver_name,
        e.employee_code,
        COALESCE(SUM(vdr.total_sales), 0) as total_sales,
        COALESCE(SUM(vdr.cash_collected), 0) as cash_collected,
        COALESCE(SUM(vdr.credit_sales), 0) as credit_sales,
        COALESCE(SUM(vdr.customers_visited), 0)::integer as customers_visited,
        COALESCE(SUM(vdr.successful_sales), 0)::integer as successful_sales,
        COUNT(DISTINCT vdr.report_date)::integer as days_worked,
        CASE 
            WHEN COUNT(DISTINCT vdr.report_date) > 0 
            THEN COALESCE(SUM(vdr.total_sales), 0) / COUNT(DISTINCT vdr.report_date)
            ELSE 0
        END as average_sales_per_day,
        CASE 
            WHEN SUM(vdr.customers_visited) > 0 
            THEN (SUM(vdr.successful_sales)::numeric / SUM(vdr.customers_visited)) * 100
            ELSE 0
        END as success_rate
    FROM employees e
    LEFT JOIN vehicle_daily_reports vdr ON vdr.driver_id = e.id
        AND vdr.report_date BETWEEN COALESCE(p_date_from, '2000-01-01') 
        AND COALESCE(p_date_to, CURRENT_DATE)
    WHERE (p_driver_id IS NULL OR e.id = p_driver_id)
      AND e.employment_status = 'ACTIVE'
    GROUP BY e.id, e.full_name, e.employee_code
    HAVING COUNT(vdr.id) > 0
    ORDER BY total_sales DESC;
END;
$$;

-- ========================================
-- GRANT PERMISSIONS
-- ========================================

GRANT EXECUTE ON FUNCTION record_fuel_entry TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION record_maintenance TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION assign_daily_route TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION complete_daily_route TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_vehicle_daily_report TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_vehicle_performance_report TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_fuel_consumption_report TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_maintenance_schedule TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_driver_performance TO authenticated, service_role;

-- ========================================
-- VERIFICATION
-- ========================================

SELECT 'Fleet Management Functions Created Successfully!' as status;
