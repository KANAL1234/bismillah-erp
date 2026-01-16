-- Mirror B2B sales invoices into accounting invoices for unified AR tracking

CREATE OR REPLACE FUNCTION public.create_customer_invoice_from_sales_invoice()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_amount_received numeric;
  v_payment_status text;
  v_status text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM customer_invoices_accounting
    WHERE invoice_number = NEW.invoice_number
  ) THEN
    RETURN NEW;
  END IF;

  v_amount_received := COALESCE(NEW.amount_paid, 0);

  IF (NEW.total_amount - v_amount_received) <= 0 THEN
    v_payment_status := 'paid';
  ELSIF v_amount_received > 0 THEN
    v_payment_status := 'partial';
  ELSE
    v_payment_status := 'unpaid';
  END IF;

  IF NEW.status = 'void' THEN
    v_status := 'cancelled';
  ELSIF NEW.status = 'draft' THEN
    v_status := 'draft';
  ELSE
    v_status := 'posted';
  END IF;

  IF NEW.status = 'overdue' THEN
    v_payment_status := 'overdue';
  END IF;

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
  ) VALUES (
    NEW.invoice_number,
    NEW.customer_id,
    NEW.sales_order_id,
    NEW.invoice_date,
    NEW.due_date,
    NEW.invoice_number,
    NEW.subtotal,
    NEW.tax_amount,
    NEW.discount_amount,
    NEW.total_amount,
    v_amount_received,
    v_payment_status,
    v_status,
    NEW.notes,
    NEW.created_by,
    NEW.location_id,
    NEW.warehouse_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_invoices_to_customer_invoices ON public.sales_invoices;
CREATE TRIGGER trg_sales_invoices_to_customer_invoices
AFTER INSERT ON public.sales_invoices
FOR EACH ROW
EXECUTE FUNCTION public.create_customer_invoice_from_sales_invoice();

-- Backfill existing sales invoices into accounting invoices
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
