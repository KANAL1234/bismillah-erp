-- Create missing calculate_leave_balance function for HR module

CREATE OR REPLACE FUNCTION calculate_leave_balance(
    p_employee_id uuid,
    p_leave_type_id uuid,
    p_date date
) RETURNS numeric AS $$
DECLARE
    v_total_allowed numeric;
    v_used_days numeric;
    v_fiscal_year int;
BEGIN
    v_fiscal_year := EXTRACT(YEAR FROM p_date);

    -- 1. Get total allowed days for this leave type (default 30 if null)
    SELECT COALESCE(days_per_year, 30)
    INTO v_total_allowed
    FROM leave_types
    WHERE id = p_leave_type_id;

    IF v_total_allowed IS NULL THEN
        RETURN 0;
    END IF;

    -- 2. Calculate used days for this employee & leave type in current year
    -- Includes PENDING and APPROVED requests
    SELECT COALESCE(SUM(total_days), 0)
    INTO v_used_days
    FROM leave_requests
    WHERE employee_id = p_employee_id
    AND leave_type_id = p_leave_type_id
    AND status IN ('PENDING', 'APPROVED')
    AND EXTRACT(YEAR FROM from_date) = v_fiscal_year;

    -- 3. Return remaining balance
    RETURN v_total_allowed - v_used_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
