-- Add location tracking to invoices and backfill from sales orders, trips, and POS

ALTER TABLE public.sales_invoices
ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id),
ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.inventory_locations(id);

ALTER TABLE public.customer_invoices_accounting
ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id),
ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.inventory_locations(id);

-- Backfill sales invoice locations from sales orders
UPDATE public.sales_invoices si
SET location_id = so.location_id,
    warehouse_id = so.warehouse_id
FROM public.sales_orders so
WHERE si.sales_order_id = so.id;

-- Backfill sales invoice locations from trips (vehicle home location)
UPDATE public.sales_invoices si
SET location_id = fv.location_id
FROM public.fleet_trips ft
JOIN public.fleet_vehicles fv ON fv.id = ft.vehicle_id
WHERE si.trip_id = ft.id
  AND si.location_id IS NULL;

-- Backfill accounting invoice locations from sales orders
UPDATE public.customer_invoices_accounting ci
SET location_id = so.location_id,
    warehouse_id = so.warehouse_id
FROM public.sales_orders so
WHERE ci.sales_order_id = so.id;

-- Backfill accounting invoice locations from POS sales references
UPDATE public.customer_invoices_accounting ci
SET location_id = ps.location_id
FROM public.pos_sales ps
WHERE ci.location_id IS NULL
  AND (ci.reference_number = ps.sale_number OR ci.invoice_number = ps.sale_number);

-- Backfill sales invoice locations from POS sales references (best-effort)
UPDATE public.sales_invoices si
SET location_id = ps.location_id
FROM public.pos_sales ps
WHERE si.location_id IS NULL
  AND (si.invoice_number = ps.sale_number);
