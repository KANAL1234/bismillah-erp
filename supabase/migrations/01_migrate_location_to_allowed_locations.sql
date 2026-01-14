-- Phase 1: Data Migration - Ensure all users have their primary location in allowed_locations
-- This script should be run BEFORE removing the location_id column

-- Step 1: Add primary location to allowed_locations for users who don't have it yet
INSERT INTO user_allowed_locations (user_id, location_id, assigned_by)
SELECT 
    up.id as user_id,
    up.location_id,
    up.id as assigned_by  -- Self-assigned during migration
FROM user_profiles up
WHERE up.location_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM user_allowed_locations ual 
    WHERE ual.user_id = up.id 
      AND ual.location_id = up.location_id
  );

-- Step 2: Verify migration - Check how many users have allowed locations
SELECT 
    COUNT(DISTINCT up.id) as total_users,
    COUNT(DISTINCT ual.user_id) as users_with_allowed_locations,
    COUNT(DISTINCT up.id) - COUNT(DISTINCT ual.user_id) as users_without_locations
FROM user_profiles up
LEFT JOIN user_allowed_locations ual ON ual.user_id = up.id;

-- Step 3: List users without any allowed locations (should be 0 after migration)
SELECT 
    up.id,
    up.full_name,
    up.email,
    up.location_id
FROM user_profiles up
WHERE NOT EXISTS (
    SELECT 1 
    FROM user_allowed_locations ual 
    WHERE ual.user_id = up.id
);
