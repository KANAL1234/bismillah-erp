-- Idempotent sync for sales invoices into accounting invoices

CREATE OR REPLACE FUNCTION public.sync_sales_invoices_to_accounting()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  INSERT INTO customer_invoices_accounting (
    invoice_number,
    customer_id,
    sales_order_id,
    invoice_date,
    due_date,
    reference_number,
    subtotal,
    tax_amount,
    discount_amount,
    total_amount,
    amount_received,
    payment_status,
    status,
    notes,
    created_by,
    location_id,
    warehouse_id
  )
  SELECT
    si.invoice_number,
    si.customer_id,
    si.sales_order_id,
    si.invoice_date,
    si.due_date,
    si.invoice_number,
    si.subtotal,
    si.tax_amount,
    si.discount_amount,
    si.total_amount,
    COALESCE(si.amount_paid, 0),
    CASE
      WHEN (si.total_amount - COALESCE(si.amount_paid, 0)) <= 0 THEN 'paid'
      WHEN COALESCE(si.amount_paid, 0) > 0 THEN 'partial'
      ELSE 'unpaid'
    END,
    CASE
      WHEN si.status = 'void' THEN 'cancelled'
      WHEN si.status = 'draft' THEN 'draft'
      ELSE 'posted'
    END,
    si.notes,
    si.created_by,
    si.location_id,
    si.warehouse_id
  FROM sales_invoices si
  LEFT JOIN customer_invoices_accounting ci ON ci.invoice_number = si.invoice_number
  WHERE ci.id IS NULL;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_sales_invoices_to_accounting() TO anon, authenticated;
