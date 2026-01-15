-- Create COGS posting for delivery notes (B2B workflow)
CREATE OR REPLACE FUNCTION public.post_delivery_note(p_delivery_note_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_note RECORD;
    v_order RECORD;
    v_item RECORD;
    v_journal_id UUID;
    v_journal_number TEXT;
    v_cogs_account_id UUID;
    v_inventory_account_id UUID;
    v_fiscal_year_id UUID;
    v_location_id UUID;
    v_total_cogs numeric := 0;
    v_existing_journal_id UUID;
BEGIN
    -- Get delivery note
    SELECT * INTO v_note FROM delivery_notes WHERE id = p_delivery_note_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Delivery Note not found: %', p_delivery_note_id;
    END IF;

    -- Prevent double posting
    SELECT id INTO v_existing_journal_id
    FROM journal_entries
    WHERE reference_type = 'DELIVERY_NOTE'
      AND reference_id = p_delivery_note_id
    LIMIT 1;

    IF v_existing_journal_id IS NOT NULL THEN
        RETURN json_build_object(
            'success', true,
            'journal_id', v_existing_journal_id,
            'journal_number', 'EXISTS'
        );
    END IF;

    -- Get sales order to identify warehouse/location
    SELECT id, warehouse_id, location_id, order_number
    INTO v_order
    FROM sales_orders
    WHERE id = v_note.sales_order_id;

    v_location_id := COALESCE(v_order.warehouse_id, v_order.location_id);
    IF v_location_id IS NULL THEN
        RAISE EXCEPTION 'No warehouse/location found for sales order %', v_note.sales_order_id;
    END IF;

    -- Get account IDs (prefer 5010/1300, fallback to 5000/1310/1200)
    SELECT id INTO v_cogs_account_id
    FROM chart_of_accounts
    WHERE account_code IN ('5010', '5000')
    ORDER BY CASE account_code WHEN '5010' THEN 1 WHEN '5000' THEN 2 ELSE 3 END
    LIMIT 1;

    SELECT id INTO v_inventory_account_id
    FROM chart_of_accounts
    WHERE account_code IN ('1300', '1310', '1200')
    ORDER BY CASE account_code WHEN '1300' THEN 1 WHEN '1310' THEN 2 WHEN '1200' THEN 3 ELSE 4 END
    LIMIT 1;

    IF v_cogs_account_id IS NULL THEN
        RAISE EXCEPTION 'COGS account not found (expected 5010 or 5000)';
    END IF;

    IF v_inventory_account_id IS NULL THEN
        RAISE EXCEPTION 'Inventory account not found (expected 1300, 1310, or 1200)';
    END IF;

    -- Get current fiscal year
    SELECT id INTO v_fiscal_year_id FROM fiscal_years WHERE is_closed = false LIMIT 1;

    -- Calculate total COGS for delivered items
    FOR v_item IN
        SELECT * FROM delivery_note_items WHERE delivery_note_id = p_delivery_note_id
    LOOP
        v_total_cogs := v_total_cogs + COALESCE(
            public.get_cogs_for_sale(v_item.product_id, v_location_id, v_item.quantity_delivered),
            0
        );
    END LOOP;

    -- Generate journal number
    v_journal_number := 'JE-DN-' || COALESCE((SELECT delivery_note_number FROM delivery_notes WHERE id = p_delivery_note_id), p_delivery_note_id::text);

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
        v_note.delivery_date::date,
        v_fiscal_year_id,
        'DELIVERY_NOTE',
        p_delivery_note_id,
        v_journal_number,
        'Delivery Note - ' || v_journal_number,
        v_total_cogs,
        v_total_cogs,
        'posted',
        NOW(),
        v_note.created_by
    ) RETURNING id INTO v_journal_id;

    -- Debit: COGS
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (v_journal_id, v_cogs_account_id, v_total_cogs, 0, 'Cost of Goods Sold');

    -- Credit: Inventory
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (v_journal_id, v_inventory_account_id, 0, v_total_cogs, 'Inventory');

    RETURN json_build_object(
        'success', true,
        'journal_id', v_journal_id,
        'journal_number', v_journal_number,
        'total_cogs', v_total_cogs
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;
