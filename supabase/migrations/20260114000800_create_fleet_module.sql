-- Create Fleet Vehicles Table
CREATE TABLE public.fleet_vehicles (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    registration_number text NOT NULL UNIQUE,
    make text NOT NULL,
    model text NOT NULL,
    year integer NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'RETIRED')),
    current_mileage numeric DEFAULT 0 NOT NULL,
    last_service_date date,
    last_service_mileage numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create Fleet Drivers Table
CREATE TABLE public.fleet_drivers (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    license_number text NOT NULL,
    license_expiry date NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ON_LEAVE')),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(employee_id)
);

-- Create Fleet Trips Table
CREATE TABLE public.fleet_trips (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    vehicle_id uuid NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
    driver_id uuid NOT NULL REFERENCES public.fleet_drivers(id) ON DELETE CASCADE,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone,
    start_location text NOT NULL,
    end_location text,
    start_mileage numeric NOT NULL,
    end_mileage numeric,
    trip_purpose text,
    status text DEFAULT 'PLANNED'::text NOT NULL CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create Fleet Fuel Logs Table
CREATE TABLE public.fleet_fuel_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    vehicle_id uuid NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
    trip_id uuid REFERENCES public.fleet_trips(id) ON DELETE SET NULL,
    log_date timestamp with time zone DEFAULT now() NOT NULL,
    liters numeric NOT NULL,
    cost_per_liter numeric NOT NULL,
    total_cost numeric NOT NULL,
    odometer_reading numeric NOT NULL,
    receipt_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create Fleet Maintenance Table
CREATE TABLE public.fleet_maintenance (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    vehicle_id uuid NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
    service_type text NOT NULL, -- ROUTINE, REPAIR, INSPECTION
    service_date date NOT NULL,
    odometer_reading numeric NOT NULL,
    cost numeric NOT NULL,
    description text,
    vendor_name text,
    next_service_due_date date,
    next_service_due_mileage numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.fleet_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_fuel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_maintenance ENABLE ROW LEVEL SECURITY;

-- Create basic policies (Allow all authenticated users for now)
CREATE POLICY "Allow authenticated full access on fleet_vehicles" ON public.fleet_vehicles FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access on fleet_drivers" ON public.fleet_drivers FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access on fleet_trips" ON public.fleet_trips FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access on fleet_fuel_logs" ON public.fleet_fuel_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access on fleet_maintenance" ON public.fleet_maintenance FOR ALL TO authenticated USING (true);
