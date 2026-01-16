-- Standardize invoice/sale number prefixes for POS and B2B invoices

-- 1) Update POS sale numbers
UPDATE public.pos_sales
SET sale_number = CASE
  WHEN sale_number LIKE 'POS-OFF-%' THEN 'INV-POS-MOBILE-' || SUBSTRING(sale_number FROM 9)
  WHEN sale_number LIKE 'POS-%' THEN 'INV-POS-MOBILE-' || SUBSTRING(sale_number FROM 5)
  WHEN sale_number LIKE 'SALE-%' THEN 'INV-POS-' || SUBSTRING(sale_number FROM 6)
  ELSE sale_number
END
WHERE sale_number LIKE 'POS-%' OR sale_number LIKE 'SALE-%';

-- 2) Update accounting invoices referencing old POS sale numbers
UPDATE public.customer_invoices_accounting
SET invoice_number = CASE
  WHEN invoice_number LIKE 'POS-OFF-%' THEN 'INV-POS-MOBILE-' || SUBSTRING(invoice_number FROM 9)
  WHEN invoice_number LIKE 'POS-%' THEN 'INV-POS-MOBILE-' || SUBSTRING(invoice_number FROM 5)
  WHEN invoice_number LIKE 'SALE-%' THEN 'INV-POS-' || SUBSTRING(invoice_number FROM 6)
  ELSE invoice_number
END,
reference_number = CASE
  WHEN reference_number LIKE 'POS-OFF-%' THEN 'INV-POS-MOBILE-' || SUBSTRING(reference_number FROM 9)
  WHEN reference_number LIKE 'POS-%' THEN 'INV-POS-MOBILE-' || SUBSTRING(reference_number FROM 5)
  WHEN reference_number LIKE 'SALE-%' THEN 'INV-POS-' || SUBSTRING(reference_number FROM 6)
  ELSE reference_number
END
WHERE invoice_number LIKE 'POS-%'
   OR invoice_number LIKE 'SALE-%'
   OR reference_number LIKE 'POS-%'
   OR reference_number LIKE 'SALE-%';

-- 3) Update inventory transaction references for POS sales
UPDATE public.inventory_transactions
SET reference_number = CASE
  WHEN reference_number LIKE 'POS-OFF-%' THEN 'INV-POS-MOBILE-' || SUBSTRING(reference_number FROM 9)
  WHEN reference_number LIKE 'POS-%' THEN 'INV-POS-MOBILE-' || SUBSTRING(reference_number FROM 5)
  WHEN reference_number LIKE 'SALE-%' THEN 'INV-POS-' || SUBSTRING(reference_number FROM 6)
  ELSE reference_number
END
WHERE reference_number LIKE 'POS-%' OR reference_number LIKE 'SALE-%';

-- 4) Standardize B2B invoice numbers
UPDATE public.sales_invoices
SET invoice_number = REGEXP_REPLACE(invoice_number, '^INV-(\\d+)$', 'INV-SALE-\\1')
WHERE invoice_number ~ '^INV-\\d+$';
