-- Redefine create_user_profile to remove location_id reference
CREATE OR REPLACE FUNCTION public.create_user_profile(
    p_user_id uuid,
    p_full_name text,
    p_email text,
    p_employee_code text DEFAULT NULL::text,
    p_phone text DEFAULT NULL::text,
    p_location_id uuid DEFAULT NULL::uuid -- Keeping parameter for backward compatibility but ignoring it
) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO user_profiles (
        id,
        full_name,
        email,
        employee_code,
        phone
        -- location_id removed
    ) VALUES (
        p_user_id,
        p_full_name,
        p_email,
        p_employee_code,
        p_phone
    );

    RETURN json_build_object(
        'success', true,
        'message', 'User profile created successfully'
    );
EXCEPTION
    WHEN unique_violation THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Employee code already exists'
        );
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'message', SQLERRM
        );
END;
$$;
