-- Fleet Accounting Integration Migration
-- Automatically posts journal entries when fuel and maintenance expenses are recorded

-- ============================================
-- 1. Add Expense Accounts to Chart of Accounts
-- ============================================

INSERT INTO chart_of_accounts (
    id, account_code, account_name, account_type,
    opening_balance, current_balance, is_active, description
) VALUES
    (gen_random_uuid(), '5220', 'Vehicle Fuel Expense', 'EXPENSE', 0, 0, true, 'Fuel expenses for fleet vehicles'),
    (gen_random_uuid(), '5210', 'Vehicle Maintenance Expense', 'EXPENSE', 0, 0, true, 'Maintenance and repair expenses for fleet vehicles')
ON CONFLICT (account_code) DO NOTHING;

-- ============================================
-- 2. Add Accounting Fields to Fleet Tables
-- ============================================

-- Add to fleet_fuel_logs
ALTER TABLE fleet_fuel_logs
    ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'CASH',
    ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES journal_entries(id);

-- Add to fleet_maintenance
ALTER TABLE fleet_maintenance
    ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'CASH',
    ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES journal_entries(id);

-- ============================================
-- 3. RPC Function: post_fleet_fuel_expense
-- ============================================

CREATE OR REPLACE FUNCTION public.post_fleet_fuel_expense(p_fuel_log_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_fuel_log RECORD;
    v_vehicle RECORD;
    v_journal_entry_id uuid;
    v_journal_number text;
    v_fiscal_year_id uuid;
    v_fuel_expense_account_id uuid;
    v_cash_account_id uuid;
    v_ap_account_id uuid;
    v_credit_account_id uuid;
    v_next_number integer;
BEGIN
    -- Get fuel log details
    SELECT * INTO v_fuel_log FROM fleet_fuel_logs WHERE id = p_fuel_log_id;

    IF v_fuel_log IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Fuel log not found');
    END IF;

    -- Check if already posted
    IF v_fuel_log.journal_entry_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Fuel log already posted to accounting');
    END IF;

    -- Get vehicle details for narration
    SELECT * INTO v_vehicle FROM fleet_vehicles WHERE id = v_fuel_log.vehicle_id;

    -- Get fiscal year
    SELECT id INTO v_fiscal_year_id FROM fiscal_years WHERE is_closed = false LIMIT 1;

    -- Get account IDs
    SELECT id INTO v_fuel_expense_account_id FROM chart_of_accounts WHERE account_code = '5220';
    SELECT id INTO v_cash_account_id FROM chart_of_accounts WHERE account_code = '1010';
    SELECT id INTO v_ap_account_id FROM chart_of_accounts WHERE account_code = '2010';

    -- Determine credit account based on payment method
    IF v_fuel_log.payment_method = 'CREDIT' THEN
        v_credit_account_id := v_ap_account_id;
    ELSE
        v_credit_account_id := v_cash_account_id;
    END IF;

    -- Generate journal number
    SELECT COALESCE(MAX(CAST(SUBSTRING(journal_number FROM 9) AS INTEGER)), 0) + 1
    INTO v_next_number
    FROM journal_entries
    WHERE journal_number LIKE 'JE-FUEL-%';

    v_journal_number := 'JE-FUEL-' || LPAD(v_next_number::text, 4, '0');

    -- Create journal entry
    INSERT INTO journal_entries (
        id, journal_number, journal_type, journal_date, fiscal_year_id,
        reference_type, reference_id, reference_number, narration,
        total_debit, total_credit, status, posted_at, created_at
    ) VALUES (
        gen_random_uuid(),
        v_journal_number,
        'AUTO',
        v_fuel_log.log_date::date,
        v_fiscal_year_id,
        'FLEET_FUEL',
        p_fuel_log_id,
        v_journal_number,
        'Fuel expense for vehicle ' || COALESCE(v_vehicle.registration_number, 'Unknown') || ' - ' || v_fuel_log.liters || ' liters',
        v_fuel_log.total_cost,
        v_fuel_log.total_cost,
        'posted',
        NOW(),
        NOW()
    ) RETURNING id INTO v_journal_entry_id;

    -- Create journal entry lines
    -- Debit: Fuel Expense
    INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (
        gen_random_uuid(),
        v_journal_entry_id,
        v_fuel_expense_account_id,
        v_fuel_log.total_cost,
        0,
        'Fuel expense - ' || v_fuel_log.liters || ' liters @ ' || v_fuel_log.cost_per_liter || '/liter'
    );

    -- Credit: Cash or Accounts Payable
    INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (
        gen_random_uuid(),
        v_journal_entry_id,
        v_credit_account_id,
        0,
        v_fuel_log.total_cost,
        CASE WHEN v_fuel_log.payment_method = 'CREDIT' THEN 'Payable for fuel' ELSE 'Cash payment for fuel' END
    );

    -- Update fuel log with journal entry reference
    UPDATE fleet_fuel_logs
    SET journal_entry_id = v_journal_entry_id
    WHERE id = p_fuel_log_id;

    -- Update account balances
    PERFORM update_account_balances();

    RETURN jsonb_build_object(
        'success', true,
        'journal_entry_id', v_journal_entry_id,
        'journal_number', v_journal_number,
        'message', 'Fuel expense posted successfully'
    );
END;
$$;

-- ============================================
-- 4. RPC Function: post_fleet_maintenance_expense
-- ============================================

CREATE OR REPLACE FUNCTION public.post_fleet_maintenance_expense(p_maintenance_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_maintenance RECORD;
    v_vehicle RECORD;
    v_journal_entry_id uuid;
    v_journal_number text;
    v_fiscal_year_id uuid;
    v_maintenance_expense_account_id uuid;
    v_cash_account_id uuid;
    v_ap_account_id uuid;
    v_credit_account_id uuid;
    v_next_number integer;
BEGIN
    -- Get maintenance details
    SELECT * INTO v_maintenance FROM fleet_maintenance WHERE id = p_maintenance_id;

    IF v_maintenance IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Maintenance record not found');
    END IF;

    -- Check if already posted
    IF v_maintenance.journal_entry_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Maintenance already posted to accounting');
    END IF;

    -- Get vehicle details for narration
    SELECT * INTO v_vehicle FROM fleet_vehicles WHERE id = v_maintenance.vehicle_id;

    -- Get fiscal year
    SELECT id INTO v_fiscal_year_id FROM fiscal_years WHERE is_closed = false LIMIT 1;

    -- Get account IDs
    SELECT id INTO v_maintenance_expense_account_id FROM chart_of_accounts WHERE account_code = '5210';
    SELECT id INTO v_cash_account_id FROM chart_of_accounts WHERE account_code = '1010';
    SELECT id INTO v_ap_account_id FROM chart_of_accounts WHERE account_code = '2010';

    -- Determine credit account based on payment method
    IF v_maintenance.payment_method = 'CREDIT' THEN
        v_credit_account_id := v_ap_account_id;
    ELSE
        v_credit_account_id := v_cash_account_id;
    END IF;

    -- Generate journal number
    SELECT COALESCE(MAX(CAST(SUBSTRING(journal_number FROM 10) AS INTEGER)), 0) + 1
    INTO v_next_number
    FROM journal_entries
    WHERE journal_number LIKE 'JE-MAINT-%';

    v_journal_number := 'JE-MAINT-' || LPAD(v_next_number::text, 4, '0');

    -- Create journal entry
    INSERT INTO journal_entries (
        id, journal_number, journal_type, journal_date, fiscal_year_id,
        reference_type, reference_id, reference_number, narration,
        total_debit, total_credit, status, posted_at, created_at
    ) VALUES (
        gen_random_uuid(),
        v_journal_number,
        'AUTO',
        v_maintenance.service_date,
        v_fiscal_year_id,
        'FLEET_MAINTENANCE',
        p_maintenance_id,
        v_journal_number,
        v_maintenance.service_type || ' for vehicle ' || COALESCE(v_vehicle.registration_number, 'Unknown') ||
        CASE WHEN v_maintenance.vendor_name IS NOT NULL THEN ' - ' || v_maintenance.vendor_name ELSE '' END,
        v_maintenance.cost,
        v_maintenance.cost,
        'posted',
        NOW(),
        NOW()
    ) RETURNING id INTO v_journal_entry_id;

    -- Create journal entry lines
    -- Debit: Maintenance Expense
    INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (
        gen_random_uuid(),
        v_journal_entry_id,
        v_maintenance_expense_account_id,
        v_maintenance.cost,
        0,
        v_maintenance.service_type || COALESCE(' - ' || v_maintenance.description, '')
    );

    -- Credit: Cash or Accounts Payable
    INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (
        gen_random_uuid(),
        v_journal_entry_id,
        v_credit_account_id,
        0,
        v_maintenance.cost,
        CASE WHEN v_maintenance.payment_method = 'CREDIT'
             THEN 'Payable to ' || COALESCE(v_maintenance.vendor_name, 'vendor')
             ELSE 'Cash payment for maintenance'
        END
    );

    -- Update maintenance record with journal entry reference
    UPDATE fleet_maintenance
    SET journal_entry_id = v_journal_entry_id
    WHERE id = p_maintenance_id;

    -- Update account balances
    PERFORM update_account_balances();

    RETURN jsonb_build_object(
        'success', true,
        'journal_entry_id', v_journal_entry_id,
        'journal_number', v_journal_number,
        'message', 'Maintenance expense posted successfully'
    );
END;
$$;

-- ============================================
-- 5. Grant permissions
-- ============================================

GRANT EXECUTE ON FUNCTION public.post_fleet_fuel_expense(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_fleet_maintenance_expense(uuid) TO authenticated;
