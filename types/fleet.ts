export type VehicleStatus = 'ACTIVE' | 'MAINTENANCE' | 'RETIRED'
export type DriverStatus = 'ACTIVE' | 'SUSPENDED' | 'ON_LEAVE'
export type TripStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export interface FleetVehicle {
    id: string
    registration_number: string
    make: string
    model: string
    year: number
    status: VehicleStatus
    current_mileage: number
    last_service_date: string | null
    last_service_mileage: number | null
    created_at: string
}

export interface FleetDriver {
    id: string
    employee_id: string
    license_number: string
    license_expiry: string
    status: DriverStatus
    created_at: string
    // Joined fields
    employee?: {
        full_name: string
        employee_code: string
    }
}

export interface FleetTrip {
    id: string
    vehicle_id: string
    driver_id: string
    start_time: string
    end_time: string | null
    start_location: string
    end_location: string | null
    start_mileage: number
    end_mileage: number | null
    trip_purpose: string | null
    status: TripStatus
    created_at: string
    // Joined fields
    vehicle?: FleetVehicle
    driver?: FleetDriver
}

export interface FleetFuelLog {
    id: string
    vehicle_id: string
    trip_id: string | null
    log_date: string
    liters: number
    cost_per_liter: number
    total_cost: number
    odometer_reading: number
    receipt_url: string | null
    created_at: string
    // Joined fields
    vehicle?: FleetVehicle
}

export interface FleetMaintenance {
    id: string
    vehicle_id: string
    service_type: string
    service_date: string
    odometer_reading: number
    cost: number
    description: string | null
    vendor_name: string | null
    next_service_due_date: string | null
    next_service_due_mileage: number | null
    created_at: string
    // Joined fields
    vehicle?: FleetVehicle
}
