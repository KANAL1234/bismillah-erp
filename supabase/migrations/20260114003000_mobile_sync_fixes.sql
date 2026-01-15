-- Mobile Sync Fixes Migration
-- Adds missing RPC function for fuel entry from mobile app

-- ============================================
-- 1. Create record_fuel_entry RPC Function
-- ============================================

CREATE OR REPLACE FUNCTION public.record_fuel_entry(
    p_vehicle_id uuid,
    p_driver_id uuid,
    p_fuel_date date,
    p_fuel_type text,
    p_quantity_liters numeric,
    p_price_per_liter numeric,
    p_odometer_reading numeric,
    p_fuel_station text DEFAULT NULL,
    p_receipt_number text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_fuel_log_id uuid;
    v_total_cost numeric;
BEGIN
    v_total_cost := p_quantity_liters * p_price_per_liter;

    -- Insert fuel log
    INSERT INTO fleet_fuel_logs (
        vehicle_id, liters, cost_per_liter, total_cost,
        odometer_reading, log_date
    ) VALUES (
        p_vehicle_id, p_quantity_liters, p_price_per_liter, v_total_cost,
        p_odometer_reading, p_fuel_date
    ) RETURNING id INTO v_fuel_log_id;

    -- Update vehicle odometer
    UPDATE fleet_vehicles
    SET current_mileage = p_odometer_reading
    WHERE id = p_vehicle_id;

    -- Try to post to accounting (optional - won't fail if it errors)
    BEGIN
        PERFORM post_fleet_fuel_expense(v_fuel_log_id);
    EXCEPTION WHEN OTHERS THEN
        -- Accounting post failed, but fuel log is saved
        RAISE NOTICE 'Accounting post failed: %', SQLERRM;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'fuel_log_id', v_fuel_log_id,
        'total_cost', v_total_cost
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.record_fuel_entry(uuid, uuid, date, text, numeric, numeric, numeric, text, text) TO authenticated;
