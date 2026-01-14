-- Fix request_leave foreign key violation
-- Use auth.uid() as fallback for created_by instead of p_employee_id

CREATE OR REPLACE FUNCTION request_leave(
    p_employee_id uuid,
    p_leave_type_id uuid,
    p_from_date date,
    p_to_date date,
    p_reason text,
    p_created_by uuid DEFAULT NULL
) RETURNS json AS $$
DECLARE
    v_total_days numeric;
    v_available_balance numeric;
    v_request_number text;
BEGIN
    -- Calculate total days (inclusive)
    v_total_days := (p_to_date - p_from_date) + 1;

    -- Check if leave balance is available
    SELECT calculate_leave_balance(p_employee_id, p_leave_type_id, p_from_date)
    INTO v_available_balance;

    -- Check overlap
    IF EXISTS (
        SELECT 1 FROM leave_requests
        WHERE employee_id = p_employee_id
        AND status IN ('PENDING', 'APPROVED')
        AND (
            (from_date BETWEEN p_from_date AND p_to_date) OR
            (to_date BETWEEN p_from_date AND p_to_date) OR
            (p_from_date BETWEEN from_date AND to_date)
        )
    ) THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Leave request overlaps with existing request'
        );
    END IF;

    -- Check balance (simplified check, real check should look at specific leave type rules)
    -- For now, we assume calc returns remaining balance
    -- Note: calculate_leave_balance func handles logic
    
    -- IMPORTANT: This matches the previous logic, ensuring consistent behavior
    IF v_available_balance < v_total_days THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Insufficient leave balance. Available: ' || v_available_balance::text || ' days'
        );
    END IF;

    -- Generate request number with explicit casting
    SELECT 'LR-' || LPAD((COALESCE(MAX(SUBSTRING(request_number FROM 4)::int), 0) + 1)::text, 4, '0')
    INTO v_request_number
    FROM leave_requests;

    -- Insert leave request
    INSERT INTO leave_requests (
        employee_id,
        leave_type_id,
        request_number,
        from_date,
        to_date,
        total_days,
        reason,
        status,
        created_by
    ) VALUES (
        p_employee_id,
        p_leave_type_id,
        v_request_number,
        p_from_date,
        p_to_date,
        v_total_days,
        p_reason,
        'PENDING',
        COALESCE(p_created_by, auth.uid()) -- FIX: Use auth.uid() instead of p_employee_id
    );

    RETURN json_build_object(
        'success', true,
        'message', 'Leave request submitted successfully',
        'request_number', v_request_number,
        'total_days', v_total_days
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
