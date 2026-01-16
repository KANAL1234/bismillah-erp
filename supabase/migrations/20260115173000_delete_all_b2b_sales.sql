-- DANGEROUS: Delete all B2B sales invoices and related records.
-- This is intended for one-time use in production when explicitly approved.

BEGIN;

WITH b2b AS (
  SELECT id, invoice_number, journal_entry_id
  FROM sales_invoices
),
b2b_acc AS (
  SELECT ci.id
  FROM customer_invoices_accounting ci
  JOIN b2b ON ci.invoice_number = b2b.invoice_number
),
b2b_alloc AS (
  SELECT ra.receipt_voucher_id
  FROM receipt_allocations ra
  WHERE ra.customer_invoice_id IN (SELECT id FROM b2b_acc)
),
del_sales_items AS (
  DELETE FROM sales_invoice_items
  WHERE invoice_id IN (SELECT id FROM b2b)
  RETURNING 1
),
del_journal_lines AS (
  DELETE FROM journal_entry_lines
  WHERE journal_entry_id IN (SELECT journal_entry_id FROM b2b WHERE journal_entry_id IS NOT NULL)
  RETURNING 1
),
del_journals AS (
  DELETE FROM journal_entries
  WHERE id IN (SELECT journal_entry_id FROM b2b WHERE journal_entry_id IS NOT NULL)
  RETURNING 1
),
del_receipt_alloc AS (
  DELETE FROM receipt_allocations
  WHERE customer_invoice_id IN (SELECT id FROM b2b_acc)
  RETURNING receipt_voucher_id
),
del_receipts AS (
  DELETE FROM receipt_vouchers
  WHERE id IN (SELECT receipt_voucher_id FROM b2b_alloc)
  RETURNING 1
),
del_acc_items AS (
  DELETE FROM customer_invoice_items_accounting
  WHERE invoice_id IN (SELECT id FROM b2b_acc)
  RETURNING 1
),
del_acc AS (
  DELETE FROM customer_invoices_accounting
  WHERE id IN (SELECT id FROM b2b_acc)
  RETURNING 1
),
del_sales AS (
  DELETE FROM sales_invoices
  WHERE id IN (SELECT id FROM b2b)
  RETURNING 1
)
SELECT
  (SELECT COUNT(*) FROM del_sales) AS sales_invoices_deleted,
  (SELECT COUNT(*) FROM del_sales_items) AS sales_invoice_items_deleted,
  (SELECT COUNT(*) FROM del_acc) AS accounting_invoices_deleted,
  (SELECT COUNT(*) FROM del_acc_items) AS accounting_items_deleted,
  (SELECT COUNT(*) FROM del_journals) AS journal_entries_deleted,
  (SELECT COUNT(*) FROM del_journal_lines) AS journal_entry_lines_deleted,
  (SELECT COUNT(*) FROM del_receipt_alloc) AS receipt_allocations_deleted,
  (SELECT COUNT(*) FROM del_receipts) AS receipt_vouchers_deleted;

COMMIT;
