-- Link Fleet Vehicles to Locations
ALTER TABLE public.fleet_vehicles ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.inventory_locations(id) ON DELETE SET NULL;

-- Function to handle mobile store location creation
CREATE OR REPLACE FUNCTION public.handle_fleet_vehicle_location()
RETURNS TRIGGER AS $$
DECLARE
    v_location_id uuid;
BEGIN
    -- Create a new inventory location for the vehicle
    INSERT INTO public.inventory_locations (
        location_code,
        location_name,
        location_type,
        notes
    ) VALUES (
        'VEH-' || NEW.registration_number,
        'Mobile Store - ' || NEW.registration_number,
        'MOBILE',
        'Automatically created for vehicle ' || NEW.make || ' ' || NEW.model
    ) RETURNING id INTO v_location_id;

    -- Update the vehicle with the new location_id
    -- Using direct UPDATE within trigger function (be careful of recursion, but this is AFTER INSERT)
    UPDATE public.fleet_vehicles SET location_id = v_location_id WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create location on vehicle insert
DROP TRIGGER IF EXISTS trg_create_vehicle_location ON public.fleet_vehicles;
CREATE TRIGGER trg_create_vehicle_location
AFTER INSERT ON public.fleet_vehicles
FOR EACH ROW
EXECUTE FUNCTION public.handle_fleet_vehicle_location();

-- Link Trips to Sales
ALTER TABLE public.sales_invoices ADD COLUMN IF NOT EXISTS trip_id uuid REFERENCES public.fleet_trips(id) ON DELETE SET NULL;
ALTER TABLE public.pos_sales ADD COLUMN IF NOT EXISTS trip_id uuid REFERENCES public.fleet_trips(id) ON DELETE SET NULL;

-- Track visited customers during trips
CREATE TABLE IF NOT EXISTS public.fleet_trip_visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    trip_id uuid NOT NULL REFERENCES public.fleet_trips(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    visit_time timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- GPS Tracking for Trips
CREATE TABLE IF NOT EXISTS public.fleet_trip_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    trip_id uuid NOT NULL REFERENCES public.fleet_trips(id) ON DELETE CASCADE,
    latitude numeric(10, 8) NOT NULL,
    longitude numeric(11, 8) NOT NULL,
    accuracy numeric,
    altitude numeric,
    speed numeric,
    heading numeric,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Add GPS Path as jsonb to Trips for quick rendering
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fleet_trips' AND column_name='gps_path') THEN
        ALTER TABLE public.fleet_trips ADD COLUMN gps_path jsonb DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.fleet_trip_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_trip_locations ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated full access on fleet_trip_visits') THEN
        CREATE POLICY "Allow authenticated full access on fleet_trip_visits" ON public.fleet_trip_visits FOR ALL TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated full access on fleet_trip_locations') THEN
        CREATE POLICY "Allow authenticated full access on fleet_trip_locations" ON public.fleet_trip_locations FOR ALL TO authenticated USING (true);
    END IF;
END $$;
