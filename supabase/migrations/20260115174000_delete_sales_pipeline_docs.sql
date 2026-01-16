-- DANGEROUS: Delete all sales quotations, sales orders, and delivery notes (and their items).
-- This is intended for one-time use in production when explicitly approved.

BEGIN;

WITH del_delivery_notes AS (
  DELETE FROM delivery_notes
  RETURNING id
),
del_sales_orders AS (
  DELETE FROM sales_orders
  RETURNING id
),
del_sales_quotations AS (
  DELETE FROM sales_quotations
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM del_delivery_notes) AS delivery_notes_deleted,
  (SELECT COUNT(*) FROM del_sales_orders) AS sales_orders_deleted,
  (SELECT COUNT(*) FROM del_sales_quotations) AS sales_quotations_deleted;

COMMIT;
