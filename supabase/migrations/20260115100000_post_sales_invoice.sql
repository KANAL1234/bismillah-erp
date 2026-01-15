-- Migration: Add journal entry support for B2B sales invoices
-- This creates the post_sales_invoice function to generate GL entries when posting sales invoices

-- 1. Add journal_entry_id column to sales_invoices table
ALTER TABLE public.sales_invoices
ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES public.journal_entries(id);

-- 2. Create index for the new column
CREATE INDEX IF NOT EXISTS idx_sales_invoices_journal_entry_id
ON public.sales_invoices(journal_entry_id);

-- 3. Create the post_sales_invoice function
CREATE OR REPLACE FUNCTION public.post_sales_invoice(p_invoice_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice RECORD;
  v_customer RECORD;
  v_journal_id UUID;
  v_journal_number TEXT;
  v_ar_account_id UUID;
  v_sales_account_id UUID;
  v_output_tax_account_id UUID;
  v_fiscal_year_id UUID;
  v_net_sales NUMERIC(15,2);
BEGIN
  -- Get invoice details
  SELECT * INTO v_invoice FROM sales_invoices WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sales Invoice not found: %', p_invoice_id;
  END IF;

  -- Check if already posted to GL
  IF v_invoice.journal_entry_id IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invoice already posted to General Ledger',
      'journal_id', v_invoice.journal_entry_id
    );
  END IF;

  -- Get customer name for narration
  SELECT name INTO v_customer FROM customers WHERE id = v_invoice.customer_id;

  -- Get account IDs with fallbacks
  SELECT id INTO v_ar_account_id FROM chart_of_accounts
  WHERE account_code IN ('1100', '1110') AND is_active = true
  ORDER BY account_code LIMIT 1;

  SELECT id INTO v_sales_account_id FROM chart_of_accounts
  WHERE account_code IN ('4010', '4000', '4100') AND is_active = true
  ORDER BY account_code LIMIT 1;

  SELECT id INTO v_output_tax_account_id FROM chart_of_accounts
  WHERE account_code IN ('2100', '2110') AND is_active = true
  ORDER BY account_code LIMIT 1;

  -- Validate required accounts exist
  IF v_ar_account_id IS NULL THEN
    RAISE EXCEPTION 'Accounts Receivable account (1100) not found in Chart of Accounts';
  END IF;

  IF v_sales_account_id IS NULL THEN
    RAISE EXCEPTION 'Sales Revenue account (4010) not found in Chart of Accounts';
  END IF;

  -- Get current fiscal year
  SELECT id INTO v_fiscal_year_id FROM fiscal_years WHERE is_closed = false LIMIT 1;

  -- Generate unique journal number
  v_journal_number := 'JE-SINV-' || v_invoice.invoice_number;

  -- Check if journal number already exists (prevent duplicates)
  IF EXISTS (SELECT 1 FROM journal_entries WHERE journal_number = v_journal_number) THEN
    -- Get the existing journal entry
    SELECT id INTO v_journal_id FROM journal_entries WHERE journal_number = v_journal_number;

    -- Update the invoice with the existing journal entry
    UPDATE sales_invoices SET journal_entry_id = v_journal_id WHERE id = p_invoice_id;

    RETURN json_build_object(
      'success', true,
      'journal_id', v_journal_id,
      'journal_number', v_journal_number,
      'message', 'Linked to existing journal entry'
    );
  END IF;

  -- Calculate net sales (subtotal - discount + shipping)
  v_net_sales := COALESCE(v_invoice.subtotal, 0) - COALESCE(v_invoice.discount_amount, 0) + COALESCE(v_invoice.shipping_charges, 0);

  -- Create journal entry
  INSERT INTO journal_entries (
    journal_number,
    journal_type,
    journal_date,
    fiscal_year_id,
    reference_type,
    reference_id,
    reference_number,
    narration,
    total_debit,
    total_credit,
    status,
    posted_at,
    posted_by
  ) VALUES (
    v_journal_number,
    'AUTO',
    v_invoice.invoice_date,
    v_fiscal_year_id,
    'SALES_INVOICE',
    p_invoice_id,
    v_invoice.invoice_number,
    'B2B Sales Invoice - ' || v_invoice.invoice_number || ' - ' || COALESCE(v_customer.name, 'Customer'),
    v_invoice.total_amount,
    v_invoice.total_amount,
    'posted',
    NOW(),
    v_invoice.created_by
  ) RETURNING id INTO v_journal_id;

  -- Debit: Accounts Receivable (full invoice amount)
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (v_journal_id, v_ar_account_id, v_invoice.total_amount, 0,
          'Accounts Receivable - ' || COALESCE(v_customer.name, 'Customer'));

  -- Credit: Sales Revenue (net sales amount)
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (v_journal_id, v_sales_account_id, 0, v_net_sales,
          'Sales Revenue - ' || v_invoice.invoice_number);

  -- Credit: Output Sales Tax (if tax > 0)
  IF COALESCE(v_invoice.tax_amount, 0) > 0 AND v_output_tax_account_id IS NOT NULL THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (v_journal_id, v_output_tax_account_id, 0, v_invoice.tax_amount,
            'Output Sales Tax - ' || v_invoice.invoice_number);
  END IF;

  -- Update invoice with journal entry ID
  UPDATE sales_invoices SET journal_entry_id = v_journal_id WHERE id = p_invoice_id;

  -- Update account balances
  PERFORM update_account_balances();

  RETURN json_build_object(
    'success', true,
    'journal_id', v_journal_id,
    'journal_number', v_journal_number
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- 4. Add comment for documentation
COMMENT ON FUNCTION public.post_sales_invoice(uuid) IS
'Posts a B2B sales invoice to the General Ledger, creating journal entries for AR, Revenue, and Tax';
