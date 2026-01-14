-- Phase 2: Update RPC function and remove location_id column

-- Step 1: Drop and recreate get_all_users_with_roles without location_name
DROP FUNCTION IF EXISTS public.get_all_users_with_roles();

CREATE OR REPLACE FUNCTION public.get_all_users_with_roles() 
RETURNS TABLE(
    user_id uuid, 
    full_name text, 
    email text, 
    employee_code text, 
    phone text, 
    is_active boolean, 
    last_login timestamp with time zone, 
    roles json, 
    allowed_locations json,
    created_at timestamp with time zone
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.id,
        up.full_name,
        up.email,
        up.employee_code,
        up.phone,
        up.is_active,
        up.last_login,
        (
            SELECT COALESCE(json_agg(json_build_object(
                'role_id', r.id,
                'role_code', r.role_code,
                'role_name', r.role_name
            )), '[]'::json)
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = up.id AND r.is_active = true
        ) as roles,
        (
            SELECT COALESCE(json_agg(json_build_object(
                'location_id', loc.id,
                'location_name', loc.name,
                'location_code', loc.code
            )), '[]'::json)
            FROM user_allowed_locations ual
            JOIN locations loc ON loc.id = ual.location_id
            WHERE ual.user_id = up.id
        ) as allowed_locations,
        up.created_at
    FROM user_profiles up
    ORDER BY up.full_name;
END;
$$;

-- Step 2: Remove location_id column from user_profiles
ALTER TABLE user_profiles DROP COLUMN IF EXISTS location_id;
