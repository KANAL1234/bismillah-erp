-- ========================================
-- FLEET MANAGEMENT MODULE - COMPLETE SYSTEM
-- For Mobile Store Vehicles
-- ========================================

-- ========================================
-- 1. VEHICLES MASTER
-- ========================================

CREATE TABLE IF NOT EXISTS public.vehicles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_code text UNIQUE NOT NULL,
    registration_number text UNIQUE NOT NULL,
    vehicle_type text NOT NULL CHECK (vehicle_type IN ('PICKUP_TRUCK', 'VAN', 'SMALL_TRUCK', 'MOTORCYCLE', 'OTHER')),
    make text NOT NULL,
    model text NOT NULL,
    year integer,
    color text,
    chassis_number text,
    engine_number text,
    location_id uuid REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
    assigned_driver_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
    capacity_kg numeric(10,2),
    fuel_type text NOT NULL CHECK (fuel_type IN ('PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID')),
    fuel_tank_capacity numeric(10,2),
    average_mileage numeric(10,2),
    purchase_date date,
    purchase_cost numeric(15,2),
    current_odometer numeric(10,2) DEFAULT 0,
    insurance_company text,
    insurance_policy_number text,
    insurance_expiry_date date,
    fitness_certificate_expiry date,
    route_permit_number text,
    route_permit_expiry date,
    status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'INACTIVE', 'SOLD')),
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_vehicles_registration ON vehicles(registration_number);
CREATE INDEX idx_vehicles_driver ON vehicles(assigned_driver_id);
CREATE INDEX idx_vehicles_location ON vehicles(location_id);
CREATE INDEX idx_vehicles_status ON vehicles(status);

COMMENT ON TABLE vehicles IS 'Master data for all company vehicles (mobile stores)';

-- ========================================
-- 2. FUEL LOGS
-- ========================================

CREATE TABLE IF NOT EXISTS public.fuel_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    fuel_log_number text UNIQUE NOT NULL,
    vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    driver_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
    fuel_date date NOT NULL DEFAULT CURRENT_DATE,
    fuel_station text,
    fuel_type text NOT NULL CHECK (fuel_type IN ('PETROL', 'DIESEL', 'CNG')),
    quantity_liters numeric(10,2) NOT NULL,
    price_per_liter numeric(10,2) NOT NULL,
    total_amount numeric(15,2) GENERATED ALWAYS AS (quantity_liters * price_per_liter) STORED,
    odometer_reading numeric(10,2) NOT NULL,
    previous_odometer numeric(10,2),
    distance_traveled numeric(10,2) GENERATED ALWAYS AS (odometer_reading - COALESCE(previous_odometer, odometer_reading)) STORED,
    fuel_efficiency numeric(10,2), -- km per liter
    payment_method text CHECK (payment_method IN ('CASH', 'CARD', 'FUEL_CARD', 'CREDIT')),
    receipt_number text,
    location_id uuid REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
    notes text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_fuel_logs_vehicle ON fuel_logs(vehicle_id);
CREATE INDEX idx_fuel_logs_date ON fuel_logs(fuel_date);
CREATE INDEX idx_fuel_logs_driver ON fuel_logs(driver_id);

COMMENT ON TABLE fuel_logs IS 'Daily fuel purchase tracking with odometer readings';

-- ========================================
-- 3. MAINTENANCE LOGS
-- ========================================

CREATE TABLE IF NOT EXISTS public.maintenance_types (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    type_code text UNIQUE NOT NULL,
    type_name text NOT NULL,
    description text,
    recommended_frequency_km integer,
    recommended_frequency_days integer,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- Insert default maintenance types
INSERT INTO maintenance_types (type_code, type_name, description, recommended_frequency_km, recommended_frequency_days) VALUES
('OIL_CHANGE', 'Oil Change', 'Engine oil and filter replacement', 5000, 90),
('TIRE_ROTATION', 'Tire Rotation', 'Rotate tires for even wear', 10000, 180),
('BRAKE_SERVICE', 'Brake Service', 'Brake pads and fluid check', 15000, 180),
('BATTERY_CHECK', 'Battery Check', 'Battery health and terminals', NULL, 180),
('AC_SERVICE', 'AC Service', 'Air conditioning gas refill', NULL, 365),
('GENERAL_SERVICE', 'General Service', 'Complete vehicle checkup', 10000, 180),
('TIRE_REPLACEMENT', 'Tire Replacement', 'Replace worn tires', NULL, NULL),
('REPAIR', 'Repair', 'Breakdown or accident repair', NULL, NULL)
ON CONFLICT (type_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.maintenance_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    maintenance_number text UNIQUE NOT NULL,
    vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    maintenance_type_id uuid REFERENCES public.maintenance_types(id) ON DELETE SET NULL,
    maintenance_date date NOT NULL DEFAULT CURRENT_DATE,
    odometer_reading numeric(10,2),
    service_provider text,
    description text NOT NULL,
    labor_cost numeric(15,2) DEFAULT 0,
    parts_cost numeric(15,2) DEFAULT 0,
    total_cost numeric(15,2) GENERATED ALWAYS AS (labor_cost + parts_cost) STORED,
    downtime_days integer DEFAULT 0,
    next_service_date date,
    next_service_km numeric(10,2),
    status text NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    invoice_number text,
    payment_method text CHECK (payment_method IN ('CASH', 'CARD', 'CREDIT')),
    notes text,
    performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_maintenance_logs_vehicle ON maintenance_logs(vehicle_id);
CREATE INDEX idx_maintenance_logs_date ON maintenance_logs(maintenance_date);
CREATE INDEX idx_maintenance_logs_type ON maintenance_logs(maintenance_type_id);
CREATE INDEX idx_maintenance_logs_status ON maintenance_logs(status);

COMMENT ON TABLE maintenance_logs IS 'Vehicle maintenance and repair tracking';

-- ========================================
-- 4. ROUTES
-- ========================================

CREATE TABLE IF NOT EXISTS public.routes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    route_code text UNIQUE NOT NULL,
    route_name text NOT NULL,
    area text,
    description text,
    estimated_distance_km numeric(10,2),
    estimated_time_hours numeric(5,2),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_routes_area ON routes(area);
CREATE INDEX idx_routes_active ON routes(is_active);

COMMENT ON TABLE routes IS 'Pre-defined sales routes for vehicles';

CREATE TABLE IF NOT EXISTS public.route_customers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    visit_sequence integer,
    estimated_time_minutes integer,
    notes text,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT unique_route_customer UNIQUE (route_id, customer_id)
);

CREATE INDEX idx_route_customers_route ON route_customers(route_id);
CREATE INDEX idx_route_customers_customer ON route_customers(customer_id);

COMMENT ON TABLE route_customers IS 'Customers assigned to each route with visit sequence';

-- ========================================
-- 5. ROUTE ASSIGNMENTS (Daily)
-- ========================================

CREATE TABLE IF NOT EXISTS public.route_assignments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    assignment_date date NOT NULL DEFAULT CURRENT_DATE,
    vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    driver_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    route_id uuid REFERENCES public.routes(id) ON DELETE SET NULL,
    start_odometer numeric(10,2),
    end_odometer numeric(10,2),
    distance_traveled numeric(10,2) GENERATED ALWAYS AS (end_odometer - COALESCE(start_odometer, end_odometer)) STORED,
    start_time time,
    end_time time,
    total_hours numeric(5,2),
    status text NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT unique_vehicle_date UNIQUE (vehicle_id, assignment_date)
);

CREATE INDEX idx_route_assignments_date ON route_assignments(assignment_date);
CREATE INDEX idx_route_assignments_vehicle ON route_assignments(vehicle_id);
CREATE INDEX idx_route_assignments_driver ON route_assignments(driver_id);

COMMENT ON TABLE route_assignments IS 'Daily route assignments to vehicles and drivers';

-- ========================================
-- 6. VEHICLE DAILY REPORTS
-- ========================================

CREATE TABLE IF NOT EXISTS public.vehicle_daily_reports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    report_date date NOT NULL DEFAULT CURRENT_DATE,
    vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    driver_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    route_assignment_id uuid REFERENCES public.route_assignments(id) ON DELETE SET NULL,
    opening_stock_value numeric(15,2) DEFAULT 0,
    closing_stock_value numeric(15,2) DEFAULT 0,
    total_sales numeric(15,2) DEFAULT 0,
    cash_collected numeric(15,2) DEFAULT 0,
    credit_sales numeric(15,2) DEFAULT 0,
    fuel_cost numeric(15,2) DEFAULT 0,
    other_expenses numeric(15,2) DEFAULT 0,
    customers_visited integer DEFAULT 0,
    successful_sales integer DEFAULT 0,
    distance_traveled numeric(10,2),
    fuel_consumed numeric(10,2),
    fuel_efficiency numeric(10,2),
    status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED')),
    remarks text,
    submitted_at timestamptz,
    approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at timestamptz,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT unique_vehicle_report_date UNIQUE (vehicle_id, report_date)
);

CREATE INDEX idx_vehicle_daily_reports_date ON vehicle_daily_reports(report_date);
CREATE INDEX idx_vehicle_daily_reports_vehicle ON vehicle_daily_reports(vehicle_id);
CREATE INDEX idx_vehicle_daily_reports_driver ON vehicle_daily_reports(driver_id);

COMMENT ON TABLE vehicle_daily_reports IS 'End-of-day summary for each vehicle';

-- ========================================
-- 7. VEHICLE EXPENSES
-- ========================================

CREATE TABLE IF NOT EXISTS public.vehicle_expenses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    expense_number text UNIQUE NOT NULL,
    vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    expense_date date NOT NULL DEFAULT CURRENT_DATE,
    expense_type text NOT NULL CHECK (expense_type IN ('FUEL', 'MAINTENANCE', 'INSURANCE', 'REGISTRATION', 'PARKING', 'TOLL', 'FINE', 'OTHER')),
    amount numeric(15,2) NOT NULL,
    description text NOT NULL,
    payment_method text CHECK (payment_method IN ('CASH', 'CARD', 'CREDIT')),
    receipt_number text,
    vendor text,
    notes text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_vehicle_expenses_vehicle ON vehicle_expenses(vehicle_id);
CREATE INDEX idx_vehicle_expenses_date ON vehicle_expenses(expense_date);
CREATE INDEX idx_vehicle_expenses_type ON vehicle_expenses(expense_type);

COMMENT ON TABLE vehicle_expenses IS 'Other vehicle-related expenses (parking, toll, fines, etc.)';

-- ========================================
-- 8. ENABLE RLS
-- ========================================

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Read for authenticated users)
CREATE POLICY "Users can view vehicles" ON vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can view fuel logs" ON fuel_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can view maintenance types" ON maintenance_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can view maintenance logs" ON maintenance_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can view routes" ON routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can view route customers" ON route_customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can view route assignments" ON route_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can view daily reports" ON vehicle_daily_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can view expenses" ON vehicle_expenses FOR SELECT TO authenticated USING (true);

-- ========================================
-- 9. TRIGGERS
-- ========================================

-- Update vehicle odometer after fuel log
CREATE OR REPLACE FUNCTION update_vehicle_odometer()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE vehicles
    SET current_odometer = NEW.odometer_reading,
        updated_at = now()
    WHERE id = NEW.vehicle_id;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_vehicle_odometer
AFTER INSERT ON fuel_logs
FOR EACH ROW
EXECUTE FUNCTION update_vehicle_odometer();

-- Calculate fuel efficiency
CREATE OR REPLACE FUNCTION calculate_fuel_efficiency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_previous_odometer numeric;
BEGIN
    -- Get previous odometer reading from last fuel log
    SELECT odometer_reading INTO v_previous_odometer
    FROM fuel_logs
    WHERE vehicle_id = NEW.vehicle_id
      AND fuel_date < NEW.fuel_date
    ORDER BY fuel_date DESC, created_at DESC
    LIMIT 1;
    
    IF v_previous_odometer IS NOT NULL THEN
        NEW.previous_odometer := v_previous_odometer;
        
        -- Calculate efficiency (km per liter)
        IF NEW.quantity_liters > 0 THEN
            NEW.fuel_efficiency := (NEW.odometer_reading - v_previous_odometer) / NEW.quantity_liters;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calculate_fuel_efficiency
BEFORE INSERT ON fuel_logs
FOR EACH ROW
EXECUTE FUNCTION calculate_fuel_efficiency();

-- ========================================
-- VERIFICATION
-- ========================================

SELECT 'Fleet Management Tables Created Successfully!' as status,
       (SELECT COUNT(*) FROM vehicles) as vehicles_count,
       (SELECT COUNT(*) FROM maintenance_types) as maintenance_types_count;
