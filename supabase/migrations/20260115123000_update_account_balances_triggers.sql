-- Keep Chart of Accounts balances in sync with journal postings

CREATE OR REPLACE FUNCTION public.trigger_update_account_balances()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM update_account_balances();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_account_balances_on_jel ON public.journal_entry_lines;
CREATE TRIGGER trg_update_account_balances_on_jel
AFTER INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_update_account_balances();

DROP TRIGGER IF EXISTS trg_update_account_balances_on_je_status ON public.journal_entries;
CREATE TRIGGER trg_update_account_balances_on_je_status
AFTER UPDATE OF status ON public.journal_entries
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_update_account_balances();
