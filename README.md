# Bismillah ERP System

**Version**: 2.0.0  
**Status**: ✅ Production Ready  
**Last Updated**: January 15, 2026

---

## 📊 System Overview

A comprehensive, full-stack Enterprise Resource Planning (ERP) solution built with Next.js 16, TypeScript, and Supabase (PostgreSQL). Designed for small to medium businesses with complete modules for inventory, sales, procurement, accounting, HR, and fleet management.

### Key Metrics
- **Total Routes**: 88+ pages
- **Modules**: 13 (Dashboard, Products, Inventory, POS, Sales, Purchases, Procurement, Vendors, Accounting, HR, Fleet, Reports, Settings)
- **Database Functions**: 73+ stored procedures and triggers
- **Query Hooks**: 27 React Query hooks
- **Build Status**: ✅ Production build successful
- **Mobile Support**: ✅ PWA enabled with offline capabilities

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account

### Installation

```bash
# Navigate to project directory
cd bismillah-erp

# Install dependencies
npm install

# Set up environment variables
# Create .env.local with:
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Run development server
npm run dev
```

Visit `http://localhost:3000`

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

---

## 📦 Core Modules

### 1. **Dashboard & Analytics**
- Real-time business metrics and KPIs
- Sales performance tracking
- Inventory health monitoring
- Fleet operations overview
- Quick actions and shortcuts
- Revenue trends and charts

### 2. **Product Management**
- Product master data (SKU, name, category, UOM)
- Multi-location stock tracking
- Pricing management (purchase, sale, retail)
- Product categories and units of measure
- Barcode support
- Stock level indicators

### 3. **Inventory Management**
- **Multi-location stock tracking** with location-based access control
- **Stock valuation** with AVCO (Average Cost) and FIFO methods
- **Cost layer tracking** for accurate COGS calculation
- **Stock transfers** between locations
- **Stock adjustments** with approval workflow
- **Inventory valuation reports** with detailed cost analysis
- Low stock alerts and reorder management

### 4. **Point of Sale (POS)**
- Fast checkout interface optimized for retail
- Barcode scanning support
- Multiple payment methods (Cash, Card, Credit)
- Customer selection for credit sales
- Receipt printing
- Daily sales reports and cash closing
- **Mobile POS** with offline sync capabilities

### 5. **Sales & Customers (B2B)**
Complete sales pipeline workflow:
- **Sales Quotations** - Customer quotes with approval
- **Sales Orders** - Order management and tracking
- **Delivery Notes** - Goods delivery with COGS posting
- **Sales Invoices** - Customer invoicing with tax
- **Sales Returns** - Return processing with inventory reversal
- **Customer Management** - B2B/B2C customer profiles
- **Credit Management** - Credit limits and aging reports
- **Payment Tracking** - Receipt vouchers and allocation

### 6. **Procurement & Vendors**
Complete procurement workflow:
- **Vendors** - Vendor master data with NTN tracking
- **Purchase Orders** - PO creation, approval, and tracking
- **Goods Receipt Notes (GRN)** - Receiving with quality checks
- **Vendor Bills** - Automatic bill creation from GRN
- **Payment Vouchers** - Vendor payment processing
- **WHT Tracking** - Withholding tax calculation and reporting

### 7. **Accounting & Finance**
Complete double-entry accounting system:
- **Chart of Accounts** - Hierarchical account structure
- **Journal Entries** - Manual and automated GL postings
- **Bank Accounts** - Bank account management and reconciliation
- **Trial Balance** - Real-time trial balance with drill-down
- **Financial Reports**:
  - Profit & Loss Statement
  - Balance Sheet
  - Account Ledgers
  - Transaction Registers
- **FBR Tax Reports** (Pakistan Compliance):
  - Sales Tax Monthly Return
  - Withholding Tax (WHT) Return
  - Excel export for FBR submission
- **Automated GL Posting** for all transactions

### 8. **Human Resources & Payroll**
- **Employee Management** - Employee master data with CNIC
- **Attendance Tracking** - Daily check-in/check-out
- **Leave Management** - Leave requests and approvals
- **Advances & Loans** - Employee advance tracking
- **Payroll Processing** - Automated salary calculation
- **Payslip Generation** - Professional PDF payslips
- **Deductions** - Income tax, EOBI, and other deductions

### 9. **Fleet Management**
Complete fleet operations management:
- **Vehicles** - Vehicle registration and tracking
- **Drivers** - Driver management linked to employees
- **Trips** - Daily route assignments with GPS tracking
- **Fuel Logs** - Fuel consumption with efficiency tracking
- **Maintenance** - Service scheduling and history
- **Cash Deposits** - End-of-day cash reconciliation
- **Fuel Allowances** - Daily fuel budget management
- **Variance Dashboard** - Automated variance detection and alerts
- **GPS Tracking** - Real-time vehicle location (mobile app)
- **Accounting Integration** - Automatic GL posting for fleet expenses

### 10. **Reports & Analytics**
- **Inventory Reports** - Stock valuation, movement, aging
- **Sales Reports** - Sales summary, customer aging, product analysis
- **Purchase Reports** - Purchase summary, vendor aging
- **Accounting Reports** - Trial balance, P&L, balance sheet
- **Tax Reports** - Sales tax, WHT returns (FBR compliant)
- **HR Reports** - Payroll summary, attendance, advances
- **Fleet Reports** - Trip history, fuel consumption, maintenance

### 11. **Settings & Security**
- **User Management** - User accounts and authentication
- **Role-Based Access Control (RBAC)** - Granular permissions
- **Location Management** - Multi-location setup
- **Location-Based Access Control (LBAC)** - Location restrictions
- **Company Settings** - Tax rates, fiscal year, company info
- **System Configuration** - General settings and preferences

### 12. **Mobile Application**
Progressive Web App (PWA) with offline capabilities:
- **Mobile POS** - Offline-first POS with sync
- **Fuel Logging** - Mobile fuel entry for drivers
- **Inventory Checks** - Mobile stock counting
- **Trip Management** - GPS tracking and trip completion
- **Offline Sync** - Queue transactions when offline
- **Background Sync** - Automatic sync when online

---

## 🆕 Latest Features (v2.0.0)

### Accounting Integration Enhancements
- **Automated GL Posting** for all transactions:
  - Sales invoices → Revenue, AR, Tax
  - Vendor bills → Purchases, AP, WHT
  - Delivery notes → COGS, Inventory
  - Payment vouchers → AP, Cash/Bank
  - Receipt vouchers → AR, Cash/Bank
  - POS sales → Revenue, Cash, Tax
- **Real-time Account Balances** with trigger-based updates
- **Trial Balance as of Date** - Historical balance reporting
- **Customer/Vendor Aging Reports** - Improved accuracy

### Sales & Invoicing Improvements
- **Unified Invoice System** - POS sales sync to customer invoices
- **Standardized Invoice Prefixes** - SI for sales, PI for purchases
- **Location-based Invoicing** - Invoice location tracking
- **B2B Sales Pipeline** - Complete quote-to-cash workflow
- **COGS Posting on Delivery** - Accurate cost tracking

### Mobile & Offline Capabilities
- **PWA Support** - Install as mobile app
- **Offline Queue** - Transaction queuing when offline
- **Background Sync** - Automatic sync when connection restored
- **Mobile-optimized UI** - Touch-friendly interfaces
- **GPS Integration** - Real-time vehicle tracking

### Export & Reporting
- **Universal Excel Export** - All reports exportable to Excel
- **Professional PDF Generation**:
  - Sales invoices
  - Purchase orders
  - Employee payslips
  - Delivery notes
- **FBR Tax Reports** - Pakistan tax compliance
- **Print-optimized Layouts** - All documents print-ready

---

## 🗄️ Database Architecture

### Core Tables (50+)
- **Products & Inventory**: `products`, `product_categories`, `inventory_stock`, `inventory_cost_layers`, `stock_transfers`, `stock_adjustments`
- **Sales**: `customers`, `sales_quotations`, `sales_orders`, `delivery_notes`, `sales_invoices`, `sales_returns`, `customer_invoices`
- **Procurement**: `vendors`, `purchase_orders`, `goods_receipt_notes`, `vendor_bills`, `purchase_invoices`
- **Accounting**: `chart_of_accounts`, `journal_entries`, `journal_entry_lines`, `bank_accounts`, `fiscal_years`
- **Payments**: `payment_vouchers`, `receipt_vouchers`, `payment_allocations`
- **HR**: `employees`, `attendance`, `payroll`, `payroll_items`, `advances`, `leave_requests`, `leave_balance`
- **Fleet**: `fleet_vehicles`, `fleet_drivers`, `fleet_trips`, `fleet_fuel_logs`, `fleet_maintenance`, `fleet_cash_deposits`, `fleet_fuel_allowances`, `fleet_expense_variances`
- **System**: `users`, `user_profiles`, `roles`, `permissions`, `user_permissions`, `locations`, `user_locations`, `company_settings`

### Database Features
- **Row-Level Security (RLS)** - All tables secured with RLS policies
- **Triggers** - Automated workflows:
  - Inventory updates on transactions
  - GL posting on approvals
  - Balance updates on payments
  - Cost layer creation on receipts
  - COGS calculation on sales
- **Stored Procedures (73+)** - Business logic in PostgreSQL:
  - `post_vendor_bill()` - GL posting for vendor bills
  - `post_sales_invoice()` - GL posting for sales
  - `post_delivery_note()` - COGS posting
  - `process_grn_with_inventory()` - GRN processing
  - `update_account_balances()` - Account balance updates
  - `get_trial_balance()` - Trial balance calculation
  - `get_inventory_valuation()` - Inventory valuation
  - And 66 more...
- **Indexes** - Optimized for performance on all foreign keys and frequently queried columns
- **Views** - Reporting views for complex queries

---

## 📊 Reports Available

### Inventory
- Stock Valuation (AVCO/FIFO with cost layers)
- Stock Movement Report
- Low Stock Alert Report
- Inventory Aging Report

### Sales
- Sales Summary by Period
- Customer Aging Report
- Sales by Product/Category
- Top Customers Report
- Sales Tax Register

### Procurement
- Purchase Summary by Period
- Vendor Aging Report
- Purchase by Product/Category
- Top Vendors Report
- WHT Register

### Accounting
- Trial Balance (with as-of-date)
- Profit & Loss Statement
- Balance Sheet
- Account Ledger (detailed transactions)
- Sales Tax Return (FBR format)
- WHT Return (FBR format)
- Transaction Registers (Sales/Purchase)

### HR
- Payroll Summary Report
- Attendance Report
- Leave Balance Report
- Advances Report
- Employee Directory

### Fleet
- Trip History Report
- Fuel Consumption Analysis
- Maintenance Schedule
- Variance Dashboard
- Driver Performance Report
- Vehicle Utilization Report

---

## 🔐 Security & Permissions

### Multi-Layer Security
1. **Authentication** - Supabase Auth with email/password
2. **Role-Based Access Control (RBAC)** - Granular permissions per module
3. **Location-Based Access Control (LBAC)** - Multi-location data isolation
4. **Row-Level Security (RLS)** - Database-level security policies
5. **Audit Trail** - User action tracking on all transactions

### Permission Format
```
module:feature:action
Examples:
- inventory:stock:view
- sales:invoices:create
- accounting:journal_entries:approve
- hr:payroll:process
```

### Default Roles
- **Admin** - Full system access
- **Manager** - Module management and approvals
- **Accountant** - Accounting and financial reports
- **Cashier** - POS and payment processing
- **Warehouse** - Inventory and stock management
- **Sales** - Sales and customer management
- **HR** - Employee and payroll management

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 16.1.1 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **UI Components**: Shadcn/ui + Radix UI
- **State Management**: TanStack React Query v5
- **Forms**: React Hook Form + Zod validation
- **Icons**: Lucide React
- **Charts**: Recharts (via Shadcn)
- **Maps**: Leaflet + React Leaflet

### Backend
- **Database**: PostgreSQL 15+ (Supabase)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **Real-time**: Supabase Realtime subscriptions
- **Edge Functions**: Supabase Edge Functions

### Export & Reporting
- **Excel**: xlsx library
- **PDF**: jsPDF + jspdf-autotable
- **Date Handling**: date-fns

### Mobile & PWA
- **PWA**: next-pwa with Workbox
- **Offline Storage**: Dexie.js (IndexedDB wrapper)
- **Local Storage**: localforage
- **Service Worker**: Custom offline sync logic

---

## 🧪 Testing & Quality

### System Health Tests
Access: `/system-health`

Comprehensive test suite covering:
- ✅ Database connectivity
- ✅ Authentication
- ✅ Products & Inventory
- ✅ Stock Transfers & Adjustments
- ✅ POS Sales
- ✅ Purchase Workflow (PO → GRN → Bill)
- ✅ B2B Sales Workflow (Quote → Order → Delivery → Invoice → Return)
- ✅ Accounting & GL Posting
- ✅ Credit Limit Enforcement
- ✅ Transaction Registers
- ✅ Location Access Control
- ✅ User & Role Management
- ✅ Customer Management
- ✅ HR & Payroll
- ✅ Fleet Management

### Code Quality
- TypeScript strict mode enabled
- ESLint configured for Next.js
- Zero build errors or warnings
- Consistent code formatting
- Comprehensive error handling

---

## 🚀 Deployment

### Environment Variables
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Optional: Service Role Key (for admin operations)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Build & Deploy
```bash
# Build for production
npm run build

# Start production server
npm start

# Or deploy to Vercel
vercel deploy
```

### Database Setup
1. Create a Supabase project
2. Run the complete schema migration:
   - `supabase/migrations/00000000000000_complete_schema.sql`
3. Run additional migrations in order (by timestamp)
4. Verify all tables, functions, and triggers are created

### Post-Deployment Checklist
- [ ] Verify database connection
- [ ] Run system health tests
- [ ] Create admin user
- [ ] Configure company settings
- [ ] Set up locations
- [ ] Configure chart of accounts
- [ ] Set up product categories
- [ ] Configure tax rates
- [ ] Test critical workflows

---

## 📖 Documentation

### Main Documents
- **IMPLEMENTATION_SUMMARY.md** - Complete technical implementation details
- **FUTURE_FEATURES_ROADMAP.md** - Planned enhancements and roadmap

### Code Documentation
- Inline comments for complex business logic
- TypeScript interfaces for all data structures
- JSDoc comments on utility functions
- README files in key directories

---

## 📞 Support & Maintenance

### Common Issues

**Issue**: Build fails with TypeScript errors  
**Solution**: Run `npm install` to ensure all dependencies are installed. Check TypeScript version compatibility.

**Issue**: Database migration fails  
**Solution**: Ensure migrations are run in order. Check for prerequisite tables and functions.

**Issue**: Permission denied errors  
**Solution**: Verify RLS policies are enabled. Check user permissions in Settings → Roles.

**Issue**: Offline sync not working  
**Solution**: Ensure service worker is registered. Check browser console for sync errors.

**Issue**: Reports not loading  
**Solution**: Verify database functions exist. Check for missing indexes on large tables.

### System Requirements
- **Minimum**: 2GB RAM, 10GB storage, Modern browser (Chrome/Firefox/Safari)
- **Recommended**: 4GB RAM, 20GB storage, Chrome latest
- **Database**: PostgreSQL 15+, 5GB storage minimum
- **Network**: Stable internet for real-time features

---

## 🔮 Future Enhancements

See `FUTURE_FEATURES_ROADMAP.md` for detailed roadmap including:
- Multi-currency support
- Advanced analytics and BI dashboards
- Email automation and notifications
- Native mobile apps (iOS/Android)
- API for third-party integrations
- Advanced inventory features (serial numbers, batch tracking)
- Manufacturing module
- CRM integration
- E-commerce integration

---

## 📄 License

Proprietary - All rights reserved

---

## 👥 Credits

**Development**: Bismillah ERP Development Team  
**Technology**: Next.js, Supabase, TypeScript, Tailwind CSS  
**UI Components**: Shadcn/ui, Radix UI  

---

## 📞 Contact

For support or inquiries, please contact your system administrator.

---

## 📝 Version History

- **v1.0.0** - Initial release with core modules
- **v1.1.0** - Inventory & POS implementation
- **v1.2.0** - Accounting & HR modules
- **v1.3.0** - UI/UX standardization
- **v1.4.0** - Fleet business workflow
- **v1.5.0** - FBR tax reports + UI/UX polish
- **v2.0.0** - Accounting integration, mobile PWA, sales pipeline ⭐ **CURRENT**

---

**Built with ❤️ for efficient business management**
