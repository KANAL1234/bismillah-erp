'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Download, FileText, TrendingUp, Users, Package, DollarSign, Filter } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useLocation } from '@/components/providers/location-provider';

const supabase = createClient();

type RegisterType = 'sales' | 'purchase' | 'sales-by-product' | 'sales-by-customer' | 'purchase-by-vendor';

export default function TransactionRegisters() {
    const [activeRegister, setActiveRegister] = useState<RegisterType>('sales');
    const [loading, setLoading] = useState(false);
    const [dateFrom, setDateFrom] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]); // First day of month
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const { allowedLocationIds } = useLocation();

    // Filters
    const [customerFilter, setCustomerFilter] = useState('');
    const [vendorFilter, setVendorFilter] = useState('');
    const [locationFilter, setLocationFilter] = useState('');

    // Data
    const [salesRegister, setSalesRegister] = useState<any[]>([]);
    const [purchaseRegister, setPurchaseRegister] = useState<any[]>([]);
    const [salesByProduct, setSalesByProduct] = useState<any[]>([]);
    const [salesByCustomer, setSalesByCustomer] = useState<any[]>([]);
    const [purchaseByVendor, setPurchaseByVendor] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);

    // Dropdowns
    const [customers, setCustomers] = useState<any[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);

    useEffect(() => {
        loadDropdowns();
    }, []);

    useEffect(() => {
        loadReport();
    }, [activeRegister, dateFrom, dateTo, customerFilter, vendorFilter, locationFilter]);

    const loadDropdowns = async () => {
        const [customersRes, vendorsRes, locationsRes] = await Promise.all([
            supabase.from('customers').select('id, customer_code, name').eq('is_active', true).order('name'),
            supabase.from('vendors').select('id, vendor_code, name').eq('is_active', true).order('name'),
            supabase.from('locations').select('id, location_code, name').order('name')
        ]);

        if (customersRes.data) setCustomers(customersRes.data);
        if (vendorsRes.data) setVendors(vendorsRes.data);
        // Filter locations by LBAC
        if (locationsRes.data) {
            setLocations(locationsRes.data.filter(loc => allowedLocationIds.includes(loc.id)));
        }
    };

    const loadReport = async () => {
        setLoading(true);
        try {
            switch (activeRegister) {
                case 'sales':
                    await loadSalesRegister();
                    break;
                case 'purchase':
                    await loadPurchaseRegister();
                    break;
                case 'sales-by-product':
                    await loadSalesByProduct();
                    break;
                case 'sales-by-customer':
                    await loadSalesByCustomer();
                    break;
                case 'purchase-by-vendor':
                    await loadPurchaseByVendor();
                    break;
            }
        } catch (error) {
            console.error('Error loading report:', error);
            toast.error('Failed to load report');
        } finally {
            setLoading(false);
        }
    };

    const loadSalesRegister = async () => {
        const { data: registerData, error: registerError } = await supabase.rpc('get_sales_register', {
            p_date_from: dateFrom,
            p_date_to: dateTo,
            p_customer_id: customerFilter || null,
            p_location_id: locationFilter || null
        });

        const { data: summaryData, error: summaryError } = await supabase.rpc('get_sales_register_summary', {
            p_date_from: dateFrom,
            p_date_to: dateTo
        });

        if (registerError) throw registerError;
        if (summaryError) throw summaryError;

        setSalesRegister(registerData || []);
        setSummary(summaryData);
    };

    const loadPurchaseRegister = async () => {
        const { data: registerData, error: registerError } = await supabase.rpc('get_purchase_register', {
            p_date_from: dateFrom,
            p_date_to: dateTo,
            p_vendor_id: vendorFilter || null
        });

        const { data: summaryData, error: summaryError } = await supabase.rpc('get_purchase_register_summary', {
            p_date_from: dateFrom,
            p_date_to: dateTo
        });

        if (registerError) throw registerError;
        if (summaryError) throw summaryError;

        setPurchaseRegister(registerData || []);
        setSummary(summaryData);
    };

    const loadSalesByProduct = async () => {
        const { data, error } = await supabase.rpc('get_sales_by_product', {
            p_date_from: dateFrom,
            p_date_to: dateTo,
            p_limit: 50
        });

        if (error) throw error;
        setSalesByProduct(data || []);
    };

    const loadSalesByCustomer = async () => {
        const { data, error } = await supabase.rpc('get_sales_by_customer', {
            p_date_from: dateFrom,
            p_date_to: dateTo,
            p_limit: 50
        });

        if (error) throw error;
        setSalesByCustomer(data || []);
    };

    const loadPurchaseByVendor = async () => {
        const { data, error } = await supabase.rpc('get_purchase_by_vendor', {
            p_date_from: dateFrom,
            p_date_to: dateTo,
            p_limit: 50
        });

        if (error) throw error;
        setPurchaseByVendor(data || []);
    };

    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();
        let ws: any;
        let filename = '';

        switch (activeRegister) {
            case 'sales':
                ws = XLSX.utils.json_to_sheet(salesRegister.map(r => ({
                    'Date': r.sale_date,
                    'Invoice #': r.invoice_number,
                    'Customer': r.customer_name,
                    'Type': r.sale_type,
                    'Payment': r.payment_method,
                    'Subtotal': r.subtotal,
                    'Discount': r.discount_amount,
                    'Tax': r.tax_amount,
                    'Total': r.total_amount,
                    'Paid': r.amount_paid,
                    'Due': r.amount_due,
                    'Status': r.payment_status
                })));
                filename = `Sales_Register_${dateFrom}_to_${dateTo}.xlsx`;
                break;

            case 'purchase':
                ws = XLSX.utils.json_to_sheet(purchaseRegister.map(r => ({
                    'Date': r.bill_date,
                    'Bill #': r.bill_number,
                    'Vendor': r.vendor_name,
                    'PO #': r.po_number,
                    'Subtotal': r.subtotal,
                    'Tax': r.sales_tax_amount,
                    'WHT': r.wht_amount,
                    'Total': r.total_amount,
                    'Paid': r.amount_paid,
                    'Due': r.amount_due,
                    'Status': r.payment_status
                })));
                filename = `Purchase_Register_${dateFrom}_to_${dateTo}.xlsx`;
                break;

            case 'sales-by-product':
                ws = XLSX.utils.json_to_sheet(salesByProduct.map(r => ({
                    'SKU': r.product_sku,
                    'Product': r.product_name,
                    'Quantity': r.total_quantity,
                    'Sales': r.total_sales,
                    'Transactions': r.transaction_count,
                    'Avg Price': r.avg_price
                })));
                filename = `Sales_By_Product_${dateFrom}_to_${dateTo}.xlsx`;
                break;

            case 'sales-by-customer':
                ws = XLSX.utils.json_to_sheet(salesByCustomer.map(r => ({
                    'Code': r.customer_code,
                    'Customer': r.customer_name,
                    'Sales': r.total_sales,
                    'Paid': r.total_paid,
                    'Outstanding': r.outstanding,
                    'Transactions': r.transaction_count
                })));
                filename = `Sales_By_Customer_${dateFrom}_to_${dateTo}.xlsx`;
                break;

            case 'purchase-by-vendor':
                ws = XLSX.utils.json_to_sheet(purchaseByVendor.map(r => ({
                    'Code': r.vendor_code,
                    'Vendor': r.vendor_name,
                    'Purchases': r.total_purchases,
                    'Paid': r.total_paid,
                    'Outstanding': r.outstanding,
                    'Bills': r.bill_count
                })));
                filename = `Purchase_By_Vendor_${dateFrom}_to_${dateTo}.xlsx`;
                break;
        }

        XLSX.utils.book_append_sheet(wb, ws, 'Report');
        XLSX.writeFile(wb, filename);
        toast.success('Report exported successfully!');
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-PK', {
            style: 'currency',
            currency: 'PKR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    return (
        <div className="max-w-7xl mx-auto p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Transaction Registers</h1>
                    <p className="text-sm text-gray-600 mt-1">Detailed sales and purchase reports</p>
                </div>
                <button
                    onClick={exportToExcel}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                    <Download className="w-4 h-4" />
                    Export to Excel
                </button>
            </div>

            {/* Register Tabs */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
                <div className="flex border-b border-gray-200 overflow-x-auto">
                    {[
                        { id: 'sales', label: 'Sales Register', icon: FileText },
                        { id: 'purchase', label: 'Purchase Register', icon: FileText },
                        { id: 'sales-by-product', label: 'Sales by Product', icon: Package },
                        { id: 'sales-by-customer', label: 'Sales by Customer', icon: Users },
                        { id: 'purchase-by-vendor', label: 'Purchase by Vendor', icon: Users }
                    ].map(register => (
                        <button
                            key={register.id}
                            onClick={() => setActiveRegister(register.id as RegisterType)}
                            className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${activeRegister === register.id
                                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                        >
                            <register.icon className="w-5 h-5" />
                            {register.label}
                        </button>
                    ))}
                </div>

                {/* Filters */}
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <div className="flex flex-wrap items-center gap-4">
                        <Calendar className="w-5 h-5 text-gray-400" />

                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-gray-700">From:</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-gray-700">To:</label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {(activeRegister === 'sales') && (
                            <>
                                <div className="flex items-center gap-2">
                                    <Filter className="w-4 h-4 text-gray-400" />
                                    <select
                                        value={customerFilter}
                                        onChange={(e) => setCustomerFilter(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">All Customers</option>
                                        {customers.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <select
                                        value={locationFilter}
                                        onChange={(e) => setLocationFilter(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">All Locations</option>
                                        {locations.map(l => (
                                            <option key={l.id} value={l.id}>{l.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        )}

                        {activeRegister === 'purchase' && (
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-gray-400" />
                                <select
                                    value={vendorFilter}
                                    onChange={(e) => setVendorFilter(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">All Vendors</option>
                                    {vendors.map(v => (
                                        <option key={v.id} value={v.id}>{v.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <button
                            onClick={loadReport}
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Loading...' : 'Generate'}
                        </button>
                    </div>
                </div>

                {/* Summary Cards */}
                {summary && (activeRegister === 'sales' || activeRegister === 'purchase') && (
                    <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {activeRegister === 'sales' ? (
                                <>
                                    <div className="bg-white p-4 rounded-lg shadow-sm">
                                        <div className="text-sm text-gray-600">Gross Sales</div>
                                        <div className="text-xl font-bold text-gray-900 mt-1">
                                            {formatCurrency(summary.totals?.gross_sales || 0)}
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 rounded-lg shadow-sm">
                                        <div className="text-sm text-gray-600">Cash Sales</div>
                                        <div className="text-xl font-bold text-green-600 mt-1">
                                            {formatCurrency(summary.totals?.cash_sales || 0)}
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 rounded-lg shadow-sm">
                                        <div className="text-sm text-gray-600">Credit Sales</div>
                                        <div className="text-xl font-bold text-orange-600 mt-1">
                                            {formatCurrency(summary.totals?.credit_sales || 0)}
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 rounded-lg shadow-sm">
                                        <div className="text-sm text-gray-600">Transactions</div>
                                        <div className="text-xl font-bold text-blue-600 mt-1">
                                            {summary.counts?.total_transactions || 0}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="bg-white p-4 rounded-lg shadow-sm">
                                        <div className="text-sm text-gray-600">Gross Purchases</div>
                                        <div className="text-xl font-bold text-gray-900 mt-1">
                                            {formatCurrency(summary.totals?.gross_purchases || 0)}
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 rounded-lg shadow-sm">
                                        <div className="text-sm text-gray-600">Input Tax</div>
                                        <div className="text-xl font-bold text-blue-600 mt-1">
                                            {formatCurrency(summary.totals?.input_tax || 0)}
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 rounded-lg shadow-sm">
                                        <div className="text-sm text-gray-600">WHT Deducted</div>
                                        <div className="text-xl font-bold text-green-600 mt-1">
                                            {formatCurrency(summary.totals?.wht_deducted || 0)}
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 rounded-lg shadow-sm">
                                        <div className="text-sm text-gray-600">Total Bills</div>
                                        <div className="text-xl font-bold text-orange-600 mt-1">
                                            {summary.counts?.total_bills || 0}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Report Content */}
                <div className="p-6">
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <p className="mt-4 text-gray-600">Loading report...</p>
                        </div>
                    ) : (
                        <>
                            {activeRegister === 'sales' && <SalesRegisterTable data={salesRegister} formatCurrency={formatCurrency} />}
                            {activeRegister === 'purchase' && <PurchaseRegisterTable data={purchaseRegister} formatCurrency={formatCurrency} />}
                            {activeRegister === 'sales-by-product' && <SalesByProductTable data={salesByProduct} formatCurrency={formatCurrency} />}
                            {activeRegister === 'sales-by-customer' && <SalesByCustomerTable data={salesByCustomer} formatCurrency={formatCurrency} />}
                            {activeRegister === 'purchase-by-vendor' && <PurchaseByVendorTable data={purchaseByVendor} formatCurrency={formatCurrency} />}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// Sales Register Table
function SalesRegisterTable({ data, formatCurrency }: any) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Discount</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tax</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{row.sale_date}</td>
                            <td className="px-4 py-3 text-sm font-medium text-blue-600">{row.invoice_number}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{row.customer_name}</td>
                            <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${row.sale_type === 'POS' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                                    }`}>
                                    {row.sale_type}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(row.subtotal)}</td>
                            <td className="px-4 py-3 text-sm text-right text-red-600">{formatCurrency(row.discount_amount)}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(row.tax_amount)}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{formatCurrency(row.total_amount)}</td>
                            <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${row.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                                    row.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-red-100 text-red-800'
                                    }`}>
                                    {row.payment_status}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// Purchase Register Table
function PurchaseRegisterTable({ data, formatCurrency }: any) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bill #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO #</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tax</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">WHT</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{row.bill_date}</td>
                            <td className="px-4 py-3 text-sm font-medium text-blue-600">{row.bill_number}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{row.vendor_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{row.po_number}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(row.subtotal)}</td>
                            <td className="px-4 py-3 text-sm text-right text-blue-600">{formatCurrency(row.sales_tax_amount)}</td>
                            <td className="px-4 py-3 text-sm text-right text-green-600">{formatCurrency(row.wht_amount)}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{formatCurrency(row.total_amount)}</td>
                            <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${row.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                                    row.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-red-100 text-red-800'
                                    }`}>
                                    {row.payment_status}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// Sales by Product Table
function SalesByProductTable({ data, formatCurrency }: any) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Sales</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Price</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Transactions</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">#{idx + 1}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{row.product_sku}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{row.product_name}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">{row.total_quantity}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-green-600">{formatCurrency(row.total_sales)}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(row.avg_price)}</td>
                            <td className="px-4 py-3 text-sm text-center text-blue-600">{row.transaction_count}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// Sales by Customer Table
function SalesByCustomerTable({ data, formatCurrency }: any) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Sales</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Transactions</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">#{idx + 1}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{row.customer_code}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{row.customer_name}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-green-600">{formatCurrency(row.total_sales)}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(row.total_paid)}</td>
                            <td className="px-4 py-3 text-sm text-right text-orange-600">{formatCurrency(row.outstanding)}</td>
                            <td className="px-4 py-3 text-sm text-center text-blue-600">{row.transaction_count}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// Purchase by Vendor Table
function PurchaseByVendorTable({ data, formatCurrency }: any) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Purchases</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Bills</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">#{idx + 1}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{row.vendor_code}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{row.vendor_name}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-purple-600">{formatCurrency(row.total_purchases)}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(row.total_paid)}</td>
                            <td className="px-4 py-3 text-sm text-right text-orange-600">{formatCurrency(row.outstanding)}</td>
                            <td className="px-4 py-3 text-sm text-center text-blue-600">{row.bill_count}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
