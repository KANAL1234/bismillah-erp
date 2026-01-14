CREATE OR REPLACE FUNCTION public.create_employee_advance(p_employee_id uuid, p_advance_type text, p_amount numeric, p_reason text, p_installments integer DEFAULT 1, p_approved_by uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_advance_number text;
    v_installment_amount numeric;
BEGIN
    -- Generate advance number
    -- Fixed: Cast the result of addition to text, not the operand '1'
    SELECT 'ADV-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || LPAD((COALESCE(MAX(SUBSTRING(advance_number FROM 12)::integer), 0) + 1)::text, 4, '0')
    INTO v_advance_number
    FROM employee_advances
    WHERE advance_number LIKE 'ADV-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '%';

    -- Calculate installment amount
    v_installment_amount := p_amount / p_installments;

    -- Create advance record
    INSERT INTO employee_advances (
        advance_number,
        employee_id,
        advance_type,
        amount,
        reason,
        installments,
        installment_amount,
        approved_by,
        approved_at
    ) VALUES (
        v_advance_number,
        p_employee_id,
        p_advance_type,
        p_amount,
        p_reason,
        p_installments,
        v_installment_amount,
        p_approved_by,
        CASE WHEN p_approved_by IS NOT NULL THEN now() ELSE NULL END
    );

    RETURN json_build_object(
        'success', true,
        'message', 'Advance created successfully',
        'advance_number', v_advance_number,
        'installment_amount', v_installment_amount
    );
END;
$$;
