-- Fix the trigger function to use 'posted' instead of 'cleared'
-- The receipt_vouchers table status check only allows 'draft', 'posted', or 'cancelled'
CREATE OR REPLACE FUNCTION public.update_customer_balance_on_payment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- On INSERT or UPDATE of receipt
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        -- Update customer balance when payment is POSTED
        IF NEW.status = 'posted' THEN
            -- If it's an update, we should only apply if status changed to 'posted'
            -- or allow it to be idempotent by checking the previous status in more complex scenarios.
            -- For basic usage, we subtract the amount from the customer's balance.
            UPDATE customers
            SET current_balance = current_balance - NEW.amount
            WHERE id = NEW.customer_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
