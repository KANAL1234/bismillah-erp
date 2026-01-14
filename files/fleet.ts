// ========================================
// FLEET MANAGEMENT TYPE DEFINITIONS
// ========================================

export type VehicleType = 'PICKUP_TRUCK' | 'VAN' | 'SMALL_TRUCK' | 'MOTORCYCLE' | 'OTHER';
export type FuelType = 'PETROL' | 'DIESEL' | 'CNG' | 'ELECTRIC' | 'HYBRID';
export type VehicleStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE' | 'SOLD';
export type MaintenanceStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type RouteAssignmentStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type DailyReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED';
export type ExpenseType = 'FUEL' | 'MAINTENANCE' | 'INSURANCE' | 'REGISTRATION' | 'PARKING' | 'TOLL' | 'FINE' | 'OTHER';
export type PaymentMethod = 'CASH' | 'CARD' | 'FUEL_CARD' | 'CREDIT';

// ========================================
// VEHICLE
// ========================================

export interface Vehicle {
  id: string;
  vehicle_code: string;
  registration_number: string;
  vehicle_type: VehicleType;
  make: string;
  model: string;
  year?: number;
  color?: string;
  chassis_number?: string;
  engine_number?: string;
  location_id?: string;
  assigned_driver_id?: string;
  capacity_kg?: number;
  fuel_type: FuelType;
  fuel_tank_capacity?: number;
  average_mileage?: number;
  purchase_date?: string;
  purchase_cost?: number;
  current_odometer: number;
  insurance_company?: string;
  insurance_policy_number?: string;
  insurance_expiry_date?: string;
  fitness_certificate_expiry?: string;
  route_permit_number?: string;
  route_permit_expiry?: string;
  status: VehicleStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface VehicleWithRelations extends Vehicle {
  location_name?: string;
  driver_name?: string;
  driver_code?: string;
}

// ========================================
// FUEL LOGS
// ========================================

export interface FuelLog {
  id: string;
  fuel_log_number: string;
  vehicle_id: string;
  driver_id?: string;
  fuel_date: string;
  fuel_station?: string;
  fuel_type: FuelType;
  quantity_liters: number;
  price_per_liter: number;
  total_amount: number;
  odometer_reading: number;
  previous_odometer?: number;
  distance_traveled: number;
  fuel_efficiency?: number;
  payment_method?: PaymentMethod;
  receipt_number?: string;
  location_id?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface FuelLogWithRelations extends FuelLog {
  vehicle_code?: string;
  registration_number?: string;
  driver_name?: string;
}

export interface RecordFuelInput {
  vehicle_id: string;
  driver_id: string;
  fuel_date: string;
  fuel_type: FuelType;
  quantity_liters: number;
  price_per_liter: number;
  odometer_reading: number;
  fuel_station?: string;
  payment_method?: PaymentMethod;
  receipt_number?: string;
  location_id?: string;
}

// ========================================
// MAINTENANCE
// ========================================

export interface MaintenanceType {
  id: string;
  type_code: string;
  type_name: string;
  description?: string;
  recommended_frequency_km?: number;
  recommended_frequency_days?: number;
  is_active: boolean;
  created_at: string;
}

export interface MaintenanceLog {
  id: string;
  maintenance_number: string;
  vehicle_id: string;
  maintenance_type_id?: string;
  maintenance_date: string;
  odometer_reading?: number;
  service_provider?: string;
  description: string;
  labor_cost: number;
  parts_cost: number;
  total_cost: number;
  downtime_days: number;
  next_service_date?: string;
  next_service_km?: number;
  status: MaintenanceStatus;
  invoice_number?: string;
  payment_method?: PaymentMethod;
  notes?: string;
  performed_by?: string;
  created_at: string;
}

export interface MaintenanceLogWithRelations extends MaintenanceLog {
  vehicle_code?: string;
  registration_number?: string;
  maintenance_type_name?: string;
}

export interface RecordMaintenanceInput {
  vehicle_id: string;
  maintenance_type_id: string;
  maintenance_date: string;
  odometer_reading: number;
  description: string;
  labor_cost?: number;
  parts_cost?: number;
  service_provider?: string;
  downtime_days?: number;
}

export interface MaintenanceScheduleItem {
  vehicle_code: string;
  registration_number: string;
  current_odometer: number;
  maintenance_type: string;
  last_service_date?: string;
  last_service_km?: number;
  next_service_date?: string;
  next_service_km?: number;
  days_until_due?: number;
  km_until_due?: number;
  is_overdue: boolean;
}

// ========================================
// ROUTES
// ========================================

export interface Route {
  id: string;
  route_code: string;
  route_name: string;
  area?: string;
  description?: string;
  estimated_distance_km?: number;
  estimated_time_hours?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RouteCustomer {
  id: string;
  route_id: string;
  customer_id: string;
  visit_sequence?: number;
  estimated_time_minutes?: number;
  notes?: string;
  created_at: string;
}

export interface RouteWithCustomers extends Route {
  customers: RouteCustomer[];
  customer_count: number;
}

// ========================================
// ROUTE ASSIGNMENTS
// ========================================

export interface RouteAssignment {
  id: string;
  assignment_date: string;
  vehicle_id: string;
  driver_id: string;
  route_id?: string;
  start_odometer?: number;
  end_odometer?: number;
  distance_traveled: number;
  start_time?: string;
  end_time?: string;
  total_hours?: number;
  status: RouteAssignmentStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface RouteAssignmentWithRelations extends RouteAssignment {
  vehicle_code?: string;
  registration_number?: string;
  driver_name?: string;
  route_name?: string;
}

export interface AssignRouteInput {
  assignment_date: string;
  vehicle_id: string;
  driver_id: string;
  route_id?: string;
  start_odometer?: number;
}

// ========================================
// DAILY REPORTS
// ========================================

export interface VehicleDailyReport {
  id: string;
  report_date: string;
  vehicle_id: string;
  driver_id: string;
  route_assignment_id?: string;
  opening_stock_value: number;
  closing_stock_value: number;
  total_sales: number;
  cash_collected: number;
  credit_sales: number;
  fuel_cost: number;
  other_expenses: number;
  customers_visited: number;
  successful_sales: number;
  distance_traveled?: number;
  fuel_consumed?: number;
  fuel_efficiency?: number;
  status: DailyReportStatus;
  remarks?: string;
  submitted_at?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
}

export interface VehicleDailyReportWithRelations extends VehicleDailyReport {
  vehicle_code?: string;
  registration_number?: string;
  driver_name?: string;
}

export interface CreateDailyReportInput {
  report_date: string;
  vehicle_id: string;
  driver_id: string;
  route_assignment_id?: string;
  opening_stock_value: number;
  closing_stock_value: number;
  cash_collected: number;
  credit_sales: number;
  fuel_cost?: number;
  other_expenses?: number;
  customers_visited?: number;
  successful_sales?: number;
}

// ========================================
// EXPENSES
// ========================================

export interface VehicleExpense {
  id: string;
  expense_number: string;
  vehicle_id: string;
  expense_date: string;
  expense_type: ExpenseType;
  amount: number;
  description: string;
  payment_method?: PaymentMethod;
  receipt_number?: string;
  vendor?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

// ========================================
// PERFORMANCE REPORTS
// ========================================

export interface VehiclePerformance {
  vehicle_code: string;
  registration_number: string;
  assigned_driver?: string;
  total_sales: number;
  cash_collected: number;
  credit_sales: number;
  total_fuel_cost: number;
  total_maintenance_cost: number;
  total_distance: number;
  average_fuel_efficiency: number;
  days_active: number;
  customers_visited: number;
  successful_sales: number;
  net_profit: number;
}

export interface FuelConsumptionReport {
  vehicle_code: string;
  registration_number: string;
  total_liters: number;
  total_cost: number;
  average_price_per_liter: number;
  total_distance: number;
  average_fuel_efficiency: number;
  entries_count: number;
}

export interface DriverPerformance {
  driver_name: string;
  employee_code: string;
  total_sales: number;
  cash_collected: number;
  credit_sales: number;
  customers_visited: number;
  successful_sales: number;
  days_worked: number;
  average_sales_per_day: number;
  success_rate: number;
}

// ========================================
// FORM INPUTS
// ========================================

export interface CreateVehicleInput {
  vehicle_code: string;
  registration_number: string;
  vehicle_type: VehicleType;
  make: string;
  model: string;
  year?: number;
  fuel_type: FuelType;
  capacity_kg?: number;
  purchase_date?: string;
  purchase_cost?: number;
  assigned_driver_id?: string;
  location_id?: string;
}

export interface UpdateVehicleInput {
  vehicle_type?: VehicleType;
  make?: string;
  model?: string;
  assigned_driver_id?: string;
  location_id?: string;
  status?: VehicleStatus;
  insurance_expiry_date?: string;
  fitness_certificate_expiry?: string;
}

// ========================================
// CONSTANTS
// ========================================

export const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'PICKUP_TRUCK', label: 'Pickup Truck' },
  { value: 'VAN', label: 'Van' },
  { value: 'SMALL_TRUCK', label: 'Small Truck' },
  { value: 'MOTORCYCLE', label: 'Motorcycle' },
  { value: 'OTHER', label: 'Other' }
];

export const FUEL_TYPES: { value: FuelType; label: string }[] = [
  { value: 'PETROL', label: 'Petrol' },
  { value: 'DIESEL', label: 'Diesel' },
  { value: 'CNG', label: 'CNG' },
  { value: 'ELECTRIC', label: 'Electric' },
  { value: 'HYBRID', label: 'Hybrid' }
];

export const VEHICLE_STATUSES: { value: VehicleStatus; label: string; color: string }[] = [
  { value: 'ACTIVE', label: 'Active', color: 'green' },
  { value: 'MAINTENANCE', label: 'Under Maintenance', color: 'yellow' },
  { value: 'INACTIVE', label: 'Inactive', color: 'red' },
  { value: 'SOLD', label: 'Sold', color: 'gray' }
];

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'FUEL_CARD', label: 'Fuel Card' },
  { value: 'CREDIT', label: 'Credit' }
];

export const EXPENSE_TYPES: { value: ExpenseType; label: string }[] = [
  { value: 'FUEL', label: 'Fuel' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'REGISTRATION', label: 'Registration' },
  { value: 'PARKING', label: 'Parking' },
  { value: 'TOLL', label: 'Toll' },
  { value: 'FINE', label: 'Fine' },
  { value: 'OTHER', label: 'Other' }
];

// ========================================
// HELPER FUNCTIONS
// ========================================

export const calculateFuelEfficiency = (distance: number, fuel: number): number => {
  if (fuel === 0) return 0;
  return Math.round((distance / fuel) * 100) / 100;
};

export const calculateVehicleProfit = (
  sales: number,
  fuelCost: number,
  maintenanceCost: number,
  otherCosts: number = 0
): number => {
  return sales - fuelCost - maintenanceCost - otherCosts;
};

export const getVehicleAge = (purchaseDate: string): number => {
  const today = new Date();
  const purchase = new Date(purchaseDate);
  return today.getFullYear() - purchase.getFullYear();
};

export const isMaintenanceOverdue = (
  nextServiceDate?: string,
  nextServiceKm?: number,
  currentOdometer?: number
): boolean => {
  if (nextServiceDate && new Date(nextServiceDate) < new Date()) {
    return true;
  }
  
  if (nextServiceKm && currentOdometer && nextServiceKm < currentOdometer) {
    return true;
  }
  
  return false;
};

export const formatOdometer = (km: number): string => {
  return `${km.toLocaleString()} km`;
};

export const formatFuelEfficiency = (efficiency: number): string => {
  return `${efficiency.toFixed(2)} km/L`;
};

export const getMaintenanceStatusColor = (status: MaintenanceStatus): string => {
  const colors = {
    SCHEDULED: 'blue',
    IN_PROGRESS: 'yellow',
    COMPLETED: 'green',
    CANCELLED: 'gray'
  };
  
  return colors[status] || 'gray';
};

export const getVehicleStatusColor = (status: VehicleStatus): string => {
  const colors = {
    ACTIVE: 'green',
    MAINTENANCE: 'yellow',
    INACTIVE: 'red',
    SOLD: 'gray'
  };
  
  return colors[status] || 'gray';
};

export const calculateDailyProfit = (report: VehicleDailyReport): number => {
  return report.total_sales - report.fuel_cost - report.other_expenses;
};

export const calculateSuccessRate = (successful: number, visited: number): number => {
  if (visited === 0) return 0;
  return Math.round((successful / visited) * 100);
};
