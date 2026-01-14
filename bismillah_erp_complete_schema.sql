--
-- PostgreSQL database dump
--

\restrict lnyXBwJ6jnfa6NT3m3hs7SJMnW8wSSIOlHNzR7ks4obM8GyXax8TbsCdFzIp1ZP

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: adjust_inventory_stock(uuid, uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.adjust_inventory_stock(p_product_id uuid, p_location_id uuid, p_quantity_change numeric) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Check if stock record exists
  IF EXISTS (
    SELECT 1 FROM inventory_stock 
    WHERE product_id = p_product_id AND location_id = p_location_id
  ) THEN
    -- Update existing: increment both on_hand and available
    -- Also recalculate total_value based on average_cost
    UPDATE inventory_stock
    SET quantity_on_hand = quantity_on_hand + p_quantity_change,
        quantity_available = quantity_available + p_quantity_change,
        total_value = (quantity_on_hand + p_quantity_change) * COALESCE(average_cost, 0),
        last_updated = NOW()
    WHERE product_id = p_product_id AND location_id = p_location_id;
  ELSE
    -- Create new record (if adding stock)
    IF p_quantity_change > 0 THEN
      -- For new records, on_hand and available are the same
      -- total_value is 0 until cost is updated, or we use a default
      INSERT INTO inventory_stock (
        product_id, 
        location_id, 
        quantity_on_hand, 
        quantity_available,
        total_value
      )
      VALUES (
        p_product_id, 
        p_location_id, 
        p_quantity_change, 
        p_quantity_change,
        0
      );
    ELSE
      RAISE EXCEPTION 'Cannot create negative stock for new location';
    END IF;
  END IF;
END;
$$;


--
-- Name: assign_permissions_to_role(uuid, uuid[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_permissions_to_role(p_role_id uuid, p_permission_ids uuid[], p_assigned_by uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_permission_id uuid;
BEGIN
    -- Clear existing permissions
    DELETE FROM role_permissions WHERE role_id = p_role_id;

    -- Assign new permissions
    FOREACH v_permission_id IN ARRAY p_permission_ids
    LOOP
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES (p_role_id, v_permission_id)
        ON CONFLICT DO NOTHING;
    END LOOP;

    -- Log action
    INSERT INTO audit_logs (user_id, action, module, resource, new_values)
    VALUES (
        p_assigned_by,
        'update_role_permissions',
        'settings',
        'roles',
        json_build_object(
            'role_id', p_role_id,
            'permission_count', array_length(p_permission_ids, 1)
        )
    );

    RETURN json_build_object(
        'success', true,
        'message', 'Permissions updated successfully',
        'count', array_length(p_permission_ids, 1)
    );
END;
$$;


--
-- Name: assign_role_to_user(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_role_to_user(p_user_id uuid, p_role_id uuid, p_assigned_by uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result json;
BEGIN
    -- Check if role is already assigned
    IF EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = p_user_id AND role_id = p_role_id
    ) THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Role already assigned to user'
        );
    END IF;

    -- Assign role
    INSERT INTO user_roles (user_id, role_id, assigned_by)
    VALUES (p_user_id, p_role_id, p_assigned_by);

    -- Log action
    INSERT INTO audit_logs (user_id, action, module, resource, new_values)
    VALUES (
        p_assigned_by,
        'assign_role',
        'settings',
        'users',
        json_build_object(
            'user_id', p_user_id,
            'role_id', p_role_id
        )
    );

    RETURN json_build_object(
        'success', true,
        'message', 'Role assigned successfully'
    );
END;
$$;


--
-- Name: auto_create_vendor_bill_from_grn(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_create_vendor_bill_from_grn() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_bill_number TEXT;
    v_last_bill_number TEXT;
    v_next_number INTEGER;
    v_subtotal NUMERIC;
    v_tax_amount NUMERIC;
    v_total_amount NUMERIC;
    v_vendor_bill_id UUID;
    v_grn_item RECORD;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM goods_receipt_items WHERE grn_id = NEW.id) THEN
        RETURN NEW;
    END IF;

    IF EXISTS (SELECT 1 FROM vendor_bills WHERE grn_id = NEW.id) THEN
        RETURN NEW;
    END IF;

    SELECT bill_number INTO v_last_bill_number
    FROM vendor_bills ORDER BY created_at DESC LIMIT 1;

    IF v_last_bill_number IS NULL THEN
        v_bill_number := 'VB-0001';
    ELSE
        v_next_number := CAST(SPLIT_PART(v_last_bill_number, '-', 2) AS INTEGER) + 1;
        v_bill_number := 'VB-' || LPAD(v_next_number::TEXT, 4, '0');
    END IF;

    -- Fix: Handle 0 as NULL/Not Set
    IF COALESCE(NEW.subtotal, 0) > 0 THEN
        v_subtotal := NEW.subtotal;
    ELSE
        v_subtotal := COALESCE(NEW.total_amount, 0);
    END IF;

    v_tax_amount := v_subtotal * 0.18;
    v_total_amount := v_subtotal + v_tax_amount;

    INSERT INTO vendor_bills (
        bill_number, vendor_id, grn_id, bill_date, due_date,
        subtotal, tax_amount, total_amount,
        status, payment_status, created_by, approved_by
    ) VALUES (
        v_bill_number, NEW.vendor_id, NEW.id, NEW.receipt_date,
        NEW.receipt_date + INTERVAL '30 days',
        v_subtotal, v_tax_amount, v_total_amount,
        'approved', 'unpaid', NEW.received_by, NEW.received_by
    )
    RETURNING id INTO v_vendor_bill_id;

    FOR v_grn_item IN 
        SELECT product_id, quantity_received, unit_cost
        FROM goods_receipt_items WHERE grn_id = NEW.id
    LOOP
        INSERT INTO vendor_bill_items (
            bill_id, product_id, quantity, unit_price, tax_percentage
        ) VALUES (
            v_vendor_bill_id, v_grn_item.product_id, v_grn_item.quantity_received,
            v_grn_item.unit_cost, 18
        );
    END LOOP;

    BEGIN
        PERFORM post_vendor_bill(v_vendor_bill_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'GL posting failed: %', SQLERRM;
    END;

    RAISE NOTICE '✅ Auto-created vendor bill % from GRN %', v_bill_number, NEW.grn_number;
    RETURN NEW;
END;
$$;


--
-- Name: FUNCTION auto_create_vendor_bill_from_grn(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.auto_create_vendor_bill_from_grn() IS 'Autonomous workflow: Automatically creates and posts vendor bill when GRN is created';


--
-- Name: check_customer_credit_available(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_customer_credit_available(p_customer_id uuid, p_additional_amount numeric DEFAULT 0) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result json;
    v_credit_limit numeric;
    v_current_balance numeric;
    v_available_credit numeric;
    v_can_proceed boolean;
    v_customer_name text;
BEGIN
    -- Get customer details
    SELECT 
        credit_limit,
        current_balance,
        name
    INTO 
        v_credit_limit,
        v_current_balance,
        v_customer_name
    FROM customers
    WHERE id = p_customer_id;

    -- If customer not found
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'can_proceed', false,
            'message', 'Customer not found',
            'credit_limit', 0,
            'current_balance', 0,
            'available_credit', 0
        );
    END IF;

    -- Calculate available credit
    v_available_credit := v_credit_limit - v_current_balance;

    -- Check if can proceed
    v_can_proceed := (v_current_balance + p_additional_amount) <= v_credit_limit;

    -- Build result
    v_result := json_build_object(
        'success', true,
        'customer_name', v_customer_name,
        'can_proceed', v_can_proceed,
        'credit_limit', v_credit_limit,
        'current_balance', v_current_balance,
        'available_credit', v_available_credit,
        'requested_amount', p_additional_amount,
        'new_balance_if_approved', v_current_balance + p_additional_amount,
        'message', CASE 
            WHEN v_can_proceed THEN 'Credit available'
            WHEN v_credit_limit = 0 THEN 'Customer has no credit facility. Cash only.'
            ELSE 'Credit limit exceeded! Limit: ' || v_credit_limit || ', Current: ' || v_current_balance || ', Available: ' || v_available_credit
        END,
        'severity', CASE
            WHEN v_can_proceed THEN 'success'
            WHEN v_available_credit > 0 AND NOT v_can_proceed THEN 'warning'
            ELSE 'error'
        END
    );

    RETURN v_result;
END;
$$;


--
-- Name: check_stock_availability(uuid, uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_stock_availability(p_location_id uuid, p_product_id uuid, p_required_quantity numeric) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    RETURN public.get_stock_level(p_location_id, p_product_id) >= p_required_quantity;
END;
$$;


--
-- Name: check_user_permission(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_user_permission(p_user_id uuid, p_permission_code text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_has_permission boolean;
BEGIN
    -- Check if user has the permission through any of their roles
    SELECT EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN role_permissions rp ON rp.role_id = ur.role_id
        JOIN permissions p ON p.id = rp.permission_id
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = p_user_id
          AND p.permission_code = p_permission_code
          AND r.is_active = true
    ) INTO v_has_permission;

    RETURN v_has_permission;
END;
$$;


--
-- Name: create_user_profile(uuid, text, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_user_profile(p_user_id uuid, p_full_name text, p_email text, p_employee_code text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_location_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO user_profiles (
        id,
        full_name,
        email,
        employee_code,
        phone,
        location_id
    ) VALUES (
        p_user_id,
        p_full_name,
        p_email,
        p_employee_code,
        p_phone,
        p_location_id
    );

    RETURN json_build_object(
        'success', true,
        'message', 'User profile created successfully'
    );
EXCEPTION
    WHEN unique_violation THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Employee code already exists'
        );
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'message', SQLERRM
        );
END;
$$;


--
-- Name: get_all_users_with_roles(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_users_with_roles() RETURNS TABLE(user_id uuid, full_name text, email text, employee_code text, phone text, is_active boolean, last_login timestamp with time zone, roles json, allowed_locations json, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.id,
        up.full_name,
        up.email,
        up.employee_code,
        up.phone,
        up.is_active,
        up.last_login,
        (
            SELECT COALESCE(json_agg(json_build_object(
                'role_id', r.id,
                'role_code', r.role_code,
                'role_name', r.role_name
            )), '[]'::json)
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = up.id AND r.is_active = true
        ) as roles,
        (
            SELECT COALESCE(json_agg(json_build_object(
                'location_id', loc.id,
                'location_name', loc.name,
                'location_code', loc.code
            )), '[]'::json)
            FROM user_allowed_locations ual
            JOIN locations loc ON loc.id = ual.location_id
            WHERE ual.user_id = up.id
        ) as allowed_locations,
        up.created_at
    FROM user_profiles up
    ORDER BY up.full_name;
END;
$$;


--
-- Name: get_balance_sheet(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_balance_sheet(p_as_of_date date) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result json;
    v_cash numeric := 0;
    v_bank numeric := 0;
    v_ar numeric := 0;
    v_inventory numeric := 0;
    v_other_current numeric := 0;
    v_fixed_gross numeric := 0;
    v_depreciation numeric := 0;
    v_ap numeric := 0;
    v_tax_payable numeric := 0;
    v_other_current_liab numeric := 0;
    v_long_term_liab numeric := 0;
    v_capital numeric := 0;
    v_retained_earnings numeric := 0;
    v_current_year_profit numeric := 0;
    v_fy_start date;
BEGIN
    -- Fix: Use is_closed = false and order by start_date DESC to find current FY
    SELECT start_date INTO v_fy_start
    FROM fiscal_years
    WHERE is_closed = false
    ORDER BY start_date DESC
    LIMIT 1;
    
    IF v_fy_start IS NULL THEN
        v_fy_start := (date_trunc('year', p_as_of_date) - interval '6 months')::date;
        -- Pakistani FY usually starts July 1st
        IF extract(month from p_as_of_date) >= 7 THEN
            v_fy_start := (extract(year from p_as_of_date) || '-07-01')::date;
        ELSE
            v_fy_start := ((extract(year from p_as_of_date) - 1) || '-07-01')::date;
        END IF;
    END IF;

    -- Cash (1010)
    SELECT COALESCE(
        SUM(coa.opening_balance + jel.debit_amount - jel.credit_amount), 
        0
    ) INTO v_cash
    FROM chart_of_accounts coa
    LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
    LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id 
        AND je.status = 'posted' 
        AND je.journal_date <= p_as_of_date
    WHERE coa.account_code = '1010';

    -- Bank (1020-1099)
    SELECT COALESCE(
        SUM(coa.opening_balance + jel.debit_amount - jel.credit_amount), 
        0
    ) INTO v_bank
    FROM chart_of_accounts coa
    LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
    LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id 
        AND je.status = 'posted' 
        AND je.journal_date <= p_as_of_date
    WHERE coa.account_code >= '1020' AND coa.account_code < '1100';

    -- Accounts Receivable (1100-1199)
    SELECT COALESCE(
        SUM(coa.opening_balance + jel.debit_amount - jel.credit_amount), 
        0
    ) INTO v_ar
    FROM chart_of_accounts coa
    LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
    LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id 
        AND je.status = 'posted' 
        AND je.journal_date <= p_as_of_date
    WHERE coa.account_code >= '1100' AND coa.account_code < '1200';

    -- Inventory (1200-1299)
    SELECT COALESCE(
        SUM(coa.opening_balance + jel.debit_amount - jel.credit_amount), 
        0
    ) INTO v_inventory
    FROM chart_of_accounts coa
    LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
    LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id 
        AND je.status = 'posted' 
        AND je.journal_date <= p_as_of_date
    WHERE coa.account_code >= '1200' AND coa.account_code < '1300';

    -- Other Current Assets (1300-1499)
    SELECT COALESCE(
        SUM(coa.opening_balance + jel.debit_amount - jel.credit_amount), 
        0
    ) INTO v_other_current
    FROM chart_of_accounts coa
    LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
    LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id 
        AND je.status = 'posted' 
        AND je.journal_date <= p_as_of_date
    WHERE coa.account_code >= '1300' AND coa.account_code < '1500';

    -- Fixed Assets Gross (1500-1599, excluding depreciation)
    SELECT COALESCE(
        SUM(coa.opening_balance + jel.debit_amount - jel.credit_amount), 
        0
    ) INTO v_fixed_gross
    FROM chart_of_accounts coa
    LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
    LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id 
        AND je.status = 'posted' 
        AND je.journal_date <= p_as_of_date
    WHERE coa.account_code >= '1500' AND coa.account_code < '1600';

    -- Accumulated Depreciation (1600-1699)
    SELECT COALESCE(
        SUM(coa.opening_balance + jel.credit_amount - jel.debit_amount), 
        0
    ) INTO v_depreciation
    FROM chart_of_accounts coa
    LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
    LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id 
        AND je.status = 'posted' 
        AND je.journal_date <= p_as_of_date
    WHERE coa.account_code >= '1600' AND coa.account_code < '1700';

    -- Accounts Payable (2010-2099)
    SELECT COALESCE(
        SUM(coa.opening_balance + jel.credit_amount - jel.debit_amount), 
        0
    ) INTO v_ap
    FROM chart_of_accounts coa
    LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
    LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id 
        AND je.status = 'posted' 
        AND je.journal_date <= p_as_of_date
    WHERE coa.account_code >= '2010' AND coa.account_code < '2100';

    -- Tax Payable (2100-2199)
    SELECT COALESCE(
        SUM(coa.opening_balance + jel.credit_amount - jel.debit_amount), 
        0
    ) INTO v_tax_payable
    FROM chart_of_accounts coa
    LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
    LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id 
        AND je.status = 'posted' 
        AND je.journal_date <= p_as_of_date
    WHERE coa.account_code >= '2100' AND coa.account_code < '2200';

    -- Other Current Liabilities (2200-2499)
    SELECT COALESCE(
        SUM(coa.opening_balance + jel.credit_amount - jel.debit_amount), 
        0
    ) INTO v_other_current_liab
    FROM chart_of_accounts coa
    LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
    LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id 
        AND je.status = 'posted' 
        AND je.journal_date <= p_as_of_date
    WHERE coa.account_code >= '2200' AND coa.account_code < '2500';

    -- Long-term Liabilities (2500-2999)
    SELECT COALESCE(
        SUM(coa.opening_balance + jel.credit_amount - jel.debit_amount), 
        0
    ) INTO v_long_term_liab
    FROM chart_of_accounts coa
    LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
    LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id 
        AND je.status = 'posted' 
        AND je.journal_date <= p_as_of_date
    WHERE coa.account_code >= '2500' AND coa.account_code < '3000';

    -- Capital (3000-3099)
    SELECT COALESCE(
        SUM(coa.opening_balance + jel.credit_amount - jel.debit_amount), 
        0
    ) INTO v_capital
    FROM chart_of_accounts coa
    LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
    LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id 
        AND je.status = 'posted' 
        AND je.journal_date <= p_as_of_date
    WHERE coa.account_code >= '3000' AND coa.account_code < '3100';

    -- Retained Earnings (3100)
    SELECT COALESCE(
        SUM(coa.opening_balance + jel.credit_amount - jel.debit_amount), 
        0
    ) INTO v_retained_earnings
    FROM chart_of_accounts coa
    LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
    LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id 
        AND je.status = 'posted' 
        AND je.journal_date < v_fy_start
    WHERE coa.account_code = '3100';

    -- Current Year Profit (from P&L)
    -- Fix: Use explicit table alias to avoid ambiguity with v_result variable
    SELECT (sub_res.res->>'netProfit')::numeric INTO v_current_year_profit
    FROM (SELECT get_profit_loss_statement(v_fy_start, p_as_of_date) as res) sub_res;

    -- Build JSON result
    BEGIN
        DECLARE
            v_total_current_assets numeric;
            v_net_fixed_assets numeric;
            v_total_assets numeric;
            v_total_current_liab numeric;
            v_total_liab numeric;
            v_total_equity numeric;
        BEGIN
            v_total_current_assets := v_cash + v_bank + v_ar + v_inventory + v_other_current;
            v_net_fixed_assets := v_fixed_gross - v_depreciation;
            v_total_assets := v_total_current_assets + v_net_fixed_assets;
            
            v_total_current_liab := v_ap + v_tax_payable + v_other_current_liab;
            v_total_liab := v_total_current_liab + v_long_term_liab;
            v_total_equity := v_capital + v_retained_earnings + v_current_year_profit;

            v_result := json_build_object(
                'assets', json_build_object(
                    'currentAssets', json_build_object(
                        'cash', v_cash,
                        'bank', v_bank,
                        'accountsReceivable', v_ar,
                        'inventory', v_inventory,
                        'other', v_other_current,
                        'total', v_total_current_assets
                    ),
                    'fixedAssets', json_build_object(
                        'grossValue', v_fixed_gross,
                        'depreciation', v_depreciation,
                        'netValue', v_net_fixed_assets
                    ),
                    'totalAssets', v_total_assets
                ),
                'liabilities', json_build_object(
                    'currentLiabilities', json_build_object(
                        'accountsPayable', v_ap,
                        'taxPayable', v_tax_payable,
                        'other', v_other_current_liab,
                        'total', v_total_current_liab
                    ),
                    'longTermLiabilities', v_long_term_liab,
                    'totalLiabilities', v_total_liab
                ),
                'equity', json_build_object(
                    'capital', v_capital,
                    'retainedEarnings', v_retained_earnings,
                    'currentYearProfit', v_current_year_profit,
                    'totalEquity', v_total_equity
                ),
                'totalLiabilitiesEquity', v_total_liab + v_total_equity
            );
        END;
    END;

    RETURN v_result;
END;
$$;


--
-- Name: get_customer_aging_report(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_customer_aging_report(p_as_of_date date) RETURNS TABLE(customer_id uuid, customer_name text, customer_code text, buckets json)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as customer_id,
        c.name as customer_name,
        c.customer_code,
        json_build_object(
            'current', COALESCE(SUM(CASE 
                WHEN p_as_of_date - ci.due_date <= 30 THEN ci.amount_due 
                ELSE 0 
            END), 0),
            'days_31_60', COALESCE(SUM(CASE 
                WHEN p_as_of_date - ci.due_date BETWEEN 31 AND 60 THEN ci.amount_due 
                ELSE 0 
            END), 0),
            'days_61_90', COALESCE(SUM(CASE 
                WHEN p_as_of_date - ci.due_date BETWEEN 61 AND 90 THEN ci.amount_due 
                ELSE 0 
            END), 0),
            'days_91_120', COALESCE(SUM(CASE 
                WHEN p_as_of_date - ci.due_date BETWEEN 91 AND 120 THEN ci.amount_due 
                ELSE 0 
            END), 0),
            'over_120', COALESCE(SUM(CASE 
                WHEN p_as_of_date - ci.due_date > 120 THEN ci.amount_due 
                ELSE 0 
            END), 0),
            'total', COALESCE(SUM(ci.amount_due), 0)
        ) as buckets
    FROM customers c
    LEFT JOIN customer_invoices ci ON ci.customer_id = c.id
        AND ci.amount_due > 0
        AND ci.payment_status IN ('unpaid', 'partial', 'overdue')
        AND ci.due_date <= p_as_of_date
    WHERE c.is_active = true
    GROUP BY c.id, c.name, c.customer_code
    HAVING SUM(ci.amount_due) > 0
    ORDER BY SUM(ci.amount_due) DESC;
END;
$$;


--
-- Name: get_customer_credit_summary(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_customer_credit_summary(p_customer_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result json;
    v_credit_limit numeric;
    v_current_balance numeric;
    v_total_invoiced numeric;
    v_total_paid numeric;
    v_pending_orders numeric;
    v_overdue_amount numeric;
    v_customer_name text;
    v_payment_terms text := 'N/A'; -- Default for now
BEGIN
    -- Get customer details
    SELECT 
        credit_limit,
        current_balance,
        name
    INTO 
        v_credit_limit,
        v_current_balance,
        v_customer_name
    FROM customers
    WHERE id = p_customer_id;

    -- If customer not found
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Customer not found');
    END IF;

    -- Get total invoiced (all time)
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_total_invoiced
    FROM customer_invoices
    WHERE customer_id = p_customer_id
      AND status != 'cancelled';

    -- Get total paid
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_paid
    FROM receipt_vouchers
    WHERE customer_id = p_customer_id
      AND status = 'cleared';

    -- Get pending orders value
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_pending_orders
    FROM sales_orders
    WHERE customer_id = p_customer_id
      AND status IN ('draft', 'pending', 'approved', 'processing');

    -- Get overdue amount
    SELECT COALESCE(SUM(amount_due), 0)
    INTO v_overdue_amount
    FROM customer_invoices
    WHERE customer_id = p_customer_id
      AND payment_status IN ('unpaid', 'partial', 'overdue')
      AND due_date < CURRENT_DATE;

    -- Build result
    v_result := json_build_object(
        'customer_name', v_customer_name,
        'payment_terms', v_payment_terms,
        'credit_limit', v_credit_limit,
        'current_balance', v_current_balance,
        'available_credit', v_credit_limit - v_current_balance,
        'credit_utilization_pct', CASE 
            WHEN v_credit_limit > 0 THEN ROUND((v_current_balance / v_credit_limit * 100), 2)
            ELSE 0 
        END,
        'total_invoiced', v_total_invoiced,
        'total_paid', v_total_paid,
        'pending_orders_value', v_pending_orders,
        'overdue_amount', v_overdue_amount,
        'has_overdue', v_overdue_amount > 0,
        'credit_status', CASE
            WHEN v_current_balance > v_credit_limit THEN 'EXCEEDED'
            WHEN v_current_balance > (v_credit_limit * 0.9) THEN 'CRITICAL'
            WHEN v_current_balance > (v_credit_limit * 0.75) THEN 'WARNING'
            ELSE 'GOOD'
        END
    );

    RETURN v_result;
END;
$$;


--
-- Name: get_customers_near_credit_limit(numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_customers_near_credit_limit(p_threshold_pct numeric DEFAULT 80) RETURNS TABLE(customer_id uuid, customer_code text, customer_name text, credit_limit numeric, current_balance numeric, available_credit numeric, utilization_pct numeric, overdue_amount numeric, status text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    WITH customer_stats AS (
        SELECT 
            c.id as c_id,
            c.customer_code as c_code,
            c.name as c_name,
            c.credit_limit as c_limit,
            c.current_balance as c_balance,
            (c.credit_limit - c.current_balance) as c_available,
            CASE 
                WHEN c.credit_limit > 0 
                THEN ROUND((c.current_balance / c.credit_limit * 100), 2)
                ELSE 0 
            END as c_utilization,
            COALESCE(SUM(CASE 
                WHEN ci.due_date < CURRENT_DATE 
                    AND ci.payment_status IN ('unpaid', 'partial', 'overdue')
                THEN ci.amount_due 
                ELSE 0 
            END), 0) as c_overdue
        FROM customers c
        LEFT JOIN customer_invoices ci ON ci.customer_id = c.id
        WHERE c.is_active = true
          AND c.credit_limit > 0
        GROUP BY c.id, c.customer_code, c.name, c.credit_limit, c.current_balance
    )
    SELECT 
        c_id,
        c_code,
        c_name,
        c_limit,
        c_balance,
        c_available,
        c_utilization,
        c_overdue,
        CASE
            WHEN c_balance > c_limit THEN 'EXCEEDED'
            WHEN c_utilization >= 90 THEN 'CRITICAL'
            WHEN c_utilization >= p_threshold_pct THEN 'WARNING'
            ELSE 'GOOD'
        END as status
    FROM customer_stats
    WHERE c_utilization >= p_threshold_pct OR c_balance > c_limit
    ORDER BY c_utilization DESC;
END;
$$;


--
-- Name: get_product_by_barcode(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_product_by_barcode(p_barcode text) RETURNS TABLE(id uuid, sku text, name text, selling_price numeric, cost_price numeric, barcode text)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.sku,
    p.name,
    p.selling_price,
    p.cost_price,
    p.barcode
  FROM products p
  WHERE p.barcode = p_barcode
     OR p.id IN (
       SELECT product_id 
       FROM product_barcodes 
       WHERE barcode = p_barcode
     )
  LIMIT 1;
END;
$$;


--
-- Name: get_profit_loss_statement(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_profit_loss_statement(p_date_from date, p_date_to date) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result json;
    v_sales_revenue numeric := 0;
    v_service_revenue numeric := 0;
    v_other_income numeric := 0;
    v_sales_returns numeric := 0;
    v_purchases numeric := 0;
    v_purchase_returns numeric := 0;
    v_direct_expenses numeric := 0;
    v_selling_expenses numeric := 0;
    v_admin_expenses numeric := 0;
    v_financial_expenses numeric := 0;
    v_total_revenue numeric;
    v_total_cogs numeric;
    v_gross_profit numeric;
    v_total_expenses numeric;
    v_net_profit numeric;
BEGIN
    -- Revenue: Sales Revenue (4010)
    SELECT COALESCE(SUM(jel.credit_amount - jel.debit_amount), 0) INTO v_sales_revenue
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN chart_of_accounts coa ON coa.id = jel.account_id
    WHERE je.status = 'posted'
      AND je.journal_date BETWEEN p_date_from AND p_date_to
      AND coa.account_code = '4010';

    -- Revenue: Service Revenue (4100)
    SELECT COALESCE(SUM(jel.credit_amount - jel.debit_amount), 0) INTO v_service_revenue
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN chart_of_accounts coa ON coa.id = jel.account_id
    WHERE je.status = 'posted'
      AND je.journal_date BETWEEN p_date_from AND p_date_to
      AND coa.account_code = '4100';

    -- Revenue: Other Income (4300+)
    SELECT COALESCE(SUM(jel.credit_amount - jel.debit_amount), 0) INTO v_other_income
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN chart_of_accounts coa ON coa.id = jel.account_id
    WHERE je.status = 'posted'
      AND je.journal_date BETWEEN p_date_from AND p_date_to
      AND coa.account_code >= '4300' AND coa.account_code < '5000';

    -- Sales Returns (4200)
    SELECT COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0) INTO v_sales_returns
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN chart_of_accounts coa ON coa.id = jel.account_id
    WHERE je.status = 'posted'
      AND je.journal_date BETWEEN p_date_from AND p_date_to
      AND coa.account_code = '4200';

    -- Cost of Sales: Purchases (5010, 5020)
    SELECT COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0) INTO v_purchases
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN chart_of_accounts coa ON coa.id = jel.account_id
    WHERE je.status = 'posted'
      AND je.journal_date BETWEEN p_date_from AND p_date_to
      AND coa.account_code IN ('5010', '5020');

    -- Purchase Returns (5100)
    SELECT COALESCE(SUM(jel.credit_amount - jel.debit_amount), 0) INTO v_purchase_returns
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN chart_of_accounts coa ON coa.id = jel.account_id
    WHERE je.status = 'posted'
      AND je.journal_date BETWEEN p_date_from AND p_date_to
      AND coa.account_code = '5100';

    -- Direct Expenses (5200-5399)
    SELECT COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0) INTO v_direct_expenses
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN chart_of_accounts coa ON coa.id = jel.account_id
    WHERE je.status = 'posted'
      AND je.journal_date BETWEEN p_date_from AND p_date_to
      AND coa.account_code >= '5200' AND coa.account_code < '6000';

    -- Selling Expenses (6000-6499)
    SELECT COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0) INTO v_selling_expenses
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN chart_of_accounts coa ON coa.id = jel.account_id
    WHERE je.status = 'posted'
      AND je.journal_date BETWEEN p_date_from AND p_date_to
      AND coa.account_code >= '6000' AND coa.account_code < '6500';

    -- Administrative Expenses (6500-6699)
    SELECT COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0) INTO v_admin_expenses
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN chart_of_accounts coa ON coa.id = jel.account_id
    WHERE je.status = 'posted'
      AND je.journal_date BETWEEN p_date_from AND p_date_to
      AND coa.account_code >= '6500' AND coa.account_code < '6700';

    -- Financial Expenses (6610, 6620)
    SELECT COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0) INTO v_financial_expenses
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN chart_of_accounts coa ON coa.id = jel.account_id
    WHERE je.status = 'posted'
      AND je.journal_date BETWEEN p_date_from AND p_date_to
      AND coa.account_code IN ('6610', '6620');

    -- Calculations
    v_total_revenue := v_sales_revenue + v_service_revenue + v_other_income - v_sales_returns;
    v_total_cogs := v_purchases - v_purchase_returns + v_direct_expenses;
    v_gross_profit := v_total_revenue - v_total_cogs;
    v_total_expenses := v_selling_expenses + v_admin_expenses + v_financial_expenses;
    v_net_profit := v_gross_profit - v_total_expenses;

    -- Build JSON result
    v_result := json_build_object(
        'revenue', json_build_object(
            'salesRevenue', v_sales_revenue,
            'serviceRevenue', v_service_revenue,
            'otherIncome', v_other_income,
            'salesReturns', v_sales_returns,
            'totalRevenue', v_total_revenue
        ),
        'costOfSales', json_build_object(
            'purchases', v_purchases,
            'purchaseReturns', v_purchase_returns,
            'directExpenses', v_direct_expenses,
            'totalCOGS', v_total_cogs
        ),
        'grossProfit', v_gross_profit,
        'grossProfitMargin', CASE WHEN v_total_revenue > 0 THEN (v_gross_profit / v_total_revenue * 100) ELSE 0 END,
        'expenses', json_build_object(
            'selling', v_selling_expenses,
            'administrative', v_admin_expenses,
            'financial', v_financial_expenses,
            'totalExpenses', v_total_expenses
        ),
        'netProfit', v_net_profit,
        'netProfitMargin', CASE WHEN v_total_revenue > 0 THEN (v_net_profit / v_total_revenue * 100) ELSE 0 END
    );

    RETURN v_result;
END;
$$;


--
-- Name: get_purchase_by_vendor(date, date, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_purchase_by_vendor(p_date_from date, p_date_to date, p_limit integer DEFAULT 20) RETURNS TABLE(vendor_id uuid, vendor_code text, vendor_name text, total_purchases numeric, total_paid numeric, outstanding numeric, bill_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vb.vendor_id,
        v.vendor_code,
        v.name as vendor_name,
        SUM(vb.total_amount) as total_purchases,
        SUM(vb.amount_paid) as total_paid,
        SUM(vb.amount_due) as outstanding,
        COUNT(*) as bill_count
    FROM vendor_bills vb
    LEFT JOIN vendors v ON v.id = vb.vendor_id
    WHERE vb.bill_date::date BETWEEN p_date_from AND p_date_to
      AND vb.status != 'cancelled'
    GROUP BY vb.vendor_id, v.vendor_code, v.name
    ORDER BY total_purchases DESC
    LIMIT p_limit;
END;
$$;


--
-- Name: get_purchase_register(date, date, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_purchase_register(p_date_from date, p_date_to date, p_vendor_id uuid DEFAULT NULL::uuid) RETURNS TABLE(bill_date date, bill_number text, vendor_code text, vendor_name text, grn_number text, po_number text, subtotal numeric, sales_tax_amount numeric, wht_amount numeric, other_charges numeric, total_amount numeric, amount_paid numeric, amount_due numeric, payment_status text, reference_number text, created_by_email text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vb.bill_date::date,
        vb.bill_number,
        v.vendor_code,
        v.name as vendor_name,
        grn.grn_number,
        ''::text as po_number,
        vb.subtotal,
        vb.tax_amount as sales_tax_amount,
        vb.wht_amount,
        0::numeric as other_charges,
        vb.total_amount,
        vb.amount_paid,
        vb.amount_due,
        vb.payment_status::text,
        vb.reference_number,
        ''::text as created_by_email
    FROM vendor_bills vb
    LEFT JOIN vendors v ON v.id = vb.vendor_id
    LEFT JOIN goods_receipt_notes grn ON grn.id = vb.grn_id
    WHERE vb.bill_date::date BETWEEN p_date_from AND p_date_to
      AND (p_vendor_id IS NULL OR vb.vendor_id = p_vendor_id)
      AND vb.status != 'cancelled'
    ORDER BY vb.bill_date DESC, vb.bill_number DESC;
END;
$$;


--
-- Name: get_purchase_register_summary(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_purchase_register_summary(p_date_from date, p_date_to date) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result json;
    v_total_purchases numeric;
    v_total_tax numeric;
    v_total_wht numeric;
    v_net_payable numeric;
    v_total_paid numeric;
    v_total_outstanding numeric;
    v_bill_count integer;
BEGIN
    SELECT 
        COALESCE(SUM(subtotal), 0),
        COALESCE(SUM(tax_amount), 0),
        COALESCE(SUM(wht_amount), 0),
        COALESCE(SUM(total_amount), 0),
        COALESCE(SUM(amount_paid), 0),
        COALESCE(SUM(amount_due), 0),
        COUNT(*)
    INTO 
        v_total_purchases,
        v_total_tax,
        v_total_wht,
        v_net_payable,
        v_total_paid,
        v_total_outstanding,
        v_bill_count
    FROM vendor_bills
    WHERE bill_date::date BETWEEN p_date_from AND p_date_to
      AND status != 'cancelled';

    v_result := json_build_object(
        'period', json_build_object('from', p_date_from, 'to', p_date_to),
        'totals', json_build_object(
            'gross_purchases', v_total_purchases,
            'input_tax', v_total_tax,
            'wht_deducted', v_total_wht,
            'net_payable', v_net_payable
        ),
        'counts', json_build_object('total_bills', v_bill_count),
        'payment', json_build_object(
            'total_paid', v_total_paid,
            'outstanding', v_total_outstanding,
            'payment_pct', CASE WHEN v_net_payable > 0 THEN ROUND((v_total_paid / v_net_payable * 100), 2) ELSE 0 END
        )
    );

    RETURN v_result;
END;
$$;


--
-- Name: get_role_with_permissions(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_role_with_permissions(p_role_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result json;
BEGIN
    SELECT json_build_object(
        'role', row_to_json(r.*),
        'permissions', COALESCE(
            json_agg(
                json_build_object(
                    'id', p.id,
                    'permission_code', p.permission_code,
                    'module', p.module,
                    'resource', p.resource,
                    'action', p.action,
                    'description', p.description
                )
            ) FILTER (WHERE p.id IS NOT NULL),
            '[]'::json
        )
    ) INTO v_result
    FROM roles r
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    WHERE r.id = p_role_id
    GROUP BY r.id, r.role_name, r.role_code, r.description, r.is_active, r.is_system_role;

    RETURN v_result;
END;
$$;


--
-- Name: get_sales_by_customer(date, date, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_sales_by_customer(p_date_from date, p_date_to date, p_limit integer DEFAULT 20) RETURNS TABLE(customer_id uuid, customer_code text, customer_name text, total_sales numeric, total_paid numeric, outstanding numeric, transaction_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    WITH customer_sales AS (
        -- From POS
        SELECT 
            ps.customer_id,
            c.customer_code,
            c.name,
            ps.total_amount,
            ps.amount_paid as paid_amount,
            ps.amount_due as due_amount
        FROM pos_sales ps
        LEFT JOIN customers c ON c.id = ps.customer_id
        WHERE ps.sale_date::date BETWEEN p_date_from AND p_date_to
          AND ps.is_synced = true
        
        UNION ALL
        
        -- From Invoices
        SELECT 
            ci.customer_id,
            c.customer_code,
            c.name,
            ci.total_amount,
            ci.amount_paid,
            ci.amount_due
        FROM customer_invoices ci
        LEFT JOIN customers c ON c.id = ci.customer_id
        WHERE ci.invoice_date::date BETWEEN p_date_from AND p_date_to
          AND ci.status != 'cancelled'
    )
    SELECT 
        cs.customer_id,
        cs.customer_code,
        cs.name,
        SUM(cs.total_amount) as total_sales,
        SUM(cs.paid_amount) as total_paid,
        SUM(cs.due_amount) as outstanding,
        COUNT(*) as txn_count
    FROM customer_sales cs
    WHERE cs.customer_id IS NOT NULL
    GROUP BY cs.customer_id, cs.customer_code, cs.name
    ORDER BY total_sales DESC
    LIMIT p_limit;
END;
$$;


--
-- Name: get_sales_by_product(date, date, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_sales_by_product(p_date_from date, p_date_to date, p_limit integer DEFAULT 20) RETURNS TABLE(product_id uuid, product_sku text, product_name text, total_quantity numeric, total_sales numeric, transaction_count bigint, avg_price numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    WITH product_sales AS (
        -- From POS
        SELECT 
            psi.product_id,
            p.sku,
            p.name,
            psi.quantity,
            psi.line_total as sales_amount,
            psi.unit_price
        FROM pos_sale_items psi
        JOIN pos_sales ps ON ps.id = psi.sale_id
        JOIN products p ON p.id = psi.product_id
        WHERE ps.sale_date::date BETWEEN p_date_from AND p_date_to
          AND ps.is_synced = true
        
        UNION ALL
        
        -- From Invoices
        SELECT 
            cii.product_id,
            p.sku,
            p.name,
            cii.quantity,
            cii.line_total,
            cii.unit_price
        FROM customer_invoice_items cii
        JOIN customer_invoices ci ON ci.id = cii.invoice_id
        JOIN products p ON p.id = cii.product_id
        WHERE ci.invoice_date::date BETWEEN p_date_from AND p_date_to
          AND ci.status != 'cancelled'
    )
    SELECT 
        ps.product_id,
        ps.sku,
        ps.name,
        SUM(ps.quantity) as total_qty,
        SUM(ps.sales_amount) as total_sales,
        COUNT(*) as txn_count,
        ROUND(AVG(ps.unit_price), 2)::numeric as avg_price
    FROM product_sales ps
    GROUP BY ps.product_id, ps.sku, ps.name
    ORDER BY total_sales DESC
    LIMIT p_limit;
END;
$$;


--
-- Name: get_sales_register(date, date, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_sales_register(p_date_from date, p_date_to date, p_customer_id uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid) RETURNS TABLE(sale_date date, invoice_number text, customer_code text, customer_name text, location_name text, sale_type text, payment_method text, subtotal numeric, discount_amount numeric, tax_amount numeric, total_amount numeric, amount_paid numeric, amount_due numeric, payment_status text, reference_number text, created_by_email text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    -- POS Sales
    SELECT 
        ps.sale_date::date,
        ps.sale_number as invoice_number,
        c.customer_code,
        c.name as customer_name,
        l.name as location_name,
        'POS'::text as sale_type,
        ps.payment_method::text,
        ps.subtotal,
        ps.discount_amount,
        ps.tax_amount,
        ps.total_amount,
        ps.amount_paid as amount_paid,
        ps.amount_due as amount_due,
        'paid'::text as payment_status,
        ''::text as reference_number,
        ''::text as created_by_email
    FROM pos_sales ps
    LEFT JOIN customers c ON c.id = ps.customer_id
    LEFT JOIN locations l ON l.id = ps.location_id
    WHERE ps.sale_date::date BETWEEN p_date_from AND p_date_to
      AND (p_customer_id IS NULL OR ps.customer_id = p_customer_id)
      AND (p_location_id IS NULL OR ps.location_id = p_location_id)
      AND ps.is_synced = true
    
    UNION ALL
    
    -- Customer Invoices (VIEW)
    SELECT 
        ci.invoice_date::date,
        ci.invoice_number,
        c.customer_code,
        c.name as customer_name,
        ''::text as location_name,
        'Invoice'::text as sale_type,
        'credit'::text as payment_method,
        ci.subtotal,
        ci.discount_amount,
        ci.sales_tax_amount as tax_amount,
        ci.total_amount,
        ci.amount_paid,
        ci.amount_due,
        ci.payment_status::text,
        ci.reference_number,
        u.email as created_by_email
    FROM customer_invoices ci
    LEFT JOIN customers c ON c.id = ci.customer_id
    LEFT JOIN auth.users u ON u.id = ci.created_by
    WHERE ci.invoice_date::date BETWEEN p_date_from AND p_date_to
      AND (p_customer_id IS NULL OR ci.customer_id = p_customer_id)
      AND ci.status != 'cancelled'
    
    ORDER BY sale_date DESC, invoice_number DESC;
END;
$$;


--
-- Name: get_sales_register_summary(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_sales_register_summary(p_date_from date, p_date_to date) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result json;
    v_total_sales numeric;
    v_total_discount numeric;
    v_total_tax numeric;
    v_net_sales numeric;
    v_cash_sales numeric;
    v_credit_sales numeric;
    v_pos_count integer;
    v_invoice_count integer;
    v_total_paid numeric;
    v_total_outstanding numeric;
BEGIN
    WITH sales_data AS (
        -- POS Sales
        SELECT 
            total_amount,
            discount_amount,
            tax_amount,
            subtotal,
            CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END as cash_amt,
            CASE WHEN payment_method != 'cash' THEN total_amount ELSE 0 END as credit_amt,
            amount_paid as paid_amt,
            amount_due as outstanding_amt,
            1 as is_pos
        FROM pos_sales
        WHERE sale_date::date BETWEEN p_date_from AND p_date_to
          AND is_synced = true
        
        UNION ALL
        
        -- Customer Invoices
        SELECT 
            total_amount,
            discount_amount,
            sales_tax_amount as tax_amount,
            subtotal,
            0::numeric as cash_amt,
            total_amount as credit_amt,
            amount_paid as paid_amt,
            amount_due as outstanding_amt,
            0 as is_pos
        FROM customer_invoices
        WHERE invoice_date::date BETWEEN p_date_from AND p_date_to
          AND status != 'cancelled'
    )
    SELECT 
        COALESCE(SUM(total_amount), 0),
        COALESCE(SUM(discount_amount), 0),
        COALESCE(SUM(tax_amount), 0),
        COALESCE(SUM(subtotal), 0),
        COALESCE(SUM(cash_amt), 0),
        COALESCE(SUM(credit_amt), 0),
        COALESCE(SUM(CASE WHEN is_pos = 1 THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN is_pos = 0 THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(paid_amt), 0),
        COALESCE(SUM(outstanding_amt), 0)
    INTO 
        v_total_sales,
        v_total_discount,
        v_total_tax,
        v_net_sales,
        v_cash_sales,
        v_credit_sales,
        v_pos_count,
        v_invoice_count,
        v_total_paid,
        v_total_outstanding
    FROM sales_data;

    v_result := json_build_object(
        'period', json_build_object('from', p_date_from, 'to', p_date_to),
        'totals', json_build_object(
            'gross_sales', v_total_sales,
            'discount', v_total_discount,
            'tax', v_total_tax,
            'net_sales', v_net_sales,
            'cash_sales', v_cash_sales,
            'credit_sales', v_credit_sales
        ),
        'counts', json_build_object(
            'pos_transactions', v_pos_count,
            'invoices', v_invoice_count,
            'total_transactions', v_pos_count + v_invoice_count
        ),
        'collection', json_build_object(
            'total_paid', v_total_paid,
            'outstanding', v_total_outstanding,
            'collection_pct', CASE WHEN v_total_sales > 0 THEN ROUND((v_total_paid / v_total_sales * 100), 2) ELSE 0 END
        )
    );

    RETURN v_result;
END;
$$;


--
-- Name: get_stock_level(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_stock_level(p_location_id uuid, p_product_id uuid) RETURNS numeric
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_quantity numeric;
BEGIN
    SELECT quantity_on_hand INTO v_quantity FROM inventory_stock WHERE location_id = p_location_id AND product_id = p_product_id;
    RETURN COALESCE(v_quantity, 0);
END;
$$;


--
-- Name: get_user_audit_logs(uuid, text, date, date, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_audit_logs(p_user_id uuid DEFAULT NULL::uuid, p_module text DEFAULT NULL::text, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_limit integer DEFAULT 100) RETURNS TABLE(id uuid, user_email text, full_name text, action text, module text, resource text, resource_id uuid, old_values jsonb, new_values jsonb, status text, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.id,
        up.email,
        up.full_name,
        al.action,
        al.module,
        al.resource,
        al.resource_id,
        al.old_values,
        al.new_values,
        al.status,
        al.created_at
    FROM audit_logs al
    LEFT JOIN user_profiles up ON up.id = al.user_id
    WHERE (p_user_id IS NULL OR al.user_id = p_user_id)
      AND (p_module IS NULL OR al.module = p_module)
      AND (p_date_from IS NULL OR al.created_at::date >= p_date_from)
      AND (p_date_to IS NULL OR al.created_at::date <= p_date_to)
    ORDER BY al.created_at DESC
    LIMIT p_limit;
END;
$$;


--
-- Name: get_user_permissions(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_permissions(p_user_id uuid) RETURNS TABLE(permission_code text, module text, resource text, action text, role_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        p.permission_code,
        p.module,
        p.resource,
        p.action,
        r.role_name
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id
      AND r.is_active = true
    ORDER BY p.module, p.resource, p.action;
END;
$$;


--
-- Name: get_user_roles(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_roles(p_user_id uuid) RETURNS TABLE(role_id uuid, role_code text, role_name text, description text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.role_code,
        r.role_name,
        r.description
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id
      AND r.is_active = true;
END;
$$;


--
-- Name: get_vendor_aging_report(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_vendor_aging_report(p_as_of_date date) RETURNS TABLE(vendor_id uuid, vendor_name text, vendor_code text, buckets json)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.id as vendor_id,
        v.name as vendor_name,
        v.vendor_code,
        json_build_object(
            'current', COALESCE(SUM(CASE 
                WHEN p_as_of_date - vb.due_date <= 30 THEN vb.amount_due 
                ELSE 0 
            END), 0),
            'days_31_60', COALESCE(SUM(CASE 
                WHEN p_as_of_date - vb.due_date BETWEEN 31 AND 60 THEN vb.amount_due 
                ELSE 0 
            END), 0),
            'days_61_90', COALESCE(SUM(CASE 
                WHEN p_as_of_date - vb.due_date BETWEEN 61 AND 90 THEN vb.amount_due 
                ELSE 0 
            END), 0),
            'days_91_120', COALESCE(SUM(CASE 
                WHEN p_as_of_date - vb.due_date BETWEEN 91 AND 120 THEN vb.amount_due 
                ELSE 0 
            END), 0),
            'over_120', COALESCE(SUM(CASE 
                WHEN p_as_of_date - vb.due_date > 120 THEN vb.amount_due 
                ELSE 0 
            END), 0),
            'total', COALESCE(SUM(vb.amount_due), 0)
        ) as buckets
    FROM vendors v
    LEFT JOIN vendor_bills vb ON vb.vendor_id = v.id
        AND vb.amount_due > 0
        AND vb.payment_status IN ('unpaid', 'partial', 'overdue')
        AND vb.due_date <= p_as_of_date
    WHERE v.is_active = true
    GROUP BY v.id, v.name, v.vendor_code
    HAVING SUM(vb.amount_due) > 0
    ORDER BY SUM(vb.amount_due) DESC;
END;
$$;


--
-- Name: handle_adjustment_approval(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_adjustment_approval() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    adjustment_item RECORD;
    difference INTEGER;
BEGIN
    -- Only proceed if status changed to APPROVED
    IF NEW.status = 'APPROVED' AND (OLD.status IS NULL OR OLD.status != 'APPROVED') THEN
        
        -- Loop through all items in this adjustment
        FOR adjustment_item IN 
            SELECT 
                product_id,
                system_quantity,
                physical_quantity,
                unit_cost
            FROM stock_adjustment_items
            WHERE adjustment_id = NEW.id
        LOOP
            -- Calculate the difference
            difference := adjustment_item.physical_quantity - adjustment_item.system_quantity;
            
            -- Update inventory stock
            IF EXISTS (
                SELECT 1 FROM inventory_stock 
                WHERE product_id = adjustment_item.product_id 
                AND location_id = NEW.location_id
            ) THEN
                -- Update existing record
                UPDATE inventory_stock
                SET 
                    quantity_on_hand = quantity_on_hand + difference,
                    quantity_available = quantity_available + difference,
                    total_value = (quantity_on_hand + difference) * average_cost,
                    last_updated = NOW()
                WHERE 
                    product_id = adjustment_item.product_id 
                    AND location_id = NEW.location_id;
            ELSE
                -- Create new record (only if difference is positive)
                IF difference > 0 THEN
                    INSERT INTO inventory_stock (
                        product_id,
                        location_id,
                        quantity_on_hand,
                        quantity_available,
                        quantity_reserved,
                        average_cost,
                        total_value,
                        last_updated
                    ) VALUES (
                        adjustment_item.product_id,
                        NEW.location_id,
                        difference,
                        difference,
                        0,
                        adjustment_item.unit_cost,
                        difference * adjustment_item.unit_cost,
                        NOW()
                    );
                END IF;
            END IF;
            
        END LOOP;
        
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: FUNCTION handle_adjustment_approval(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.handle_adjustment_approval() IS 'Automatically updates inventory stock levels when an adjustment status changes to APPROVED. 
Adjusts stock based on the difference between physical and system quantities.';


--
-- Name: handle_transfer_completion(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_transfer_completion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    transfer_item RECORD;
BEGIN
    -- Only proceed if status changed to COMPLETED
    IF NEW.status = 'COMPLETED' AND (OLD.status IS NULL OR OLD.status != 'COMPLETED') THEN
        
        -- Loop through all items in this transfer
        FOR transfer_item IN 
            SELECT 
                product_id,
                quantity_requested,
                COALESCE(quantity_received, quantity_requested) as qty_to_transfer,
                unit_cost
            FROM stock_transfer_items
            WHERE transfer_id = NEW.id
        LOOP
            -- Update FROM location: reduce stock
            UPDATE inventory_stock
            SET 
                quantity_on_hand = quantity_on_hand - transfer_item.quantity_requested,
                quantity_available = quantity_available - transfer_item.quantity_requested,
                total_value = (quantity_on_hand - transfer_item.quantity_requested) * average_cost,
                last_updated = NOW()
            WHERE 
                product_id = transfer_item.product_id 
                AND location_id = NEW.from_location_id;
            
            -- Update TO location: increase stock
            -- First check if record exists
            IF EXISTS (
                SELECT 1 FROM inventory_stock 
                WHERE product_id = transfer_item.product_id 
                AND location_id = NEW.to_location_id
            ) THEN
                -- Update existing record
                UPDATE inventory_stock
                SET 
                    quantity_on_hand = quantity_on_hand + transfer_item.qty_to_transfer,
                    quantity_available = quantity_available + transfer_item.qty_to_transfer,
                    total_value = (quantity_on_hand + transfer_item.qty_to_transfer) * average_cost,
                    last_updated = NOW()
                WHERE 
                    product_id = transfer_item.product_id 
                    AND location_id = NEW.to_location_id;
            ELSE
                -- Create new record
                INSERT INTO inventory_stock (
                    product_id,
                    location_id,
                    quantity_on_hand,
                    quantity_available,
                    quantity_reserved,
                    average_cost,
                    total_value,
                    last_updated
                ) VALUES (
                    transfer_item.product_id,
                    NEW.to_location_id,
                    transfer_item.qty_to_transfer,
                    transfer_item.qty_to_transfer,
                    0,
                    transfer_item.unit_cost,
                    transfer_item.qty_to_transfer * transfer_item.unit_cost,
                    NOW()
                );
            END IF;
            
            -- Update the transfer item quantities
            UPDATE stock_transfer_items
            SET 
                quantity_sent = transfer_item.quantity_requested,
                quantity_received = transfer_item.qty_to_transfer
            WHERE 
                transfer_id = NEW.id 
                AND product_id = transfer_item.product_id;
                
        END LOOP;
        
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: FUNCTION handle_transfer_completion(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.handle_transfer_completion() IS 'Automatically updates inventory stock levels when a transfer status changes to COMPLETED. 
Reduces stock at FROM location and increases stock at TO location.';


--
-- Name: log_user_action(uuid, text, text, text, uuid, jsonb, jsonb, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_user_action(p_user_id uuid, p_action text, p_module text, p_resource text, p_resource_id uuid DEFAULT NULL::uuid, p_old_values jsonb DEFAULT NULL::jsonb, p_new_values jsonb DEFAULT NULL::jsonb, p_status text DEFAULT 'success'::text, p_error_message text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_log_id uuid;
BEGIN
    INSERT INTO audit_logs (
        user_id,
        action,
        module,
        resource,
        resource_id,
        old_values,
        new_values,
        status,
        error_message
    ) VALUES (
        p_user_id,
        p_action,
        p_module,
        p_resource,
        p_resource_id,
        p_old_values,
        p_new_values,
        p_status,
        p_error_message
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;


--
-- Name: post_customer_invoice(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_customer_invoice(p_invoice_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_invoice RECORD;
  v_journal_id UUID;
  v_journal_number TEXT;
  v_ar_account_id UUID;
  v_sales_account_id UUID;
  v_output_tax_account_id UUID;
  v_fiscal_year_id UUID;
BEGIN
  -- Get invoice details
  SELECT * INTO v_invoice FROM customer_invoices_accounting WHERE id = p_invoice_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer Invoice not found: %', p_invoice_id;
  END IF;
  
  -- Get account IDs
  SELECT id INTO v_ar_account_id FROM chart_of_accounts WHERE account_code = '1100';
  SELECT id INTO v_sales_account_id FROM chart_of_accounts WHERE account_code = '4010';
  SELECT id INTO v_output_tax_account_id FROM chart_of_accounts WHERE account_code = '2100';
  
  -- Get current fiscal year
  SELECT id INTO v_fiscal_year_id FROM fiscal_years WHERE is_closed = false LIMIT 1;
  
  -- Generate journal number
  v_journal_number := 'JE-INV-' || v_invoice.invoice_number;
  
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
    'CUSTOMER_INVOICE',
    p_invoice_id,
    v_invoice.invoice_number,
    'Customer Invoice - ' || v_invoice.invoice_number,
    v_invoice.total_amount,
    v_invoice.total_amount,
    'posted',
    NOW(),
    v_invoice.created_by
  ) RETURNING id INTO v_journal_id;
  
  -- Debit: Accounts Receivable
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (v_journal_id, v_ar_account_id, v_invoice.total_amount, 0, 'Accounts Receivable');
  
  -- Credit: Sales Revenue
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (v_journal_id, v_sales_account_id, 0, v_invoice.subtotal - v_invoice.discount_amount, 'Sales Revenue');
  
  -- Credit: Output Sales Tax
  IF v_invoice.tax_amount > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (v_journal_id, v_output_tax_account_id, 0, v_invoice.tax_amount, 'Output Sales Tax');
  END IF;
  
  -- Update invoice with journal entry ID
  UPDATE customer_invoices_accounting SET journal_entry_id = v_journal_id WHERE id = p_invoice_id;
  
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


--
-- Name: post_payment_voucher(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_payment_voucher(p_payment_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_payment RECORD;
  v_journal_id UUID;
  v_journal_number TEXT;
  v_ap_account_id UUID;
  v_bank_account_id UUID;
  v_cash_account_id UUID;
  v_fiscal_year_id UUID;
BEGIN
  -- Get payment details
  SELECT * INTO v_payment FROM payment_vouchers WHERE id = p_payment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment Voucher not found: %', p_payment_id;
  END IF;
  
  -- Get account IDs
  SELECT id INTO v_ap_account_id FROM chart_of_accounts WHERE account_code = '2010';
  SELECT id INTO v_cash_account_id FROM chart_of_accounts WHERE account_code = '1010';
  
  -- Get bank account GL ID if payment is via bank
  IF v_payment.bank_account_id IS NOT NULL THEN
    SELECT gl_account_id INTO v_bank_account_id 
    FROM bank_accounts WHERE id = v_payment.bank_account_id;
  END IF;
  
  -- Get current fiscal year
  SELECT id INTO v_fiscal_year_id FROM fiscal_years WHERE is_closed = false LIMIT 1;
  
  -- Generate journal number
  v_journal_number := 'JE-PAY-' || v_payment.voucher_number;
  
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
    v_payment.payment_date,
    v_fiscal_year_id,
    'PAYMENT_VOUCHER',
    p_payment_id,
    v_payment.voucher_number,
    'Payment to Vendor - ' || v_payment.voucher_number,
    v_payment.amount,
    v_payment.amount,
    'posted',
    NOW(),
    v_payment.created_by
  ) RETURNING id INTO v_journal_id;
  
  -- Debit: Accounts Payable
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (v_journal_id, v_ap_account_id, v_payment.amount, 0, 'Payment to Vendor');
  
  -- Credit: Bank or Cash
  IF v_payment.payment_method = 'CASH' THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (v_journal_id, v_cash_account_id, 0, v_payment.net_payment, 'Cash Payment');
  ELSE
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (v_journal_id, v_bank_account_id, 0, v_payment.net_payment, 'Bank Payment');
  END IF;
  
  -- Update payment with journal entry ID
  UPDATE payment_vouchers SET journal_entry_id = v_journal_id WHERE id = p_payment_id;
  
  -- Update bank balance
  IF v_payment.bank_account_id IS NOT NULL THEN
    UPDATE bank_accounts 
    SET current_balance = current_balance - v_payment.net_payment
    WHERE id = v_payment.bank_account_id;
  END IF;
  
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


--
-- Name: post_pos_sale(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_pos_sale(p_sale_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_sale RECORD;
  v_journal_id UUID;
  v_journal_number TEXT;
  v_cash_account_id UUID;
  v_ar_account_id UUID;
  v_sales_account_id UUID;
  v_output_tax_account_id UUID;
  v_cogs_account_id UUID;
  v_inventory_account_id UUID;
  v_fiscal_year_id UUID;
BEGIN
  -- Get sale details
  SELECT * INTO v_sale FROM pos_sales WHERE id = p_sale_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'POS Sale not found: %', p_sale_id;
  END IF;
  
  -- Get account IDs
  SELECT id INTO v_cash_account_id FROM chart_of_accounts WHERE account_code = '1010';
  SELECT id INTO v_ar_account_id FROM chart_of_accounts WHERE account_code = '1100';
  SELECT id INTO v_sales_account_id FROM chart_of_accounts WHERE account_code = '4010';
  SELECT id INTO v_output_tax_account_id FROM chart_of_accounts WHERE account_code = '2100';
  SELECT id INTO v_cogs_account_id FROM chart_of_accounts WHERE account_code = '5010';
  SELECT id INTO v_inventory_account_id FROM chart_of_accounts WHERE account_code = '1200';
  
  -- Get current fiscal year
  SELECT id INTO v_fiscal_year_id FROM fiscal_years WHERE is_closed = false LIMIT 1;
  
  -- Generate journal number
  v_journal_number := 'JE-POS-' || v_sale.sale_number;
  
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
    v_sale.sale_date::DATE,
    v_fiscal_year_id,
    'POS_SALE',
    p_sale_id,
    v_sale.sale_number,
    'POS Sale - ' || v_sale.sale_number,
    v_sale.total_amount,
    v_sale.total_amount,
    'posted',
    NOW(),
    v_sale.cashier_id
  ) RETURNING id INTO v_journal_id;
  
  -- Debit: Cash or AR (depending on payment method)
  IF v_sale.payment_method = 'CREDIT' THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (v_journal_id, v_ar_account_id, v_sale.total_amount, 0, 'Accounts Receivable');
  ELSE
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (v_journal_id, v_cash_account_id, v_sale.total_amount, 0, 'Cash Received');
  END IF;
  
  -- Credit: Sales Revenue (net of tax)
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (v_journal_id, v_sales_account_id, 0, v_sale.subtotal, 'Sales Revenue');
  
  -- Credit: Output Sales Tax
  IF v_sale.tax_amount > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (v_journal_id, v_output_tax_account_id, 0, v_sale.tax_amount, 'Output Sales Tax');
  END IF;
  
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


--
-- Name: post_receipt_voucher(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_receipt_voucher(p_receipt_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_receipt RECORD;
  v_journal_id UUID;
  v_journal_number TEXT;
  v_ar_account_id UUID;
  v_bank_account_id UUID;
  v_cash_account_id UUID;
  v_fiscal_year_id UUID;
BEGIN
  -- Get receipt details
  SELECT * INTO v_receipt FROM receipt_vouchers WHERE id = p_receipt_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receipt Voucher not found: %', p_receipt_id;
  END IF;
  
  -- Get account IDs
  SELECT id INTO v_ar_account_id FROM chart_of_accounts WHERE account_code = '1100';
  SELECT id INTO v_cash_account_id FROM chart_of_accounts WHERE account_code = '1010';
  
  -- Get bank account GL ID if receipt is via bank
  IF v_receipt.bank_account_id IS NOT NULL THEN
    SELECT gl_account_id INTO v_bank_account_id 
    FROM bank_accounts WHERE id = v_receipt.bank_account_id;
  END IF;
  
  -- Get current fiscal year
  SELECT id INTO v_fiscal_year_id FROM fiscal_years WHERE is_closed = false LIMIT 1;
  
  -- Generate journal number
  v_journal_number := 'JE-REC-' || v_receipt.voucher_number;
  
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
    v_receipt.receipt_date,
    v_fiscal_year_id,
    'RECEIPT_VOUCHER',
    p_receipt_id,
    v_receipt.voucher_number,
    'Receipt from Customer - ' || v_receipt.voucher_number,
    v_receipt.amount,
    v_receipt.amount,
    'posted',
    NOW(),
    v_receipt.created_by
  ) RETURNING id INTO v_journal_id;
  
  -- Debit: Bank or Cash
  IF v_receipt.payment_method = 'CASH' THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (v_journal_id, v_cash_account_id, v_receipt.amount, 0, 'Cash Received');
  ELSE
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (v_journal_id, v_bank_account_id, v_receipt.amount, 0, 'Bank Receipt');
  END IF;
  
  -- Credit: Accounts Receivable
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (v_journal_id, v_ar_account_id, 0, v_receipt.amount, 'Payment from Customer');
  
  -- Update receipt with journal entry ID
  UPDATE receipt_vouchers SET journal_entry_id = v_journal_id WHERE id = p_receipt_id;
  
  -- Update bank balance
  IF v_receipt.bank_account_id IS NOT NULL THEN
    UPDATE bank_accounts 
    SET current_balance = current_balance + v_receipt.amount
    WHERE id = v_receipt.bank_account_id;
  END IF;
  
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


--
-- Name: post_vendor_bill(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_vendor_bill(p_bill_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_bill RECORD;
  v_journal_id UUID;
  v_journal_number TEXT;
  v_purchases_account_id UUID;
  v_input_tax_account_id UUID;
  v_ap_account_id UUID;
  v_wht_account_id UUID;
  v_fiscal_year_id UUID;
BEGIN
  -- Get bill details
  SELECT * INTO v_bill FROM vendor_bills WHERE id = p_bill_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor Bill not found: %', p_bill_id;
  END IF;
  
  -- Get account IDs
  SELECT id INTO v_purchases_account_id FROM chart_of_accounts WHERE account_code = '5010';
  SELECT id INTO v_input_tax_account_id FROM chart_of_accounts WHERE account_code = '1420';
  SELECT id INTO v_ap_account_id FROM chart_of_accounts WHERE account_code = '2010';
  SELECT id INTO v_wht_account_id FROM chart_of_accounts WHERE account_code = '2110';
  
  -- Get current fiscal year
  SELECT id INTO v_fiscal_year_id FROM fiscal_years WHERE is_closed = false LIMIT 1;
  
  -- Generate journal number
  v_journal_number := 'JE-BILL-' || v_bill.bill_number;
  
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
    v_bill.bill_date,
    v_fiscal_year_id,
    'VENDOR_BILL',
    p_bill_id,
    v_bill.bill_number,
    'Vendor Bill - ' || v_bill.bill_number,
    v_bill.subtotal + v_bill.tax_amount,
    v_bill.subtotal + v_bill.tax_amount,
    'posted',
    NOW(),
    v_bill.created_by
  ) RETURNING id INTO v_journal_id;
  
  -- Debit: Purchases
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (v_journal_id, v_purchases_account_id, v_bill.subtotal, 0, 'Purchases');
  
  -- Debit: Input Sales Tax
  IF v_bill.tax_amount > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (v_journal_id, v_input_tax_account_id, v_bill.tax_amount, 0, 'Input Sales Tax');
  END IF;
  
  -- Credit: Accounts Payable (net of WHT)
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (v_journal_id, v_ap_account_id, 0, v_bill.total_amount - v_bill.wht_amount, 'Accounts Payable');
  
  -- Credit: WHT Payable
  IF v_bill.wht_amount > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (v_journal_id, v_wht_account_id, 0, v_bill.wht_amount, 'WHT Payable');
  END IF;
  
  -- Update bill with journal entry ID
  UPDATE vendor_bills SET journal_entry_id = v_journal_id WHERE id = p_bill_id;
  
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


--
-- Name: process_grn_with_inventory(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_grn_with_inventory(p_grn_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_grn_record RECORD;
    v_item RECORD;
    v_result json;
    v_inventory_results json[] := '{}';
    v_total_amount numeric := 0;
BEGIN
    SELECT g.*, po.vendor_id INTO v_grn_record
    FROM goods_receipt_notes g
    LEFT JOIN purchase_orders po ON g.po_id = po.id
    WHERE g.id = p_grn_id;

    IF NOT FOUND THEN RAISE EXCEPTION 'GRN not found: %', p_grn_id; END IF;

    FOR v_item IN 
        SELECT gi.*, p.purchase_price
        FROM grn_items gi
        JOIN products p ON gi.product_id = p.id
        WHERE gi.grn_id = p_grn_id
    LOOP
        SELECT public.adjust_inventory_stock(v_grn_record.receiving_location_id, v_item.product_id, v_item.received_quantity) INTO v_result;
        IF NOT (v_result->>'success')::boolean THEN RAISE EXCEPTION 'Inventory adjustment failed: %', v_result->>'error'; END IF;
        v_inventory_results := array_append(v_inventory_results, v_result);
        v_total_amount := v_total_amount + (v_item.received_quantity * COALESCE(v_item.unit_price, v_item.purchase_price, 0));
    END LOOP;

    IF v_grn_record.vendor_id IS NOT NULL THEN
        SELECT public.update_vendor_balance(v_grn_record.vendor_id, v_total_amount) INTO v_result;
        IF NOT (v_result->>'success')::boolean THEN RAISE EXCEPTION 'Vendor balance update failed: %', v_result->>'error'; END IF;
    END IF;

    IF v_grn_record.po_id IS NOT NULL THEN
        UPDATE purchase_orders SET status = 'RECEIVED', updated_at = NOW() WHERE id = v_grn_record.po_id;
    END IF;

    UPDATE goods_receipt_notes SET status = 'completed', updated_at = NOW() WHERE id = p_grn_id;

    RETURN json_build_object('success', true, 'grn_id', p_grn_id, 'inventory_adjustments', v_inventory_results, 'total_amount', v_total_amount, 'vendor_updated', v_grn_record.vendor_id IS NOT NULL);
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;


--
-- Name: process_sale_transaction(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_sale_transaction(p_sale_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_sale_record RECORD;
    v_item RECORD;
    v_result json;
    v_inventory_results json[] := '{}';
BEGIN
    SELECT * INTO v_sale_record FROM pos_sales WHERE id = p_sale_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found: %', p_sale_id; END IF;

    FOR v_item IN SELECT * FROM pos_sale_items WHERE sale_id = p_sale_id
    LOOP
        SELECT public.adjust_inventory_stock(v_sale_record.location_id, v_item.product_id, -v_item.quantity) INTO v_result;
        IF NOT (v_result->>'success')::boolean THEN RAISE EXCEPTION 'Inventory deduction failed: %', v_result->>'error'; END IF;
        v_inventory_results := array_append(v_inventory_results, v_result);
    END LOOP;

    RETURN json_build_object('success', true, 'sale_id', p_sale_id, 'inventory_adjustments', v_inventory_results);
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;


--
-- Name: remove_role_from_user(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_role_from_user(p_user_id uuid, p_role_id uuid, p_removed_by uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Remove role
    DELETE FROM user_roles
    WHERE user_id = p_user_id AND role_id = p_role_id;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Role assignment not found'
        );
    END IF;

    -- Log action
    INSERT INTO audit_logs (user_id, action, module, resource, old_values)
    VALUES (
        p_removed_by,
        'remove_role',
        'settings',
        'users',
        json_build_object(
            'user_id', p_user_id,
            'role_id', p_role_id
        )
    );

    RETURN json_build_object(
        'success', true,
        'message', 'Role removed successfully'
    );
END;
$$;


--
-- Name: toggle_user_location_access(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_user_location_access(p_user_id uuid, p_location_id uuid, p_assigned_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM user_allowed_locations WHERE user_id = p_user_id AND location_id = p_location_id) THEN
        DELETE FROM user_allowed_locations WHERE user_id = p_user_id AND location_id = p_location_id;
    ELSE
        INSERT INTO user_allowed_locations (user_id, location_id, assigned_by)
        VALUES (p_user_id, p_location_id, p_assigned_by);
    END IF;
END;
$$;


--
-- Name: trigger_vendor_bill_on_items(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_vendor_bill_on_items() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_bill_number TEXT;
    v_last_bill_number TEXT;
    v_next_number INTEGER;
    v_subtotal NUMERIC;
    v_tax_amount NUMERIC;
    v_total_amount NUMERIC;
    v_vendor_bill_id UUID;
    v_grn RECORD;
    v_grn_item RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM vendor_bills WHERE grn_id = NEW.grn_id) THEN
        RETURN NEW;
    END IF;

    SELECT * INTO v_grn FROM goods_receipts WHERE id = NEW.grn_id;
    IF v_grn IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT bill_number INTO v_last_bill_number
    FROM vendor_bills ORDER BY created_at DESC LIMIT 1;

    IF v_last_bill_number IS NULL THEN
        v_bill_number := 'VB-0001';
    ELSE
        v_next_number := CAST(SPLIT_PART(v_last_bill_number, '-', 2) AS INTEGER) + 1;
        v_bill_number := 'VB-' || LPAD(v_next_number::TEXT, 4, '0');
    END IF;

    -- Fix: Handle 0 as NULL/Not Set
    IF COALESCE(v_grn.subtotal, 0) > 0 THEN
        v_subtotal := v_grn.subtotal;
    ELSE
        v_subtotal := COALESCE(v_grn.total_amount, 0);
    END IF;

    v_tax_amount := v_subtotal * 0.18;
    v_total_amount := v_subtotal + v_tax_amount;

    INSERT INTO vendor_bills (
        bill_number, vendor_id, grn_id, bill_date, due_date,
        subtotal, tax_amount, total_amount,
        status, payment_status, created_by, approved_by
    ) VALUES (
        v_bill_number, v_grn.vendor_id, v_grn.id, v_grn.receipt_date,
        v_grn.receipt_date + INTERVAL '30 days',
        v_subtotal, v_tax_amount, v_total_amount,
        'approved', 'unpaid', v_grn.received_by, v_grn.received_by
    )
    RETURNING id INTO v_vendor_bill_id;

    FOR v_grn_item IN 
        SELECT product_id, quantity_received, unit_cost
        FROM goods_receipt_items WHERE grn_id = NEW.grn_id
    LOOP
        INSERT INTO vendor_bill_items (
            bill_id, product_id, quantity, unit_price, tax_percentage
        ) VALUES (
            v_vendor_bill_id, v_grn_item.product_id, v_grn_item.quantity_received,
            v_grn_item.unit_cost, 18
        );
    END LOOP;

    BEGIN
        PERFORM post_vendor_bill(v_vendor_bill_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'GL posting failed: %', SQLERRM;
    END;

    RAISE NOTICE '✅ Auto-created vendor bill % from GRN %', v_bill_number, v_grn.grn_number;
    RETURN NEW;
END;
$$;


--
-- Name: FUNCTION trigger_vendor_bill_on_items(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.trigger_vendor_bill_on_items() IS 'Ensures vendor bill is created even if GRN items are inserted after GRN header';


--
-- Name: update_account_balances(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_account_balances() RETURNS void
    LANGUAGE plpgsql
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
    ), 0);
END;
$$;


--
-- Name: update_customer_balance(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_customer_balance(p_customer_id uuid, p_amount_change numeric) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE customers
  SET current_balance = current_balance + p_amount_change,
      updated_at = NOW()
  WHERE id = p_customer_id;
END;
$$;


--
-- Name: update_customer_balance_on_invoice(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_customer_balance_on_invoice() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- On INSERT or UPDATE of invoice
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        -- Update customer balance when invoice is approved/posted/sent
        -- Added 'posted' to the list of statuses that trigger balance update
        IF NEW.status IN ('approved', 'sent', 'posted') AND (NEW.payment_status IS NULL OR NEW.payment_status != 'paid') THEN
            -- If it's an update, we should only add if status changed to one of these or amount changed
            -- For simplicity in this ERP, we check if it was already updated or handle it proportionally
            -- But for the test case (INSERT), this works perfectly.
            
            IF (TG_OP = 'INSERT') THEN
                UPDATE customers
                SET current_balance = current_balance + NEW.total_amount
                WHERE id = NEW.customer_id;
            ELSIF (TG_OP = 'UPDATE') THEN
                -- If status changed to approved/posted/sent from something else (like draft)
                IF (OLD.status NOT IN ('approved', 'sent', 'posted') AND NEW.status IN ('approved', 'sent', 'posted')) THEN
                    UPDATE customers
                    SET current_balance = current_balance + NEW.total_amount
                    WHERE id = NEW.customer_id;
                ELSIF (OLD.status IN ('approved', 'sent', 'posted') AND NEW.status IN ('approved', 'sent', 'posted')) THEN
                    -- Handle amount changes
                    UPDATE customers
                    SET current_balance = current_balance + (NEW.total_amount - OLD.total_amount)
                    WHERE id = NEW.customer_id;
                END IF;
            END IF;
        END IF;
    END IF;

    -- On payment (UPDATE)
    IF (TG_OP = 'UPDATE') THEN
        -- If payment status changed to paid
        IF OLD.payment_status != 'paid' AND NEW.payment_status = 'paid' THEN
            UPDATE customers
            SET current_balance = current_balance - NEW.total_amount
            WHERE id = NEW.customer_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: update_customer_balance_on_payment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_customer_balance_on_payment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- On INSERT or UPDATE of receipt
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        -- Update customer balance when payment is cleared
        IF NEW.status = 'cleared' THEN
            UPDATE customers
            SET current_balance = current_balance - NEW.amount
            WHERE id = NEW.customer_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_user_status(uuid, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_status(p_user_id uuid, p_is_active boolean, p_updated_by uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    UPDATE user_profiles
    SET is_active = p_is_active,
        updated_at = now()
    WHERE id = p_user_id;

    -- Log action
    INSERT INTO audit_logs (user_id, action, module, resource, new_values)
    VALUES (
        p_updated_by,
        CASE WHEN p_is_active THEN 'activate_user' ELSE 'deactivate_user' END,
        'settings',
        'users',
        json_build_object('user_id', p_user_id, 'is_active', p_is_active)
    );

    RETURN json_build_object(
        'success', true,
        'message', 'User status updated successfully'
    );
END;
$$;


--
-- Name: update_vendor_balance(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_vendor_balance(p_vendor_id uuid, p_amount_change numeric) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE vendors
  SET current_balance = current_balance + p_amount_change,
      updated_at = NOW()
  WHERE id = p_vendor_id;
END;
$$;


--
-- Name: validate_order_credit(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_order_credit(p_customer_id uuid, p_order_amount numeric) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_credit_check json;
    v_can_proceed boolean;
BEGIN
    -- Check credit availability
    v_credit_check := check_customer_credit_available(p_customer_id, p_order_amount);
    
    v_can_proceed := (v_credit_check->>'can_proceed')::boolean;

    -- Return validation result
    RETURN json_build_object(
        'valid', v_can_proceed,
        'credit_info', v_credit_check
    );
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_types (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    normal_balance text NOT NULL
);


--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    account_code text NOT NULL,
    account_name text NOT NULL,
    account_type_id uuid NOT NULL,
    parent_account_id uuid,
    description text,
    is_active boolean DEFAULT true,
    is_system boolean DEFAULT false,
    current_balance numeric(15,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    changes jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: approval_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_requests (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workflow_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    entity_number text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    current_level integer DEFAULT 1,
    requested_by uuid,
    requested_at timestamp with time zone DEFAULT now(),
    approved_by uuid,
    approved_at timestamp with time zone,
    rejected_by uuid,
    rejected_at timestamp with time zone,
    rejection_reason text,
    notes text
);


--
-- Name: approval_workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_workflows (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workflow_name text NOT NULL,
    entity_type text NOT NULL,
    approval_levels jsonb NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    module text NOT NULL,
    resource text NOT NULL,
    resource_id uuid,
    old_values jsonb,
    new_values jsonb,
    ip_address inet,
    user_agent text,
    status text DEFAULT 'success'::text,
    error_message text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: bank_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_name text NOT NULL,
    bank_name text NOT NULL,
    account_number text NOT NULL,
    iban text,
    account_type text,
    opening_balance numeric(15,2) DEFAULT 0,
    current_balance numeric(15,2) DEFAULT 0,
    gl_account_id uuid,
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT bank_accounts_account_type_check CHECK ((account_type = ANY (ARRAY['current'::text, 'savings'::text])))
);


--
-- Name: chart_of_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chart_of_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_code text NOT NULL,
    account_name text NOT NULL,
    account_type text,
    parent_account_id uuid,
    opening_balance numeric(15,2) DEFAULT 0,
    current_balance numeric(15,2) DEFAULT 0,
    is_active boolean DEFAULT true,
    is_system_account boolean DEFAULT false,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chart_of_accounts_account_type_check CHECK ((account_type = ANY (ARRAY['ASSET'::text, 'LIABILITY'::text, 'EQUITY'::text, 'REVENUE'::text, 'EXPENSE'::text, 'COGS'::text])))
);


--
-- Name: company_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name text NOT NULL,
    ntn text,
    strn text,
    address text,
    city text,
    phone text,
    email text,
    logo_url text,
    fiscal_year_start_month integer DEFAULT 7,
    current_fiscal_year_id uuid,
    base_currency text DEFAULT 'PKR'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: credit_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    credit_note_number text NOT NULL,
    customer_id uuid,
    sales_return_id uuid,
    credit_date date NOT NULL,
    total_amount numeric(15,2) NOT NULL,
    amount_used numeric(15,2) DEFAULT 0,
    status text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT credit_notes_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'issued'::text, 'used'::text, 'void'::text])))
);


--
-- Name: customer_invoice_items_accounting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_invoice_items_accounting (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid,
    product_id uuid,
    description text,
    quantity numeric(15,2) NOT NULL,
    unit_price numeric(15,2) NOT NULL,
    tax_percentage numeric(5,2) DEFAULT 0,
    discount_percentage numeric(5,2) DEFAULT 0,
    line_total numeric(15,2) GENERATED ALWAYS AS ((((quantity * unit_price) * ((1)::numeric - (discount_percentage / (100)::numeric))) * ((1)::numeric + (tax_percentage / (100)::numeric)))) STORED,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: customer_invoice_items; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.customer_invoice_items AS
 SELECT id,
    invoice_id,
    product_id,
    quantity,
    unit_price,
    (quantity * unit_price) AS subtotal,
    ((quantity * unit_price) * (tax_percentage / (100)::numeric)) AS tax_amount,
    line_total,
    created_at
   FROM public.customer_invoice_items_accounting;


--
-- Name: customer_invoices_accounting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_invoices_accounting (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_number text NOT NULL,
    customer_id uuid,
    sales_order_id uuid,
    invoice_date date NOT NULL,
    due_date date NOT NULL,
    reference_number text,
    subtotal numeric(15,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0,
    discount_amount numeric(15,2) DEFAULT 0,
    total_amount numeric(15,2) DEFAULT 0,
    amount_received numeric(15,2) DEFAULT 0,
    amount_due numeric(15,2) GENERATED ALWAYS AS ((total_amount - amount_received)) STORED,
    payment_status text DEFAULT 'unpaid'::text,
    status text DEFAULT 'draft'::text,
    journal_entry_id uuid,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT customer_invoices_accounting_payment_status_check CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'partial'::text, 'paid'::text, 'overdue'::text]))),
    CONSTRAINT customer_invoices_accounting_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'posted'::text, 'cancelled'::text])))
);


--
-- Name: customer_invoices; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.customer_invoices AS
 SELECT id,
    invoice_number,
    customer_id,
    sales_order_id,
    invoice_date,
    due_date,
    reference_number,
    subtotal,
    tax_amount AS sales_tax_amount,
    discount_amount,
    total_amount,
    amount_received AS amount_paid,
    amount_due,
    payment_status,
    status,
    journal_entry_id,
    notes,
    created_by,
    created_at,
    updated_at
   FROM public.customer_invoices_accounting;


--
-- Name: customer_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_payments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    payment_number text NOT NULL,
    customer_id uuid NOT NULL,
    payment_date date NOT NULL,
    amount numeric(15,2) NOT NULL,
    payment_method text NOT NULL,
    reference_number text,
    bank_name text,
    cheque_number text,
    cheque_date date,
    notes text,
    journal_entry_id uuid,
    received_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    invoice_id uuid
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    customer_code text NOT NULL,
    customer_type text DEFAULT 'INDIVIDUAL'::text NOT NULL,
    name text NOT NULL,
    contact_person text,
    email text,
    phone text NOT NULL,
    alternate_phone text,
    address text,
    city text,
    cnic text,
    ntn text,
    credit_limit numeric(15,2) DEFAULT 0,
    credit_days integer DEFAULT 0,
    current_balance numeric(15,2) DEFAULT 0,
    is_vip boolean DEFAULT false,
    discount_percentage numeric(5,2) DEFAULT 0,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: delivery_note_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_note_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    delivery_note_id uuid,
    sales_order_item_id uuid,
    product_id uuid,
    quantity_delivered numeric(15,2) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: delivery_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    delivery_note_number text NOT NULL,
    sales_order_id uuid,
    customer_id uuid,
    delivery_date timestamp with time zone DEFAULT now(),
    status text,
    vehicle_number text,
    tracking_number text,
    driver_name text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT delivery_notes_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'shipped'::text, 'delivered'::text, 'cancelled'::text])))
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_profile_id uuid,
    employee_code text NOT NULL,
    full_name text NOT NULL,
    cnic text NOT NULL,
    date_of_birth date,
    department_id uuid,
    designation text NOT NULL,
    joining_date date NOT NULL,
    leaving_date date,
    employment_status text DEFAULT 'ACTIVE'::text NOT NULL,
    phone text,
    email text,
    emergency_contact_name text,
    emergency_contact_phone text,
    address text,
    basic_salary numeric(15,2) NOT NULL,
    allowances jsonb DEFAULT '{}'::jsonb,
    commission_rate numeric(5,2) DEFAULT 0,
    commission_type text,
    bank_account_number text,
    bank_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE employees; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.employees IS 'Employee master with salary and commission settings';


--
-- Name: fiscal_years; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fiscal_years (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    year_name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_closed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: fuel_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fuel_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    vehicle_id uuid NOT NULL,
    log_date date NOT NULL,
    odometer_reading integer NOT NULL,
    fuel_quantity numeric(10,2) NOT NULL,
    fuel_rate numeric(10,2) NOT NULL,
    total_cost numeric(15,2) GENERATED ALWAYS AS ((fuel_quantity * fuel_rate)) STORED,
    filled_by uuid,
    station_name text,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: goods_receipt_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goods_receipt_items (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    grn_id uuid NOT NULL,
    po_item_id uuid,
    product_id uuid NOT NULL,
    quantity_received numeric(15,3) NOT NULL,
    unit_cost numeric(15,2) NOT NULL,
    batch_number text,
    expiry_date date,
    line_total numeric(15,2) GENERATED ALWAYS AS ((quantity_received * unit_cost)) STORED,
    notes text
);


--
-- Name: goods_receipt_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goods_receipt_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grn_number text NOT NULL,
    po_id uuid,
    vendor_id uuid,
    receiving_location_id uuid NOT NULL,
    receipt_date date DEFAULT CURRENT_DATE NOT NULL,
    inspector text,
    inspection_status text DEFAULT 'pending'::text,
    notes text,
    attachments jsonb,
    status text DEFAULT 'draft'::text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: goods_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goods_receipts (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    grn_number text NOT NULL,
    po_id uuid,
    vendor_id uuid NOT NULL,
    location_id uuid NOT NULL,
    receipt_date date NOT NULL,
    vendor_invoice_number text,
    vendor_invoice_date date,
    subtotal numeric(15,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0,
    total_amount numeric(15,2) DEFAULT 0,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    received_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE goods_receipts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.goods_receipts IS 'Goods Receipt Notes from suppliers';


--
-- Name: grn_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grn_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grn_id uuid NOT NULL,
    product_id uuid NOT NULL,
    po_item_id uuid,
    ordered_quantity numeric(10,2) DEFAULT 0,
    received_quantity numeric(10,2) NOT NULL,
    rejected_quantity numeric(10,2) DEFAULT 0,
    unit_price numeric(12,2),
    inspection_status text,
    inspection_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: inventory_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    location_code text NOT NULL,
    location_name text NOT NULL,
    location_type text,
    address text,
    city text,
    phone text,
    manager_name text,
    is_active boolean DEFAULT true,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: inventory_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_stock (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    product_id uuid NOT NULL,
    location_id uuid NOT NULL,
    quantity_on_hand numeric(15,3) DEFAULT 0,
    quantity_reserved numeric(15,3) DEFAULT 0,
    quantity_available numeric(15,3) DEFAULT 0 NOT NULL,
    average_cost numeric(15,2) DEFAULT 0,
    total_value numeric(15,2) DEFAULT 0 NOT NULL,
    last_stock_take_date date,
    last_updated timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE inventory_stock; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.inventory_stock IS 'Real-time stock levels by product and location';


--
-- Name: inventory_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_transactions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    transaction_type_id uuid NOT NULL,
    transaction_number text NOT NULL,
    product_id uuid NOT NULL,
    from_location_id uuid,
    to_location_id uuid,
    quantity numeric(15,3) NOT NULL,
    unit_cost numeric(15,2),
    reference_type text,
    reference_id uuid,
    reference_number text,
    batch_number text,
    serial_number text,
    expiry_date date,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: journal_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    journal_number text NOT NULL,
    journal_type text,
    journal_date date NOT NULL,
    fiscal_year_id uuid,
    reference_type text,
    reference_id uuid,
    reference_number text,
    narration text,
    total_debit numeric(15,2) DEFAULT 0,
    total_credit numeric(15,2) DEFAULT 0,
    status text DEFAULT 'draft'::text,
    posted_at timestamp with time zone,
    posted_by uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT journal_entries_journal_type_check CHECK ((journal_type = ANY (ARRAY['OPENING'::text, 'MANUAL'::text, 'AUTO'::text, 'ADJUSTMENT'::text, 'CLOSING'::text]))),
    CONSTRAINT journal_entries_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'posted'::text, 'cancelled'::text])))
);


--
-- Name: journal_entry_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entry_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    journal_entry_id uuid,
    account_id uuid,
    debit_amount numeric(15,2) DEFAULT 0,
    credit_amount numeric(15,2) DEFAULT 0,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: journals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journals (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    journal_code text NOT NULL,
    journal_name text NOT NULL,
    description text
);


--
-- Name: location_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.location_types (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    description text
);


--
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    type_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    address text,
    contact_person text,
    contact_phone text,
    is_active boolean DEFAULT true,
    vehicle_number text,
    assigned_salesperson_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: maintenance_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    vehicle_id uuid NOT NULL,
    maintenance_date date NOT NULL,
    odometer_reading integer,
    maintenance_type text NOT NULL,
    description text NOT NULL,
    service_provider text,
    cost numeric(15,2) DEFAULT 0,
    next_service_date date,
    next_service_odometer integer,
    performed_by text,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: payment_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_voucher_id uuid,
    vendor_bill_id uuid,
    allocated_amount numeric(15,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: payment_vouchers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_vouchers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    voucher_number text NOT NULL,
    vendor_id uuid,
    payment_date date NOT NULL,
    payment_method text,
    bank_account_id uuid,
    cheque_number text,
    amount numeric(15,2) NOT NULL,
    wht_amount numeric(15,2) DEFAULT 0,
    net_payment numeric(15,2) GENERATED ALWAYS AS ((amount - wht_amount)) STORED,
    status text DEFAULT 'draft'::text,
    journal_entry_id uuid,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payment_vouchers_payment_method_check CHECK ((payment_method = ANY (ARRAY['CASH'::text, 'CHEQUE'::text, 'BANK_TRANSFER'::text]))),
    CONSTRAINT payment_vouchers_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'posted'::text, 'cancelled'::text])))
);


--
-- Name: payroll_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_periods (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    period_name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    payment_date date NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: payslips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payslips (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    payslip_number text NOT NULL,
    employee_id uuid NOT NULL,
    payroll_period_id uuid NOT NULL,
    basic_salary numeric(15,2) NOT NULL,
    allowances numeric(15,2) DEFAULT 0,
    commission numeric(15,2) DEFAULT 0,
    overtime numeric(15,2) DEFAULT 0,
    bonus numeric(15,2) DEFAULT 0,
    gross_salary numeric(15,2) NOT NULL,
    income_tax numeric(15,2) DEFAULT 0,
    eobi numeric(15,2) DEFAULT 0,
    advance numeric(15,2) DEFAULT 0,
    loan_deduction numeric(15,2) DEFAULT 0,
    other_deductions numeric(15,2) DEFAULT 0,
    total_deductions numeric(15,2) NOT NULL,
    net_salary numeric(15,2) NOT NULL,
    working_days integer NOT NULL,
    days_present integer NOT NULL,
    days_absent integer DEFAULT 0,
    leaves_taken integer DEFAULT 0,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module text NOT NULL,
    resource text NOT NULL,
    action text NOT NULL,
    permission_code text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: pos_sale_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_sale_items (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    sale_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity numeric(15,3) NOT NULL,
    unit_price numeric(15,2) NOT NULL,
    discount_percentage numeric(5,2) DEFAULT 0,
    line_total numeric(15,2) GENERATED ALWAYS AS (((quantity * unit_price) * ((1)::numeric - (discount_percentage / (100)::numeric)))) STORED
);


--
-- Name: pos_sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_sales (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    sale_number text NOT NULL,
    location_id uuid NOT NULL,
    customer_id uuid,
    sale_date timestamp with time zone DEFAULT now() NOT NULL,
    subtotal numeric(15,2) NOT NULL,
    discount_amount numeric(15,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0,
    total_amount numeric(15,2) NOT NULL,
    payment_method text NOT NULL,
    amount_paid numeric(15,2) NOT NULL,
    amount_due numeric(15,2) GENERATED ALWAYS AS ((total_amount - amount_paid)) STORED,
    is_synced boolean DEFAULT true,
    device_id text,
    cashier_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE pos_sales; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.pos_sales IS 'Point of Sale transactions from stores and vehicles';


--
-- Name: product_barcodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_barcodes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    product_id uuid NOT NULL,
    barcode text NOT NULL,
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: product_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_categories (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    parent_id uuid,
    costing_method text DEFAULT 'AVCO'::text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: product_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_suppliers (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    product_id uuid NOT NULL,
    vendor_id uuid NOT NULL,
    supplier_sku text,
    lead_time_days integer,
    min_order_quantity integer,
    last_purchase_price numeric(15,2),
    is_preferred boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    sku text NOT NULL,
    barcode text,
    name text NOT NULL,
    description text,
    category_id uuid NOT NULL,
    uom_id uuid NOT NULL,
    cost_price numeric(15,2),
    selling_price numeric(15,2),
    wholesale_price numeric(15,2),
    reorder_point integer DEFAULT 0,
    reorder_quantity integer DEFAULT 0,
    min_stock_level integer DEFAULT 0,
    max_stock_level integer,
    is_active boolean DEFAULT true,
    is_serialized boolean DEFAULT false,
    is_batchable boolean DEFAULT false,
    notes text,
    image_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE products; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.products IS 'Master product catalog with ~800 SKUs';


--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_items (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    po_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity numeric(15,3) NOT NULL,
    unit_price numeric(15,2) NOT NULL,
    discount_percentage numeric(5,2) DEFAULT 0,
    tax_percentage numeric(5,2) DEFAULT 0,
    line_total numeric(15,2) GENERATED ALWAYS AS ((((quantity * unit_price) * ((1)::numeric - (discount_percentage / (100)::numeric))) * ((1)::numeric + (tax_percentage / (100)::numeric)))) STORED,
    quantity_received numeric(15,3) DEFAULT 0,
    notes text
);


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    po_number text NOT NULL,
    vendor_id uuid NOT NULL,
    location_id uuid NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    po_date date NOT NULL,
    expected_delivery_date date,
    requested_by uuid,
    approved_by uuid,
    subtotal numeric(15,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0,
    discount_amount numeric(15,2) DEFAULT 0,
    total_amount numeric(15,2) DEFAULT 0,
    notes text,
    terms_and_conditions text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: receipt_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receipt_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    receipt_voucher_id uuid,
    customer_invoice_id uuid,
    allocated_amount numeric(15,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: receipt_vouchers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receipt_vouchers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    voucher_number text NOT NULL,
    customer_id uuid,
    receipt_date date NOT NULL,
    payment_method text,
    bank_account_id uuid,
    cheque_number text,
    amount numeric(15,2) NOT NULL,
    status text DEFAULT 'draft'::text,
    journal_entry_id uuid,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT receipt_vouchers_payment_method_check CHECK ((payment_method = ANY (ARRAY['CASH'::text, 'CHEQUE'::text, 'BANK_TRANSFER'::text]))),
    CONSTRAINT receipt_vouchers_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'posted'::text, 'cancelled'::text])))
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_name text NOT NULL,
    role_code text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    is_system_role boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: sales_commissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_commissions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    sale_id uuid,
    sale_date date NOT NULL,
    sale_amount numeric(15,2) NOT NULL,
    commission_rate numeric(5,2) NOT NULL,
    commission_amount numeric(15,2) NOT NULL,
    payslip_id uuid,
    is_paid boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE sales_commissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sales_commissions IS 'Commission tracking for salespeople';


--
-- Name: sales_invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_invoice_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid,
    sales_order_item_id uuid,
    product_id uuid,
    quantity numeric(15,2) NOT NULL,
    unit_price numeric(15,2) NOT NULL,
    discount_percentage numeric(5,2) DEFAULT 0,
    tax_percentage numeric(5,2) DEFAULT 0,
    line_total numeric(15,2) GENERATED ALWAYS AS ((((quantity * unit_price) * ((1)::numeric - (discount_percentage / (100)::numeric))) * ((1)::numeric + (tax_percentage / (100)::numeric)))) STORED,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: sales_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_number text NOT NULL,
    customer_id uuid,
    sales_order_id uuid,
    invoice_date date NOT NULL,
    due_date date NOT NULL,
    status text,
    subtotal numeric(15,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0,
    discount_amount numeric(15,2) DEFAULT 0,
    shipping_charges numeric(15,2) DEFAULT 0,
    total_amount numeric(15,2) DEFAULT 0,
    amount_paid numeric(15,2) DEFAULT 0,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sales_invoices_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'posted'::text, 'paid'::text, 'void'::text, 'overdue'::text])))
);


--
-- Name: sales_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_order_items (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity numeric(15,3) NOT NULL,
    unit_price numeric(15,2) NOT NULL,
    discount_percentage numeric(5,2) DEFAULT 0,
    line_total numeric(15,2) GENERATED ALWAYS AS (((quantity * unit_price) * ((1)::numeric - (discount_percentage / (100)::numeric)))) STORED
);


--
-- Name: sales_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_orders (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    order_number text NOT NULL,
    customer_id uuid,
    location_id uuid,
    order_type text DEFAULT 'RETAIL'::text,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    order_date date NOT NULL,
    delivery_date date,
    subtotal numeric(15,2) DEFAULT 0,
    discount_amount numeric(15,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0,
    total_amount numeric(15,2) DEFAULT 0,
    payment_method text,
    payment_status text DEFAULT 'UNPAID'::text,
    salesperson_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    quotation_id uuid,
    schema_version integer DEFAULT 1,
    expected_delivery_date date,
    shipping_charges numeric(15,2) DEFAULT 0,
    term_and_conditions text,
    delivery_address text,
    warehouse_id uuid,
    amount_paid numeric(15,2) DEFAULT 0,
    CONSTRAINT sales_orders_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'confirmed'::text, 'processing'::text, 'shipped'::text, 'delivered'::text, 'cancelled'::text, 'completed'::text])))
);


--
-- Name: sales_orders_order_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_orders_order_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_quotation_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_quotation_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_id uuid,
    product_id uuid,
    description text,
    quantity numeric(15,2) NOT NULL,
    unit_price numeric(15,2) NOT NULL,
    discount_percentage numeric(5,2) DEFAULT 0,
    tax_percentage numeric(5,2) DEFAULT 0,
    line_total numeric(15,2) GENERATED ALWAYS AS ((((quantity * unit_price) * ((1)::numeric - (discount_percentage / (100)::numeric))) * ((1)::numeric + (tax_percentage / (100)::numeric)))) STORED,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: sales_quotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_quotations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_number text NOT NULL,
    customer_id uuid,
    quotation_date date NOT NULL,
    valid_until date NOT NULL,
    reference_number text,
    status text,
    subtotal numeric(15,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0,
    discount_amount numeric(15,2) DEFAULT 0,
    shipping_charges numeric(15,2) DEFAULT 0,
    total_amount numeric(15,2) DEFAULT 0,
    term_and_conditions text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sales_quotations_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'approved'::text, 'rejected'::text, 'converted'::text, 'expired'::text])))
);


--
-- Name: sales_return_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_return_items (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    return_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity numeric(15,3) NOT NULL,
    unit_price numeric(15,2) NOT NULL,
    line_total numeric(15,2) GENERATED ALWAYS AS ((quantity * unit_price)) STORED
);


--
-- Name: sales_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_returns (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    return_number text,
    original_sale_id uuid,
    location_id uuid,
    customer_id uuid,
    return_date date,
    reason text,
    total_amount numeric(15,2),
    refund_method text,
    approved_by uuid,
    processed_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    sales_invoice_id uuid,
    status text,
    refund_amount numeric(15,2) DEFAULT 0,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sales_returns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'completed'::text, 'refunded'::text])))
);


--
-- Name: schema_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_version (
    version integer NOT NULL,
    applied_at timestamp with time zone DEFAULT now(),
    description text
);


--
-- Name: stock_adjustment_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_adjustment_items (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    adjustment_id uuid NOT NULL,
    product_id uuid NOT NULL,
    system_quantity numeric(15,3) NOT NULL,
    physical_quantity numeric(15,3) NOT NULL,
    difference numeric(15,3) GENERATED ALWAYS AS ((physical_quantity - system_quantity)) STORED,
    unit_cost numeric(15,2),
    value_difference numeric(15,2) GENERATED ALWAYS AS (((physical_quantity - system_quantity) * unit_cost)) STORED,
    notes text
);


--
-- Name: stock_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_adjustments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    adjustment_number text NOT NULL,
    location_id uuid NOT NULL,
    adjustment_type text NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    adjustment_date date NOT NULL,
    reason text NOT NULL,
    approved_by uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: stock_transfer_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_transfer_items (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    transfer_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity_requested numeric(15,3) NOT NULL,
    quantity_sent numeric(15,3),
    quantity_received numeric(15,3),
    unit_cost numeric(15,2),
    notes text
);


--
-- Name: stock_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_transfers (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    transfer_number text NOT NULL,
    from_location_id uuid NOT NULL,
    to_location_id uuid NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    requested_by uuid,
    approved_by uuid,
    received_by uuid,
    transfer_date date NOT NULL,
    expected_delivery_date date,
    actual_delivery_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE stock_transfers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.stock_transfers IS 'Internal stock transfers between locations';


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tax_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tax_name text NOT NULL,
    tax_code text NOT NULL,
    tax_type text,
    rate_percentage numeric(5,2) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tax_rates_tax_type_check CHECK ((tax_type = ANY (ARRAY['SALES_TAX'::text, 'WHT'::text, 'INCOME_TAX'::text])))
);


--
-- Name: transaction_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transaction_types (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    affects_inventory boolean DEFAULT true,
    direction text NOT NULL,
    description text
);


--
-- Name: units_of_measure; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.units_of_measure (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text
);


--
-- Name: user_allowed_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_allowed_locations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    location_id uuid,
    assigned_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid NOT NULL,
    full_name text NOT NULL,
    employee_code text,
    email text NOT NULL,
    phone text,
    is_active boolean DEFAULT true,
    last_login timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_by uuid,
    assigned_at timestamp with time zone DEFAULT now()
);


--
-- Name: vehicle_expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_expenses (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    vehicle_id uuid NOT NULL,
    expense_date date NOT NULL,
    expense_type text NOT NULL,
    description text,
    amount numeric(15,2) NOT NULL,
    paid_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicles (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    location_id uuid,
    vehicle_number text NOT NULL,
    make text,
    model text,
    year integer,
    registration_number text,
    chassis_number text,
    engine_number text,
    purchase_date date,
    purchase_price numeric(15,2),
    assigned_driver_id uuid,
    assigned_salesperson_id uuid,
    insurance_company text,
    insurance_policy_number text,
    insurance_expiry_date date,
    fitness_expiry_date date,
    registration_expiry_date date,
    status text DEFAULT 'ACTIVE'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE vehicles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.vehicles IS 'Fleet management - 4 vehicles tracked';


--
-- Name: vendor_bill_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_bill_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bill_id uuid,
    product_id uuid,
    description text,
    quantity numeric(15,2) NOT NULL,
    unit_price numeric(15,2) NOT NULL,
    tax_percentage numeric(5,2) DEFAULT 0,
    line_total numeric(15,2) GENERATED ALWAYS AS (((quantity * unit_price) * ((1)::numeric + (tax_percentage / (100)::numeric)))) STORED,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: vendor_bills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_bills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bill_number text NOT NULL,
    vendor_id uuid,
    grn_id uuid,
    bill_date date NOT NULL,
    due_date date NOT NULL,
    reference_number text,
    subtotal numeric(15,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0,
    wht_amount numeric(15,2) DEFAULT 0,
    total_amount numeric(15,2) DEFAULT 0,
    amount_paid numeric(15,2) DEFAULT 0,
    amount_due numeric(15,2) GENERATED ALWAYS AS ((total_amount - amount_paid)) STORED,
    payment_status text DEFAULT 'unpaid'::text,
    status text DEFAULT 'draft'::text,
    journal_entry_id uuid,
    notes text,
    created_by uuid,
    approved_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT vendor_bills_payment_status_check CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'partial'::text, 'paid'::text, 'overdue'::text]))),
    CONSTRAINT vendor_bills_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'posted'::text, 'cancelled'::text])))
);


--
-- Name: vendor_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_payments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    payment_number text NOT NULL,
    vendor_id uuid NOT NULL,
    payment_date date NOT NULL,
    amount numeric(15,2) NOT NULL,
    payment_method text NOT NULL,
    reference_number text,
    bank_name text,
    cheque_number text,
    cheque_date date,
    notes text,
    journal_entry_id uuid,
    paid_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendors (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    vendor_code text NOT NULL,
    name text NOT NULL,
    contact_person text,
    email text,
    phone text NOT NULL,
    alternate_phone text,
    address text,
    city text,
    ntn text,
    payment_terms_days integer DEFAULT 30,
    current_balance numeric(15,2) DEFAULT 0,
    vendor_category text,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: account_types account_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_types
    ADD CONSTRAINT account_types_code_key UNIQUE (code);


--
-- Name: account_types account_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_types
    ADD CONSTRAINT account_types_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_account_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_account_code_key UNIQUE (account_code);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: approval_requests approval_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_pkey PRIMARY KEY (id);


--
-- Name: approval_workflows approval_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_pkey PRIMARY KEY (id);


--
-- Name: approval_workflows approval_workflows_workflow_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_workflow_name_key UNIQUE (workflow_name);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: bank_accounts bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: chart_of_accounts chart_of_accounts_account_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_account_code_key UNIQUE (account_code);


--
-- Name: chart_of_accounts chart_of_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_pkey PRIMARY KEY (id);


--
-- Name: company_settings company_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_settings
    ADD CONSTRAINT company_settings_pkey PRIMARY KEY (id);


--
-- Name: credit_notes credit_notes_credit_note_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_credit_note_number_key UNIQUE (credit_note_number);


--
-- Name: credit_notes credit_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_pkey PRIMARY KEY (id);


--
-- Name: customer_invoice_items_accounting customer_invoice_items_accounting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_invoice_items_accounting
    ADD CONSTRAINT customer_invoice_items_accounting_pkey PRIMARY KEY (id);


--
-- Name: customer_invoices_accounting customer_invoices_accounting_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_invoices_accounting
    ADD CONSTRAINT customer_invoices_accounting_invoice_number_key UNIQUE (invoice_number);


--
-- Name: customer_invoices_accounting customer_invoices_accounting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_invoices_accounting
    ADD CONSTRAINT customer_invoices_accounting_pkey PRIMARY KEY (id);


--
-- Name: customer_payments customer_payments_payment_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payments
    ADD CONSTRAINT customer_payments_payment_number_key UNIQUE (payment_number);


--
-- Name: customer_payments customer_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payments
    ADD CONSTRAINT customer_payments_pkey PRIMARY KEY (id);


--
-- Name: customers customers_customer_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_customer_code_key UNIQUE (customer_code);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: delivery_note_items delivery_note_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_note_items
    ADD CONSTRAINT delivery_note_items_pkey PRIMARY KEY (id);


--
-- Name: delivery_notes delivery_notes_delivery_note_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_notes
    ADD CONSTRAINT delivery_notes_delivery_note_number_key UNIQUE (delivery_note_number);


--
-- Name: delivery_notes delivery_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_notes
    ADD CONSTRAINT delivery_notes_pkey PRIMARY KEY (id);


--
-- Name: departments departments_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: employees employees_cnic_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_cnic_key UNIQUE (cnic);


--
-- Name: employees employees_employee_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_employee_code_key UNIQUE (employee_code);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: fiscal_years fiscal_years_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_years
    ADD CONSTRAINT fiscal_years_pkey PRIMARY KEY (id);


--
-- Name: fiscal_years fiscal_years_year_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_years
    ADD CONSTRAINT fiscal_years_year_name_key UNIQUE (year_name);


--
-- Name: fuel_logs fuel_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_logs
    ADD CONSTRAINT fuel_logs_pkey PRIMARY KEY (id);


--
-- Name: goods_receipt_items goods_receipt_items_grn_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_grn_id_product_id_key UNIQUE (grn_id, product_id);


--
-- Name: goods_receipt_items goods_receipt_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_pkey PRIMARY KEY (id);


--
-- Name: goods_receipt_notes goods_receipt_notes_grn_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT goods_receipt_notes_grn_number_key UNIQUE (grn_number);


--
-- Name: goods_receipt_notes goods_receipt_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT goods_receipt_notes_pkey PRIMARY KEY (id);


--
-- Name: goods_receipts goods_receipts_grn_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_grn_number_key UNIQUE (grn_number);


--
-- Name: goods_receipts goods_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_pkey PRIMARY KEY (id);


--
-- Name: grn_items grn_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn_items
    ADD CONSTRAINT grn_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_locations inventory_locations_location_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_locations
    ADD CONSTRAINT inventory_locations_location_code_key UNIQUE (location_code);


--
-- Name: inventory_locations inventory_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_locations
    ADD CONSTRAINT inventory_locations_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock inventory_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock
    ADD CONSTRAINT inventory_stock_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock inventory_stock_product_id_location_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock
    ADD CONSTRAINT inventory_stock_product_id_location_id_key UNIQUE (product_id, location_id);


--
-- Name: inventory_transactions inventory_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id);


--
-- Name: inventory_transactions inventory_transactions_transaction_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_transaction_number_key UNIQUE (transaction_number);


--
-- Name: journal_entries journal_entries_journal_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_journal_number_key UNIQUE (journal_number);


--
-- Name: journal_entries journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);


--
-- Name: journal_entry_lines journal_entry_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_pkey PRIMARY KEY (id);


--
-- Name: journals journals_journal_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journals
    ADD CONSTRAINT journals_journal_code_key UNIQUE (journal_code);


--
-- Name: journals journals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journals
    ADD CONSTRAINT journals_pkey PRIMARY KEY (id);


--
-- Name: location_types location_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_types
    ADD CONSTRAINT location_types_name_key UNIQUE (name);


--
-- Name: location_types location_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_types
    ADD CONSTRAINT location_types_pkey PRIMARY KEY (id);


--
-- Name: locations locations_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_code_key UNIQUE (code);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: maintenance_logs maintenance_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_logs
    ADD CONSTRAINT maintenance_logs_pkey PRIMARY KEY (id);


--
-- Name: payment_allocations payment_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_allocations
    ADD CONSTRAINT payment_allocations_pkey PRIMARY KEY (id);


--
-- Name: payment_vouchers payment_vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_vouchers
    ADD CONSTRAINT payment_vouchers_pkey PRIMARY KEY (id);


--
-- Name: payment_vouchers payment_vouchers_voucher_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_vouchers
    ADD CONSTRAINT payment_vouchers_voucher_number_key UNIQUE (voucher_number);


--
-- Name: payroll_periods payroll_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_periods
    ADD CONSTRAINT payroll_periods_pkey PRIMARY KEY (id);


--
-- Name: payroll_periods payroll_periods_start_date_end_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_periods
    ADD CONSTRAINT payroll_periods_start_date_end_date_key UNIQUE (start_date, end_date);


--
-- Name: payslips payslips_payslip_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_payslip_number_key UNIQUE (payslip_number);


--
-- Name: payslips payslips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_permission_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_permission_code_key UNIQUE (permission_code);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: pos_sale_items pos_sale_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_sale_items
    ADD CONSTRAINT pos_sale_items_pkey PRIMARY KEY (id);


--
-- Name: pos_sales pos_sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_sales
    ADD CONSTRAINT pos_sales_pkey PRIMARY KEY (id);


--
-- Name: pos_sales pos_sales_sale_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_sales
    ADD CONSTRAINT pos_sales_sale_number_key UNIQUE (sale_number);


--
-- Name: product_barcodes product_barcodes_barcode_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_barcodes
    ADD CONSTRAINT product_barcodes_barcode_key UNIQUE (barcode);


--
-- Name: product_barcodes product_barcodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_barcodes
    ADD CONSTRAINT product_barcodes_pkey PRIMARY KEY (id);


--
-- Name: product_categories product_categories_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_code_key UNIQUE (code);


--
-- Name: product_categories product_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_pkey PRIMARY KEY (id);


--
-- Name: product_suppliers product_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suppliers
    ADD CONSTRAINT product_suppliers_pkey PRIMARY KEY (id);


--
-- Name: products products_barcode_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_barcode_key UNIQUE (barcode);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_sku_key UNIQUE (sku);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_items purchase_order_items_po_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_po_id_product_id_key UNIQUE (po_id, product_id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_po_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_po_number_key UNIQUE (po_number);


--
-- Name: receipt_allocations receipt_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_allocations
    ADD CONSTRAINT receipt_allocations_pkey PRIMARY KEY (id);


--
-- Name: receipt_vouchers receipt_vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_vouchers
    ADD CONSTRAINT receipt_vouchers_pkey PRIMARY KEY (id);


--
-- Name: receipt_vouchers receipt_vouchers_voucher_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_vouchers
    ADD CONSTRAINT receipt_vouchers_voucher_number_key UNIQUE (voucher_number);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: roles roles_role_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_role_code_key UNIQUE (role_code);


--
-- Name: roles roles_role_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_role_name_key UNIQUE (role_name);


--
-- Name: sales_commissions sales_commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_commissions
    ADD CONSTRAINT sales_commissions_pkey PRIMARY KEY (id);


--
-- Name: sales_invoice_items sales_invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_pkey PRIMARY KEY (id);


--
-- Name: sales_invoices sales_invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: sales_invoices sales_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_pkey PRIMARY KEY (id);


--
-- Name: sales_order_items sales_order_items_order_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_order_id_product_id_key UNIQUE (order_id, product_id);


--
-- Name: sales_order_items sales_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_pkey PRIMARY KEY (id);


--
-- Name: sales_orders sales_orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_order_number_key UNIQUE (order_number);


--
-- Name: sales_orders sales_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_pkey PRIMARY KEY (id);


--
-- Name: sales_quotation_items sales_quotation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotation_items
    ADD CONSTRAINT sales_quotation_items_pkey PRIMARY KEY (id);


--
-- Name: sales_quotations sales_quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotations
    ADD CONSTRAINT sales_quotations_pkey PRIMARY KEY (id);


--
-- Name: sales_quotations sales_quotations_quotation_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotations
    ADD CONSTRAINT sales_quotations_quotation_number_key UNIQUE (quotation_number);


--
-- Name: sales_return_items sales_return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_items
    ADD CONSTRAINT sales_return_items_pkey PRIMARY KEY (id);


--
-- Name: sales_returns sales_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT sales_returns_pkey PRIMARY KEY (id);


--
-- Name: sales_returns sales_returns_return_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT sales_returns_return_number_key UNIQUE (return_number);


--
-- Name: schema_version schema_version_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_version
    ADD CONSTRAINT schema_version_pkey PRIMARY KEY (version);


--
-- Name: stock_adjustment_items stock_adjustment_items_adjustment_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustment_items
    ADD CONSTRAINT stock_adjustment_items_adjustment_id_product_id_key UNIQUE (adjustment_id, product_id);


--
-- Name: stock_adjustment_items stock_adjustment_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustment_items
    ADD CONSTRAINT stock_adjustment_items_pkey PRIMARY KEY (id);


--
-- Name: stock_adjustments stock_adjustments_adjustment_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_adjustment_number_key UNIQUE (adjustment_number);


--
-- Name: stock_adjustments stock_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_pkey PRIMARY KEY (id);


--
-- Name: stock_transfer_items stock_transfer_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer_items
    ADD CONSTRAINT stock_transfer_items_pkey PRIMARY KEY (id);


--
-- Name: stock_transfer_items stock_transfer_items_transfer_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer_items
    ADD CONSTRAINT stock_transfer_items_transfer_id_product_id_key UNIQUE (transfer_id, product_id);


--
-- Name: stock_transfers stock_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_pkey PRIMARY KEY (id);


--
-- Name: stock_transfers stock_transfers_transfer_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_transfer_number_key UNIQUE (transfer_number);


--
-- Name: system_settings system_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_key_key UNIQUE (key);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: tax_rates tax_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_rates
    ADD CONSTRAINT tax_rates_pkey PRIMARY KEY (id);


--
-- Name: tax_rates tax_rates_tax_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_rates
    ADD CONSTRAINT tax_rates_tax_code_key UNIQUE (tax_code);


--
-- Name: transaction_types transaction_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_types
    ADD CONSTRAINT transaction_types_code_key UNIQUE (code);


--
-- Name: transaction_types transaction_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_types
    ADD CONSTRAINT transaction_types_pkey PRIMARY KEY (id);


--
-- Name: permissions unique_permission; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT unique_permission UNIQUE (module, resource, action);


--
-- Name: role_permissions unique_role_permission; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT unique_role_permission UNIQUE (role_id, permission_id);


--
-- Name: user_roles unique_user_role; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT unique_user_role UNIQUE (user_id, role_id);


--
-- Name: units_of_measure units_of_measure_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units_of_measure
    ADD CONSTRAINT units_of_measure_code_key UNIQUE (code);


--
-- Name: units_of_measure units_of_measure_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units_of_measure
    ADD CONSTRAINT units_of_measure_pkey PRIMARY KEY (id);


--
-- Name: user_allowed_locations user_allowed_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_allowed_locations
    ADD CONSTRAINT user_allowed_locations_pkey PRIMARY KEY (id);


--
-- Name: user_allowed_locations user_allowed_locations_user_id_location_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_allowed_locations
    ADD CONSTRAINT user_allowed_locations_user_id_location_id_key UNIQUE (user_id, location_id);


--
-- Name: user_profiles user_profiles_employee_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_employee_code_key UNIQUE (employee_code);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: vehicle_expenses vehicle_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_expenses
    ADD CONSTRAINT vehicle_expenses_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_location_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_location_id_key UNIQUE (location_id);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_registration_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_registration_number_key UNIQUE (registration_number);


--
-- Name: vehicles vehicles_vehicle_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_vehicle_number_key UNIQUE (vehicle_number);


--
-- Name: vendor_bill_items vendor_bill_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_bill_items
    ADD CONSTRAINT vendor_bill_items_pkey PRIMARY KEY (id);


--
-- Name: vendor_bills vendor_bills_bill_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_bills
    ADD CONSTRAINT vendor_bills_bill_number_key UNIQUE (bill_number);


--
-- Name: vendor_bills vendor_bills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_bills
    ADD CONSTRAINT vendor_bills_pkey PRIMARY KEY (id);


--
-- Name: vendor_payments vendor_payments_payment_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_payments
    ADD CONSTRAINT vendor_payments_payment_number_key UNIQUE (payment_number);


--
-- Name: vendor_payments vendor_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_payments
    ADD CONSTRAINT vendor_payments_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_vendor_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_vendor_code_key UNIQUE (vendor_code);


--
-- Name: idx_activity_logs_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_date ON public.activity_logs USING btree (created_at);


--
-- Name: idx_activity_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_entity ON public.activity_logs USING btree (entity_type, entity_id);


--
-- Name: idx_activity_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_user ON public.activity_logs USING btree (user_id);


--
-- Name: idx_audit_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_logs_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_module ON public.audit_logs USING btree (module);


--
-- Name: idx_audit_logs_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_resource ON public.audit_logs USING btree (resource, resource_id);


--
-- Name: idx_audit_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id);


--
-- Name: idx_coa_account_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coa_account_code ON public.chart_of_accounts USING btree (account_code);


--
-- Name: idx_coa_account_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coa_account_type ON public.chart_of_accounts USING btree (account_type);


--
-- Name: idx_customers_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_active ON public.customers USING btree (is_active);


--
-- Name: idx_customers_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_code ON public.customers USING btree (customer_code);


--
-- Name: idx_fuel_logs_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fuel_logs_date ON public.fuel_logs USING btree (log_date);


--
-- Name: idx_fuel_logs_vehicle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fuel_logs_vehicle ON public.fuel_logs USING btree (vehicle_id);


--
-- Name: idx_goods_receipts_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_goods_receipts_date ON public.goods_receipts USING btree (receipt_date);


--
-- Name: idx_goods_receipts_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_goods_receipts_vendor ON public.goods_receipts USING btree (vendor_id);


--
-- Name: idx_grn_items_grn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grn_items_grn ON public.grn_items USING btree (grn_id);


--
-- Name: idx_grn_items_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grn_items_product ON public.grn_items USING btree (product_id);


--
-- Name: idx_grn_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grn_location ON public.goods_receipt_notes USING btree (receiving_location_id);


--
-- Name: idx_grn_po; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grn_po ON public.goods_receipt_notes USING btree (po_id);


--
-- Name: idx_grn_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grn_status ON public.goods_receipt_notes USING btree (status);


--
-- Name: idx_grn_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grn_vendor ON public.goods_receipt_notes USING btree (vendor_id);


--
-- Name: idx_inventory_locations_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_locations_active ON public.inventory_locations USING btree (is_active);


--
-- Name: idx_inventory_locations_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_locations_code ON public.inventory_locations USING btree (location_code);


--
-- Name: idx_inventory_stock_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_stock_location ON public.inventory_stock USING btree (location_id);


--
-- Name: idx_inventory_stock_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_stock_product ON public.inventory_stock USING btree (product_id);


--
-- Name: idx_inventory_transactions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_date ON public.inventory_transactions USING btree (created_at);


--
-- Name: idx_inventory_transactions_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_product ON public.inventory_transactions USING btree (product_id);


--
-- Name: idx_je_journal_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_je_journal_date ON public.journal_entries USING btree (journal_date);


--
-- Name: idx_je_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_je_reference ON public.journal_entries USING btree (reference_type, reference_id);


--
-- Name: idx_je_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_je_status ON public.journal_entries USING btree (status);


--
-- Name: idx_jel_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jel_account_id ON public.journal_entry_lines USING btree (account_id);


--
-- Name: idx_jel_journal_entry_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jel_journal_entry_id ON public.journal_entry_lines USING btree (journal_entry_id);


--
-- Name: idx_maintenance_logs_vehicle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maintenance_logs_vehicle ON public.maintenance_logs USING btree (vehicle_id);


--
-- Name: idx_po_items_po; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_po_items_po ON public.purchase_order_items USING btree (po_id);


--
-- Name: idx_po_items_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_po_items_product ON public.purchase_order_items USING btree (product_id);


--
-- Name: idx_pos_sale_items_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_sale_items_product ON public.pos_sale_items USING btree (product_id);


--
-- Name: idx_pos_sale_items_sale; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_sale_items_sale ON public.pos_sale_items USING btree (sale_id);


--
-- Name: idx_pos_sales_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_sales_customer ON public.pos_sales USING btree (customer_id) WHERE (customer_id IS NOT NULL);


--
-- Name: idx_pos_sales_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_sales_date ON public.pos_sales USING btree (sale_date);


--
-- Name: idx_pos_sales_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_sales_location ON public.pos_sales USING btree (location_id);


--
-- Name: idx_products_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_active ON public.products USING btree (is_active);


--
-- Name: idx_products_barcode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_barcode ON public.products USING btree (barcode) WHERE (barcode IS NOT NULL);


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category ON public.products USING btree (category_id);


--
-- Name: idx_products_name_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_name_search ON public.products USING gin (to_tsvector('english'::regconfig, name));


--
-- Name: idx_products_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_sku ON public.products USING btree (sku);


--
-- Name: idx_products_sku_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_sku_search ON public.products USING gin (to_tsvector('english'::regconfig, sku));


--
-- Name: idx_purchase_orders_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_date ON public.purchase_orders USING btree (po_date);


--
-- Name: idx_purchase_orders_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_vendor ON public.purchase_orders USING btree (vendor_id);


--
-- Name: idx_role_permissions_permission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_permission ON public.role_permissions USING btree (permission_id);


--
-- Name: idx_role_permissions_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_role ON public.role_permissions USING btree (role_id);


--
-- Name: idx_sales_orders_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_orders_customer ON public.sales_orders USING btree (customer_id);


--
-- Name: idx_sales_orders_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_orders_date ON public.sales_orders USING btree (order_date);


--
-- Name: idx_user_profiles_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_active ON public.user_profiles USING btree (is_active);


--
-- Name: idx_user_roles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_role ON public.user_roles USING btree (role_id);


--
-- Name: idx_user_roles_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user ON public.user_roles USING btree (user_id);


--
-- Name: idx_vb_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vb_due_date ON public.vendor_bills USING btree (due_date);


--
-- Name: idx_vb_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vb_payment_status ON public.vendor_bills USING btree (payment_status);


--
-- Name: idx_vb_vendor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vb_vendor_id ON public.vendor_bills USING btree (vendor_id);


--
-- Name: customer_invoices_accounting trg_update_customer_balance_invoice; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_customer_balance_invoice AFTER INSERT OR UPDATE ON public.customer_invoices_accounting FOR EACH ROW EXECUTE FUNCTION public.update_customer_balance_on_invoice();


--
-- Name: receipt_vouchers trg_update_customer_balance_payment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_customer_balance_payment AFTER INSERT OR UPDATE ON public.receipt_vouchers FOR EACH ROW EXECUTE FUNCTION public.update_customer_balance_on_payment();


--
-- Name: stock_adjustments trigger_adjustment_approval; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_adjustment_approval AFTER UPDATE ON public.stock_adjustments FOR EACH ROW EXECUTE FUNCTION public.handle_adjustment_approval();


--
-- Name: goods_receipts trigger_auto_create_vendor_bill; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auto_create_vendor_bill AFTER INSERT ON public.goods_receipts FOR EACH ROW EXECUTE FUNCTION public.auto_create_vendor_bill_from_grn();


--
-- Name: stock_transfers trigger_transfer_completion; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_transfer_completion AFTER UPDATE ON public.stock_transfers FOR EACH ROW EXECUTE FUNCTION public.handle_transfer_completion();


--
-- Name: goods_receipt_items trigger_vendor_bill_after_items; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_vendor_bill_after_items AFTER INSERT ON public.goods_receipt_items FOR EACH ROW EXECUTE FUNCTION public.trigger_vendor_bill_on_items();


--
-- Name: bank_accounts update_bank_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: chart_of_accounts update_chart_of_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_chart_of_accounts_updated_at BEFORE UPDATE ON public.chart_of_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: company_settings update_company_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_company_settings_updated_at BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: credit_notes update_credit_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_credit_notes_updated_at BEFORE UPDATE ON public.credit_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: customer_invoices_accounting update_customer_invoices_accounting_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_customer_invoices_accounting_updated_at BEFORE UPDATE ON public.customer_invoices_accounting FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: customers update_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: delivery_notes update_delivery_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_delivery_notes_updated_at BEFORE UPDATE ON public.delivery_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: employees update_employees_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: goods_receipts update_goods_receipts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_goods_receipts_updated_at BEFORE UPDATE ON public.goods_receipts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: journal_entries update_journal_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: locations update_locations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payment_vouchers update_payment_vouchers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payment_vouchers_updated_at BEFORE UPDATE ON public.payment_vouchers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: purchase_orders update_purchase_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: receipt_vouchers update_receipt_vouchers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_receipt_vouchers_updated_at BEFORE UPDATE ON public.receipt_vouchers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sales_invoices update_sales_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sales_invoices_updated_at BEFORE UPDATE ON public.sales_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sales_orders update_sales_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sales_orders_updated_at BEFORE UPDATE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sales_quotations update_sales_quotations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sales_quotations_updated_at BEFORE UPDATE ON public.sales_quotations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sales_returns update_sales_returns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sales_returns_updated_at BEFORE UPDATE ON public.sales_returns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vehicles update_vehicles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vendor_bills update_vendor_bills_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_vendor_bills_updated_at BEFORE UPDATE ON public.vendor_bills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vendors update_vendors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: accounts accounts_account_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_account_type_id_fkey FOREIGN KEY (account_type_id) REFERENCES public.account_types(id);


--
-- Name: accounts accounts_parent_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_parent_account_id_fkey FOREIGN KEY (parent_account_id) REFERENCES public.accounts(id);


--
-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);


--
-- Name: approval_requests approval_requests_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.approval_workflows(id);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: bank_accounts bank_accounts_gl_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_gl_account_id_fkey FOREIGN KEY (gl_account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: chart_of_accounts chart_of_accounts_parent_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_parent_account_id_fkey FOREIGN KEY (parent_account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: credit_notes credit_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: credit_notes credit_notes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: credit_notes credit_notes_sales_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_sales_return_id_fkey FOREIGN KEY (sales_return_id) REFERENCES public.sales_returns(id);


--
-- Name: customer_invoice_items_accounting customer_invoice_items_accounting_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_invoice_items_accounting
    ADD CONSTRAINT customer_invoice_items_accounting_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.customer_invoices_accounting(id) ON DELETE CASCADE;


--
-- Name: customer_invoice_items_accounting customer_invoice_items_accounting_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_invoice_items_accounting
    ADD CONSTRAINT customer_invoice_items_accounting_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: customer_invoices_accounting customer_invoices_accounting_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_invoices_accounting
    ADD CONSTRAINT customer_invoices_accounting_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: customer_invoices_accounting customer_invoices_accounting_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_invoices_accounting
    ADD CONSTRAINT customer_invoices_accounting_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: customer_invoices_accounting customer_invoices_accounting_sales_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_invoices_accounting
    ADD CONSTRAINT customer_invoices_accounting_sales_order_id_fkey FOREIGN KEY (sales_order_id) REFERENCES public.sales_orders(id);


--
-- Name: customer_payments customer_payments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payments
    ADD CONSTRAINT customer_payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: customer_payments customer_payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payments
    ADD CONSTRAINT customer_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.sales_invoices(id);


--
-- Name: delivery_note_items delivery_note_items_delivery_note_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_note_items
    ADD CONSTRAINT delivery_note_items_delivery_note_id_fkey FOREIGN KEY (delivery_note_id) REFERENCES public.delivery_notes(id) ON DELETE CASCADE;


--
-- Name: delivery_note_items delivery_note_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_note_items
    ADD CONSTRAINT delivery_note_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: delivery_note_items delivery_note_items_sales_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_note_items
    ADD CONSTRAINT delivery_note_items_sales_order_item_id_fkey FOREIGN KEY (sales_order_item_id) REFERENCES public.sales_order_items(id);


--
-- Name: delivery_notes delivery_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_notes
    ADD CONSTRAINT delivery_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: delivery_notes delivery_notes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_notes
    ADD CONSTRAINT delivery_notes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: delivery_notes delivery_notes_sales_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_notes
    ADD CONSTRAINT delivery_notes_sales_order_id_fkey FOREIGN KEY (sales_order_id) REFERENCES public.sales_orders(id) ON DELETE RESTRICT;


--
-- Name: employees employees_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: employees employees_user_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_user_profile_id_fkey FOREIGN KEY (user_profile_id) REFERENCES public.user_profiles(id);


--
-- Name: grn_items fk_grn_items_grn; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn_items
    ADD CONSTRAINT fk_grn_items_grn FOREIGN KEY (grn_id) REFERENCES public.goods_receipt_notes(id) ON DELETE CASCADE;


--
-- Name: grn_items fk_grn_items_po_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn_items
    ADD CONSTRAINT fk_grn_items_po_item FOREIGN KEY (po_item_id) REFERENCES public.purchase_order_items(id) ON DELETE SET NULL;


--
-- Name: grn_items fk_grn_items_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn_items
    ADD CONSTRAINT fk_grn_items_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: goods_receipt_notes fk_grn_location; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT fk_grn_location FOREIGN KEY (receiving_location_id) REFERENCES public.inventory_locations(id) ON DELETE RESTRICT;


--
-- Name: goods_receipt_notes fk_grn_po; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT fk_grn_po FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;


--
-- Name: goods_receipt_notes fk_grn_vendor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT fk_grn_vendor FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL;


--
-- Name: purchase_order_items fk_po_items_po; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT fk_po_items_po FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items fk_po_items_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT fk_po_items_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: pos_sale_items fk_pos_items_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_sale_items
    ADD CONSTRAINT fk_pos_items_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: pos_sale_items fk_pos_items_sale; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_sale_items
    ADD CONSTRAINT fk_pos_items_sale FOREIGN KEY (sale_id) REFERENCES public.pos_sales(id) ON DELETE CASCADE;


--
-- Name: product_suppliers fk_product_supplier_vendor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suppliers
    ADD CONSTRAINT fk_product_supplier_vendor FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: fuel_logs fuel_logs_filled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_logs
    ADD CONSTRAINT fuel_logs_filled_by_fkey FOREIGN KEY (filled_by) REFERENCES public.employees(id);


--
-- Name: fuel_logs fuel_logs_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_logs
    ADD CONSTRAINT fuel_logs_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: goods_receipt_items goods_receipt_items_grn_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_grn_id_fkey FOREIGN KEY (grn_id) REFERENCES public.goods_receipts(id) ON DELETE CASCADE;


--
-- Name: goods_receipt_items goods_receipt_items_po_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_po_item_id_fkey FOREIGN KEY (po_item_id) REFERENCES public.purchase_order_items(id);


--
-- Name: goods_receipt_items goods_receipt_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: goods_receipts goods_receipts_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: goods_receipts goods_receipts_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id);


--
-- Name: goods_receipts goods_receipts_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.user_profiles(id);


--
-- Name: goods_receipts goods_receipts_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: inventory_stock inventory_stock_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock
    ADD CONSTRAINT inventory_stock_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: inventory_stock inventory_stock_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock
    ADD CONSTRAINT inventory_stock_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: inventory_transactions inventory_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id);


--
-- Name: inventory_transactions inventory_transactions_from_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_from_location_id_fkey FOREIGN KEY (from_location_id) REFERENCES public.locations(id);


--
-- Name: inventory_transactions inventory_transactions_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: inventory_transactions inventory_transactions_to_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_to_location_id_fkey FOREIGN KEY (to_location_id) REFERENCES public.locations(id);


--
-- Name: inventory_transactions inventory_transactions_transaction_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_transaction_type_id_fkey FOREIGN KEY (transaction_type_id) REFERENCES public.transaction_types(id);


--
-- Name: journal_entries journal_entries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: journal_entries journal_entries_fiscal_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_fiscal_year_id_fkey FOREIGN KEY (fiscal_year_id) REFERENCES public.fiscal_years(id);


--
-- Name: journal_entries journal_entries_posted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES auth.users(id);


--
-- Name: journal_entry_lines journal_entry_lines_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: journal_entry_lines journal_entry_lines_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id) ON DELETE CASCADE;


--
-- Name: locations locations_assigned_salesperson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_assigned_salesperson_id_fkey FOREIGN KEY (assigned_salesperson_id) REFERENCES public.user_profiles(id);


--
-- Name: locations locations_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.location_types(id);


--
-- Name: maintenance_logs maintenance_logs_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_logs
    ADD CONSTRAINT maintenance_logs_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: payment_allocations payment_allocations_payment_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_allocations
    ADD CONSTRAINT payment_allocations_payment_voucher_id_fkey FOREIGN KEY (payment_voucher_id) REFERENCES public.payment_vouchers(id) ON DELETE CASCADE;


--
-- Name: payment_allocations payment_allocations_vendor_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_allocations
    ADD CONSTRAINT payment_allocations_vendor_bill_id_fkey FOREIGN KEY (vendor_bill_id) REFERENCES public.vendor_bills(id);


--
-- Name: payment_vouchers payment_vouchers_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_vouchers
    ADD CONSTRAINT payment_vouchers_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id);


--
-- Name: payment_vouchers payment_vouchers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_vouchers
    ADD CONSTRAINT payment_vouchers_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: payment_vouchers payment_vouchers_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_vouchers
    ADD CONSTRAINT payment_vouchers_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: payslips payslips_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: payslips payslips_payroll_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_payroll_period_id_fkey FOREIGN KEY (payroll_period_id) REFERENCES public.payroll_periods(id);


--
-- Name: pos_sale_items pos_sale_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_sale_items
    ADD CONSTRAINT pos_sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: pos_sale_items pos_sale_items_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_sale_items
    ADD CONSTRAINT pos_sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.pos_sales(id) ON DELETE CASCADE;


--
-- Name: pos_sales pos_sales_cashier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_sales
    ADD CONSTRAINT pos_sales_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES public.user_profiles(id);


--
-- Name: pos_sales pos_sales_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_sales
    ADD CONSTRAINT pos_sales_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: pos_sales pos_sales_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_sales
    ADD CONSTRAINT pos_sales_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: product_barcodes product_barcodes_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_barcodes
    ADD CONSTRAINT product_barcodes_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_categories product_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.product_categories(id);


--
-- Name: product_suppliers product_suppliers_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_suppliers
    ADD CONSTRAINT product_suppliers_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.product_categories(id);


--
-- Name: products products_uom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_uom_id_fkey FOREIGN KEY (uom_id) REFERENCES public.units_of_measure(id);


--
-- Name: purchase_order_items purchase_order_items_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: purchase_orders purchase_orders_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.user_profiles(id);


--
-- Name: purchase_orders purchase_orders_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: purchase_orders purchase_orders_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.user_profiles(id);


--
-- Name: purchase_orders purchase_orders_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: receipt_allocations receipt_allocations_customer_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_allocations
    ADD CONSTRAINT receipt_allocations_customer_invoice_id_fkey FOREIGN KEY (customer_invoice_id) REFERENCES public.customer_invoices_accounting(id);


--
-- Name: receipt_allocations receipt_allocations_receipt_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_allocations
    ADD CONSTRAINT receipt_allocations_receipt_voucher_id_fkey FOREIGN KEY (receipt_voucher_id) REFERENCES public.receipt_vouchers(id) ON DELETE CASCADE;


--
-- Name: receipt_vouchers receipt_vouchers_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_vouchers
    ADD CONSTRAINT receipt_vouchers_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id);


--
-- Name: receipt_vouchers receipt_vouchers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_vouchers
    ADD CONSTRAINT receipt_vouchers_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: receipt_vouchers receipt_vouchers_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_vouchers
    ADD CONSTRAINT receipt_vouchers_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: sales_commissions sales_commissions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_commissions
    ADD CONSTRAINT sales_commissions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: sales_commissions sales_commissions_payslip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_commissions
    ADD CONSTRAINT sales_commissions_payslip_id_fkey FOREIGN KEY (payslip_id) REFERENCES public.payslips(id);


--
-- Name: sales_commissions sales_commissions_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_commissions
    ADD CONSTRAINT sales_commissions_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.pos_sales(id);


--
-- Name: sales_invoice_items sales_invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.sales_invoices(id) ON DELETE CASCADE;


--
-- Name: sales_invoice_items sales_invoice_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: sales_invoices sales_invoices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: sales_invoices sales_invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: sales_invoices sales_invoices_sales_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_sales_order_id_fkey FOREIGN KEY (sales_order_id) REFERENCES public.sales_orders(id);


--
-- Name: sales_order_items sales_order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.sales_orders(id) ON DELETE CASCADE;


--
-- Name: sales_order_items sales_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: sales_orders sales_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: sales_orders sales_orders_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: sales_orders sales_orders_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.sales_quotations(id);


--
-- Name: sales_orders sales_orders_salesperson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_salesperson_id_fkey FOREIGN KEY (salesperson_id) REFERENCES public.user_profiles(id);


--
-- Name: sales_orders sales_orders_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.inventory_locations(id);


--
-- Name: sales_quotation_items sales_quotation_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotation_items
    ADD CONSTRAINT sales_quotation_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: sales_quotation_items sales_quotation_items_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotation_items
    ADD CONSTRAINT sales_quotation_items_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.sales_quotations(id) ON DELETE CASCADE;


--
-- Name: sales_quotations sales_quotations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotations
    ADD CONSTRAINT sales_quotations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: sales_quotations sales_quotations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotations
    ADD CONSTRAINT sales_quotations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: sales_return_items sales_return_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_items
    ADD CONSTRAINT sales_return_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: sales_return_items sales_return_items_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_items
    ADD CONSTRAINT sales_return_items_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.sales_returns(id) ON DELETE CASCADE;


--
-- Name: sales_returns sales_returns_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT sales_returns_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.user_profiles(id);


--
-- Name: sales_returns sales_returns_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT sales_returns_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: sales_returns sales_returns_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT sales_returns_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: sales_returns sales_returns_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT sales_returns_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: sales_returns sales_returns_original_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT sales_returns_original_sale_id_fkey FOREIGN KEY (original_sale_id) REFERENCES public.pos_sales(id);


--
-- Name: sales_returns sales_returns_processed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT sales_returns_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.user_profiles(id);


--
-- Name: sales_returns sales_returns_sales_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT sales_returns_sales_invoice_id_fkey FOREIGN KEY (sales_invoice_id) REFERENCES public.sales_invoices(id);


--
-- Name: stock_adjustment_items stock_adjustment_items_adjustment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustment_items
    ADD CONSTRAINT stock_adjustment_items_adjustment_id_fkey FOREIGN KEY (adjustment_id) REFERENCES public.stock_adjustments(id) ON DELETE CASCADE;


--
-- Name: stock_adjustment_items stock_adjustment_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustment_items
    ADD CONSTRAINT stock_adjustment_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: stock_adjustments stock_adjustments_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.user_profiles(id);


--
-- Name: stock_adjustments stock_adjustments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id);


--
-- Name: stock_adjustments stock_adjustments_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: stock_transfer_items stock_transfer_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer_items
    ADD CONSTRAINT stock_transfer_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: stock_transfer_items stock_transfer_items_transfer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer_items
    ADD CONSTRAINT stock_transfer_items_transfer_id_fkey FOREIGN KEY (transfer_id) REFERENCES public.stock_transfers(id) ON DELETE CASCADE;


--
-- Name: stock_transfers stock_transfers_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.user_profiles(id);


--
-- Name: stock_transfers stock_transfers_from_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_from_location_id_fkey FOREIGN KEY (from_location_id) REFERENCES public.locations(id);


--
-- Name: stock_transfers stock_transfers_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.user_profiles(id);


--
-- Name: stock_transfers stock_transfers_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.user_profiles(id);


--
-- Name: stock_transfers stock_transfers_to_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_to_location_id_fkey FOREIGN KEY (to_location_id) REFERENCES public.locations(id);


--
-- Name: user_allowed_locations user_allowed_locations_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_allowed_locations
    ADD CONSTRAINT user_allowed_locations_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id);


--
-- Name: user_allowed_locations user_allowed_locations_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_allowed_locations
    ADD CONSTRAINT user_allowed_locations_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;


--
-- Name: user_allowed_locations user_allowed_locations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_allowed_locations
    ADD CONSTRAINT user_allowed_locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;


--
-- Name: user_profiles user_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;


--
-- Name: vehicle_expenses vehicle_expenses_paid_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_expenses
    ADD CONSTRAINT vehicle_expenses_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES public.employees(id);


--
-- Name: vehicle_expenses vehicle_expenses_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_expenses
    ADD CONSTRAINT vehicle_expenses_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: vehicles vehicles_assigned_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_assigned_driver_id_fkey FOREIGN KEY (assigned_driver_id) REFERENCES public.employees(id);


--
-- Name: vehicles vehicles_assigned_salesperson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_assigned_salesperson_id_fkey FOREIGN KEY (assigned_salesperson_id) REFERENCES public.employees(id);


--
-- Name: vehicles vehicles_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: vendor_bill_items vendor_bill_items_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_bill_items
    ADD CONSTRAINT vendor_bill_items_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.vendor_bills(id) ON DELETE CASCADE;


--
-- Name: vendor_bill_items vendor_bill_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_bill_items
    ADD CONSTRAINT vendor_bill_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: vendor_bills vendor_bills_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_bills
    ADD CONSTRAINT vendor_bills_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: vendor_bills vendor_bills_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_bills
    ADD CONSTRAINT vendor_bills_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: vendor_bills vendor_bills_grn_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_bills
    ADD CONSTRAINT vendor_bills_grn_id_fkey FOREIGN KEY (grn_id) REFERENCES public.goods_receipts(id);


--
-- Name: vendor_bills vendor_bills_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_bills
    ADD CONSTRAINT vendor_bills_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: vendor_payments vendor_payments_paid_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_payments
    ADD CONSTRAINT vendor_payments_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES public.user_profiles(id);


--
-- Name: vendor_payments vendor_payments_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_payments
    ADD CONSTRAINT vendor_payments_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: customers Allow all for authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all for authenticated" ON public.customers TO authenticated USING (true) WITH CHECK (true);


--
-- Name: goods_receipt_notes Allow all for authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all for authenticated" ON public.goods_receipt_notes TO authenticated USING (true) WITH CHECK (true);


--
-- Name: grn_items Allow all for authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all for authenticated" ON public.grn_items TO authenticated USING (true) WITH CHECK (true);


--
-- Name: inventory_locations Allow all for authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all for authenticated" ON public.inventory_locations TO authenticated USING (true) WITH CHECK (true);


--
-- Name: pos_sale_items Allow all for authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all for authenticated" ON public.pos_sale_items TO authenticated USING (true) WITH CHECK (true);


--
-- Name: purchase_order_items Allow all for authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all for authenticated" ON public.purchase_order_items TO authenticated USING (true) WITH CHECK (true);


--
-- Name: location_types Allow public select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public select" ON public.location_types FOR SELECT USING (true);


--
-- Name: products Allow public select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public select" ON public.products FOR SELECT USING (true);


--
-- Name: units_of_measure Allow public select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public select" ON public.units_of_measure FOR SELECT USING (true);


--
-- Name: pos_sales Anyone can read POS sales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read POS sales" ON public.pos_sales FOR SELECT TO authenticated USING (true);


--
-- Name: accounts Anyone can read accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read accounts" ON public.accounts FOR SELECT TO authenticated USING (true);


--
-- Name: activity_logs Anyone can read activity logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read activity logs" ON public.activity_logs FOR SELECT TO authenticated USING (true);


--
-- Name: product_barcodes Anyone can read barcodes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read barcodes" ON public.product_barcodes FOR SELECT TO authenticated USING (true);


--
-- Name: customer_payments Anyone can read customer payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read customer payments" ON public.customer_payments FOR SELECT TO authenticated USING (true);


--
-- Name: customers Anyone can read customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read customers" ON public.customers FOR SELECT TO authenticated USING (true);


--
-- Name: employees Anyone can read employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read employees" ON public.employees FOR SELECT TO authenticated USING (true);


--
-- Name: fuel_logs Anyone can read fuel logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read fuel logs" ON public.fuel_logs FOR SELECT TO authenticated USING (true);


--
-- Name: goods_receipts Anyone can read goods receipts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read goods receipts" ON public.goods_receipts FOR SELECT TO authenticated USING (true);


--
-- Name: inventory_stock Anyone can read inventory stock; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read inventory stock" ON public.inventory_stock FOR SELECT TO authenticated USING (true);


--
-- Name: inventory_transactions Anyone can read inventory transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read inventory transactions" ON public.inventory_transactions FOR SELECT TO authenticated USING (true);


--
-- Name: location_types Anyone can read location types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read location types" ON public.location_types FOR SELECT TO authenticated USING (true);


--
-- Name: locations Anyone can read locations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read locations" ON public.locations FOR SELECT TO authenticated USING (true);


--
-- Name: maintenance_logs Anyone can read maintenance logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read maintenance logs" ON public.maintenance_logs FOR SELECT TO authenticated USING (true);


--
-- Name: payslips Anyone can read payslips; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read payslips" ON public.payslips FOR SELECT TO authenticated USING (true);


--
-- Name: product_categories Anyone can read product categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read product categories" ON public.product_categories FOR SELECT TO authenticated USING (true);


--
-- Name: products Anyone can read products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read products" ON public.products FOR SELECT TO authenticated USING (true);


--
-- Name: purchase_orders Anyone can read purchase orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read purchase orders" ON public.purchase_orders FOR SELECT TO authenticated USING (true);


--
-- Name: sales_commissions Anyone can read sales commissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read sales commissions" ON public.sales_commissions FOR SELECT TO authenticated USING (true);


--
-- Name: sales_orders Anyone can read sales orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read sales orders" ON public.sales_orders FOR SELECT TO authenticated USING (true);


--
-- Name: sales_returns Anyone can read sales returns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read sales returns" ON public.sales_returns FOR SELECT TO authenticated USING (true);


--
-- Name: stock_adjustments Anyone can read stock adjustments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read stock adjustments" ON public.stock_adjustments FOR SELECT TO authenticated USING (true);


--
-- Name: stock_transfers Anyone can read stock transfers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read stock transfers" ON public.stock_transfers FOR SELECT TO authenticated USING (true);


--
-- Name: transaction_types Anyone can read transaction types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read transaction types" ON public.transaction_types FOR SELECT TO authenticated USING (true);


--
-- Name: units_of_measure Anyone can read units of measure; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read units of measure" ON public.units_of_measure FOR SELECT TO authenticated USING (true);


--
-- Name: vehicles Anyone can read vehicles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read vehicles" ON public.vehicles FOR SELECT TO authenticated USING (true);


--
-- Name: vendor_payments Anyone can read vendor payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read vendor payments" ON public.vendor_payments FOR SELECT TO authenticated USING (true);


--
-- Name: vendors Anyone can read vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read vendors" ON public.vendors FOR SELECT TO authenticated USING (true);


--
-- Name: permissions Anyone can view permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view permissions" ON public.permissions FOR SELECT TO authenticated USING (true);


--
-- Name: role_permissions Anyone can view role_permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view role_permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);


--
-- Name: roles Anyone can view roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view roles" ON public.roles FOR SELECT TO authenticated USING (true);


--
-- Name: user_roles Anyone can view user_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view user_roles" ON public.user_roles FOR SELECT TO authenticated USING (true);


--
-- Name: pos_sales Authenticated users can create POS sales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create POS sales" ON public.pos_sales FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: activity_logs Authenticated users can create activity logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create activity logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: inventory_transactions Authenticated users can create inventory transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create inventory transactions" ON public.inventory_transactions FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: products Authenticated users can insert products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: accounts Authenticated users can manage accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage accounts" ON public.accounts TO authenticated USING (true);


--
-- Name: product_barcodes Authenticated users can manage barcodes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage barcodes" ON public.product_barcodes TO authenticated USING (true);


--
-- Name: product_categories Authenticated users can manage categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage categories" ON public.product_categories TO authenticated USING (true);


--
-- Name: customer_payments Authenticated users can manage customer payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage customer payments" ON public.customer_payments TO authenticated USING (true);


--
-- Name: customers Authenticated users can manage customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage customers" ON public.customers TO authenticated USING (true);


--
-- Name: employees Authenticated users can manage employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage employees" ON public.employees TO authenticated USING (true);


--
-- Name: fuel_logs Authenticated users can manage fuel logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage fuel logs" ON public.fuel_logs TO authenticated USING (true);


--
-- Name: goods_receipts Authenticated users can manage goods receipts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage goods receipts" ON public.goods_receipts TO authenticated USING (true);


--
-- Name: inventory_stock Authenticated users can manage inventory stock; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage inventory stock" ON public.inventory_stock TO authenticated USING (true);


--
-- Name: locations Authenticated users can manage locations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage locations" ON public.locations TO authenticated USING (true);


--
-- Name: maintenance_logs Authenticated users can manage maintenance logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage maintenance logs" ON public.maintenance_logs TO authenticated USING (true);


--
-- Name: payslips Authenticated users can manage payslips; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage payslips" ON public.payslips TO authenticated USING (true);


--
-- Name: purchase_orders Authenticated users can manage purchase orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage purchase orders" ON public.purchase_orders TO authenticated USING (true);


--
-- Name: sales_commissions Authenticated users can manage sales commissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage sales commissions" ON public.sales_commissions TO authenticated USING (true);


--
-- Name: sales_orders Authenticated users can manage sales orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage sales orders" ON public.sales_orders TO authenticated USING (true);


--
-- Name: sales_returns Authenticated users can manage sales returns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage sales returns" ON public.sales_returns TO authenticated USING (true);


--
-- Name: stock_adjustments Authenticated users can manage stock adjustments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage stock adjustments" ON public.stock_adjustments TO authenticated USING (true);


--
-- Name: stock_transfers Authenticated users can manage stock transfers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage stock transfers" ON public.stock_transfers TO authenticated USING (true);


--
-- Name: vehicles Authenticated users can manage vehicles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage vehicles" ON public.vehicles TO authenticated USING (true);


--
-- Name: vendor_payments Authenticated users can manage vendor payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage vendor payments" ON public.vendor_payments TO authenticated USING (true);


--
-- Name: vendors Authenticated users can manage vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage vendors" ON public.vendors TO authenticated USING (true);


--
-- Name: products Authenticated users can update products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update products" ON public.products FOR UPDATE TO authenticated USING (true);


--
-- Name: user_profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE TO authenticated USING ((id = auth.uid()));


--
-- Name: user_profiles Users can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all profiles" ON public.user_profiles FOR SELECT TO authenticated USING (true);


--
-- Name: audit_logs Users can view audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (true);


--
-- Name: accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: employees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

--
-- Name: fuel_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: goods_receipt_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.goods_receipt_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: goods_receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: grn_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.grn_items ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_stock; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_stock ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: location_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.location_types ENABLE ROW LEVEL SECURITY;

--
-- Name: locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

--
-- Name: maintenance_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: payslips; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

--
-- Name: permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: pos_sale_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pos_sale_items ENABLE ROW LEVEL SECURITY;

--
-- Name: pos_sales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pos_sales ENABLE ROW LEVEL SECURITY;

--
-- Name: product_barcodes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_barcodes ENABLE ROW LEVEL SECURITY;

--
-- Name: product_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_commissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_commissions ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_returns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_adjustments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_transfers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

--
-- Name: transaction_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transaction_types ENABLE ROW LEVEL SECURITY;

--
-- Name: units_of_measure; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.units_of_measure ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

--
-- Name: vendor_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vendor_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: vendors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict lnyXBwJ6jnfa6NT3m3hs7SJMnW8wSSIOlHNzR7ks4obM8GyXax8TbsCdFzIp1ZP

