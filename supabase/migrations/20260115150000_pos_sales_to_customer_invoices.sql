-- Auto-create accounting customer invoice for POS sales

CREATE OR REPLACE FUNCTION public.create_customer_invoice_from_pos_sale()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_credit_days integer := 0;
  v_due_date date;
  v_amount_received numeric;
  v_payment_status text;
BEGIN
  -- Prevent duplicates if an invoice already exists for this sale number
  IF EXISTS (
    SELECT 1 FROM customer_invoices_accounting
    WHERE invoice_number = NEW.sale_number
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.customer_id IS NOT NULL THEN
    SELECT COALESCE(credit_days, 0)
    INTO v_credit_days
    FROM customers
    WHERE id = NEW.customer_id;
  END IF;

  v_due_date := (NEW.sale_date::date + v_credit_days);
  v_amount_received := COALESCE(NEW.amount_paid, 0);

  IF (NEW.total_amount - v_amount_received) <= 0 THEN
    v_payment_status := 'paid';
  ELSIF v_amount_received > 0 THEN
    v_payment_status := 'partial';
  ELSE
    v_payment_status := 'unpaid';
  END IF;

  INSERT INTO customer_invoices_accounting (
    invoice_number,
    customer_id,
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
    location_id
  ) VALUES (
    NEW.sale_number,
    NEW.customer_id,
    NEW.sale_date::date,
    v_due_date,
    NEW.sale_number,
    NEW.subtotal,
    NEW.tax_amount,
    NEW.discount_amount,
    NEW.total_amount,
    v_amount_received,
    v_payment_status,
    'posted',
    NEW.notes,
    NEW.cashier_id,
    NEW.location_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pos_sales_to_customer_invoices ON public.pos_sales;
CREATE TRIGGER trg_pos_sales_to_customer_invoices
AFTER INSERT ON public.pos_sales
FOR EACH ROW
EXECUTE FUNCTION public.create_customer_invoice_from_pos_sale();

-- Backfill existing POS sales into customer invoices (one-time)
INSERT INTO customer_invoices_accounting (
  invoice_number,
  customer_id,
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
  location_id
)
SELECT
  ps.sale_number,
  ps.customer_id,
  ps.sale_date::date,
  ps.sale_date::date + COALESCE(c.credit_days, 0),
  ps.sale_number,
  ps.subtotal,
  ps.tax_amount,
  ps.discount_amount,
  ps.total_amount,
  COALESCE(ps.amount_paid, 0),
  CASE
    WHEN (ps.total_amount - COALESCE(ps.amount_paid, 0)) <= 0 THEN 'paid'
    WHEN COALESCE(ps.amount_paid, 0) > 0 THEN 'partial'
    ELSE 'unpaid'
  END,
  'posted',
  ps.notes,
  ps.cashier_id,
  ps.location_id
FROM pos_sales ps
LEFT JOIN customers c ON c.id = ps.customer_id
LEFT JOIN customer_invoices_accounting ci ON ci.invoice_number = ps.sale_number
WHERE ci.id IS NULL;
