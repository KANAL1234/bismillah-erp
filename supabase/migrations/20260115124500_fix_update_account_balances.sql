-- Fix safe-update restrictions and allow balance refresh via RPC

CREATE OR REPLACE FUNCTION public.update_account_balances()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE chart_of_accounts coa
  SET current_balance = coa.opening_balance + 
    COALESCE((
      SELECT SUM(jel.debit_amount) - SUM(jel.credit_amount)
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE jel.account_id = coa.id
        AND je.status = 'posted'
    ), 0)
  WHERE true;
END;
$$;
