-- Ensure B2B sales invoices use INV-SALE prefix and keep accounting mirror aligned

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT
      id,
      invoice_number AS old_number,
      regexp_replace(invoice_number, '^INV-(\\d+)$', 'INV-SALE-\\1') AS new_number
    FROM sales_invoices
    WHERE invoice_number ~ '^INV-\\d+$'
  LOOP
    UPDATE sales_invoices
    SET invoice_number = r.new_number
    WHERE id = r.id;

    UPDATE customer_invoices_accounting
    SET invoice_number = r.new_number,
        reference_number = r.new_number
    WHERE invoice_number = r.old_number;
  END LOOP;
END $$;
