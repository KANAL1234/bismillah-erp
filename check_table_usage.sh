#!/bin/bash
TABLES=(
"account_types" "accounts" "activity_logs" "approval_requests" "approval_workflows" "audit_logs" "bank_accounts" "chart_of_accounts" "company_settings" "credit_notes" "customer_invoice_items_accounting" "customer_invoices_accounting" "customer_payments" "customers" "delivery_note_items" "delivery_notes" "departments" "employees" "fiscal_years" "fuel_logs" "goods_receipt_items" "goods_receipt_notes" "goods_receipts" "grn_items" "inventory_locations" "inventory_stock" "inventory_transactions" "journal_entries" "journal_entry_lines" "journals" "location_types" "locations" "maintenance_logs" "payment_allocations" "payment_vouchers" "payroll_periods" "payslips" "permissions" "pos_sale_items" "pos_sales" "product_barcodes" "product_categories" "product_suppliers" "products" "purchase_order_items" "purchase_orders" "receipt_allocations" "receipt_vouchers" "role_permissions" "roles" "sales_commissions" "sales_invoice_items" "sales_invoices" "sales_order_items" "sales_orders" "sales_quotation_items" "sales_quotations" "sales_return_items" "sales_returns" "schema_version" "stock_adjustment_items" "stock_adjustments" "stock_transfer_items" "stock_transfers" "system_settings" "tax_rates" "transaction_types" "units_of_measure" "user_allowed_locations" "user_profiles" "user_roles" "vehicle_expenses" "vehicles" "vendor_bill_items" "vendor_bills" "vendor_payments" "vendors"
)

echo "Table Usage Report"
echo "==================="

for table in "${TABLES[@]}"; do
    count=$(grep -r "$table" app components lib/queries | grep -v "lib/types" | wc -l)
    if [ $count -eq 0 ]; then
        echo "[UNUSED] $table"
    else
        echo "[USED] $table ($count references)"
    fi
done
