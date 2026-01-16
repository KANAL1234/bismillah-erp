-- Compute trial balance as of a given date (posted journals only)

CREATE OR REPLACE FUNCTION public.get_trial_balance_as_of(p_as_of date)
RETURNS TABLE(
  account_id uuid,
  account_code text,
  account_name text,
  debit numeric,
  credit numeric,
  balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    coa.id,
    coa.account_code,
    coa.account_name,
    GREATEST(coa.opening_balance + COALESCE(SUM(CASE WHEN je.id IS NULL THEN 0 ELSE jel.debit_amount - jel.credit_amount END), 0), 0) AS debit,
    GREATEST(-(coa.opening_balance + COALESCE(SUM(CASE WHEN je.id IS NULL THEN 0 ELSE jel.debit_amount - jel.credit_amount END), 0)), 0) AS credit,
    coa.opening_balance + COALESCE(SUM(CASE WHEN je.id IS NULL THEN 0 ELSE jel.debit_amount - jel.credit_amount END), 0) AS balance
  FROM chart_of_accounts coa
  LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
  LEFT JOIN journal_entries je
    ON je.id = jel.journal_entry_id
   AND je.status = 'posted'
   AND je.journal_date <= p_as_of
  GROUP BY coa.id, coa.account_code, coa.account_name, coa.opening_balance
  ORDER BY coa.account_code;
END;
$$;
