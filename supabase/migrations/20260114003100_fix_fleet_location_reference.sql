-- Fix Fleet Vehicles linking to the correct Locations table (public.locations)
-- User Management and Inventory Stock use public.locations, not inventory_locations.

-- 1. Ensure 'mobile' location type exists
INSERT INTO public.location_types (name, description)
VALUES ('mobile', 'Mobile stores or vehicles')
ON CONFLICT (name) DO NOTHING;

-- 2. Modify fleet_vehicles to point to public.locations instead of public.inventory_locations
-- First remove the old column if it exists (since we likely just created it in the previous migration)
ALTER TABLE public.fleet_vehicles DROP COLUMN IF EXISTS location_id;
ALTER TABLE public.fleet_vehicles ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;

-- 3. Update the trigger function to use public.locations
CREATE OR REPLACE FUNCTION public.handle_fleet_vehicle_location()
RETURNS TRIGGER AS $$
DECLARE
    v_type_id uuid;
    v_location_id uuid;
BEGIN
    -- Get the 'mobile' type ID
    SELECT id INTO v_type_id FROM public.location_types WHERE name = 'mobile' LIMIT 1;
    
    -- If 'mobile' type doesn't exist (unlikely due to step 1), use any type or create it
    IF v_type_id IS NULL THEN
        INSERT INTO public.location_types (name, description) VALUES ('mobile', 'Mobile Store')
        RETURNING id INTO v_type_id;
    END IF;

    -- Create a new location in public.locations for the vehicle
    INSERT INTO public.locations (
        type_id,
        code,
        name,
        vehicle_number,
        is_active
    ) VALUES (
        v_type_id,
        'VEH-' || NEW.registration_number,
        'Mobile Store - ' || NEW.registration_number,
        NEW.registration_number,
        true
    ) RETURNING id INTO v_location_id;

    -- Update the vehicle with the new location_id
    UPDATE public.fleet_vehicles SET location_id = v_location_id WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-create the trigger
DROP TRIGGER IF EXISTS trg_create_vehicle_location ON public.fleet_vehicles;
CREATE TRIGGER trg_create_vehicle_location
AFTER INSERT ON public.fleet_vehicles
FOR EACH ROW
EXECUTE FUNCTION public.handle_fleet_vehicle_location();

-- 5. Cleanup: If there are existing fleet vehicles, create locations for them
-- This handles the case where the user already added vehicles
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT * FROM public.fleet_vehicles WHERE location_id IS NULL LOOP
        -- This will manually trigger the creation if insert didn't do it or if it failed
        -- We can just call the function manually or let the user re-insert.
        -- Better to do it here once.
        PERFORM public.handle_fleet_vehicle_location_manual(r.id);
    END LOOP;
END $$;

-- Helper for manual creation
CREATE OR REPLACE FUNCTION public.handle_fleet_vehicle_location_manual(p_vehicle_id uuid)
RETURNS void AS $$
DECLARE
    v_registration_number text;
    v_type_id uuid;
    v_location_id uuid;
BEGIN
    SELECT registration_number INTO v_registration_number FROM public.fleet_vehicles WHERE id = p_vehicle_id;
    
    SELECT id INTO v_type_id FROM public.location_types WHERE name = 'mobile' LIMIT 1;
    
    IF v_type_id IS NULL THEN
        INSERT INTO public.location_types (name, description) VALUES ('mobile', 'Mobile Store')
        RETURNING id INTO v_type_id;
    END IF;

    INSERT INTO public.locations (
        type_id,
        code,
        name,
        vehicle_number,
        is_active
    ) VALUES (
        v_type_id,
        'VEH-' || v_registration_number,
        'Mobile Store - ' || v_registration_number,
        v_registration_number,
        true
    ) RETURNING id INTO v_location_id;

    UPDATE public.fleet_vehicles SET location_id = v_location_id WHERE id = p_vehicle_id;
END;
$$ LANGUAGE plpgsql;

-- Run for existing
SELECT public.handle_fleet_vehicle_location_manual(id) FROM public.fleet_vehicles WHERE location_id IS NULL;
