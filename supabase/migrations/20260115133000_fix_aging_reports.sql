-- Fix aging reports to include not-yet-due balances and use accounting tables directly

CREATE OR REPLACE FUNCTION public.get_customer_aging_report(p_as_of_date date)
RETURNS TABLE(customer_id uuid, customer_name text, customer_code text, buckets json)
LANGUAGE plpgsql
SECURITY DEFINER
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
    LEFT JOIN customer_invoices_accounting ci ON ci.customer_id = c.id
        AND ci.amount_due > 0
        AND ci.payment_status IN ('unpaid', 'partial', 'overdue')
    WHERE c.is_active = true
    GROUP BY c.id, c.name, c.customer_code
    HAVING SUM(ci.amount_due) > 0
    ORDER BY SUM(ci.amount_due) DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_vendor_aging_report(p_as_of_date date)
RETURNS TABLE(vendor_id uuid, vendor_name text, vendor_code text, buckets json)
LANGUAGE plpgsql
SECURITY DEFINER
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
    WHERE v.is_active = true
    GROUP BY v.id, v.name, v.vendor_code
    HAVING SUM(vb.amount_due) > 0
    ORDER BY SUM(vb.amount_due) DESC;
END;
$$;
