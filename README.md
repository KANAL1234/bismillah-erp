# Bismillah ERP System

**Version**: 1.5.0  
**Status**: ✅ Production Ready  
**Last Updated**: January 14, 2026

---

## 📊 System Overview

A comprehensive, full-stack Enterprise Resource Planning (ERP) solution built with Next.js 16, TypeScript, and Supabase (PostgreSQL). Designed for small to medium businesses with complete modules for inventory, sales, procurement, accounting, HR, and fleet management.

### Key Metrics
- **Total Pages**: 57+ routes
- **Modules**: 11 (Dashboard, Products, Inventory, POS, Sales, Purchases, Vendors, Accounting, HR, Fleet, Settings)
- **Database Functions**: 60+ RPCs and triggers
- **Test Coverage**: 16/16 (100%)
- **Build Status**: ✅ 0 errors, 0 warnings

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account

### Installation

```bash
# Clone the repository
cd bismillah-erp

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your Supabase credentials

# Run development server
npm run dev
```

Visit `http://localhost:3000`

---

## 📦 Core Modules

### 1. **Dashboard & Analytics**
- Real-time business metrics
- Sales performance tracking
- Inventory health monitoring
- Fleet operations overview
- Quick actions and shortcuts

### 2. **Inventory Management**
- Multi-location stock tracking
- AVCO/FIFO costing methods
- Stock adjustments & transfers
- Inventory valuation reports
- Low stock alerts

### 3. **Point of Sale (POS)**
- Fast checkout interface
- Barcode scanning support
- Multiple payment methods
- Receipt printing
- Daily sales reports

### 4. **Sales & Customers**
- Customer management (B2B/B2C)
- Sales invoices with tax
- Payment tracking
- Credit management
- Sales reports

### 5. **Procurement**
- Vendor management
- Purchase orders
- Purchase invoices
- Payment tracking
- Vendor reports

### 6. **Accounting**
- Chart of Accounts
- Journal Entries
- Bank Accounts
- Trial Balance
- **FBR Tax Reports** (Pakistan):
  - Sales Tax Monthly Return
  - Withholding Tax (WHT) Return

### 7. **Human Resources**
- Employee management
- Attendance tracking
- Payroll processing
- Advances & loans
- Leave management

### 8. **Fleet Management**
- Vehicle tracking
- Driver management
- Trip planning & GPS tracking
- Fuel & maintenance logs
- **Business Workflow**:
  - Cash deposit tracking
  - Fuel allowance management
  - Variance alerts dashboard
  - Accounting integration

### 9. **Settings & Security**
- User management
- Role-based permissions
- Location management
- System configuration

---

## 🆕 Latest Features (v1.5.0)

### FBR Tax Reports (Pakistan Compliance)
- **Sales Tax Monthly Return**: FBR-compliant format with Excel export
- **WHT Monthly Return**: Breakdown by vendor and transaction type
- Period selection (last 12 months)
- Automatic tax calculations
- Print functionality

### UI/UX Enhancements
- **Universal Excel Export**: For all reports
- **PDF Generation**: 
  - Professional invoices
  - Employee payslips
- **Print Templates**: Optimized for all documents
- One-click exports across the system

### Fleet Business Workflow
- End-of-day cash deposit tracking
- Fuel allowance management
- Automated variance detection
- Manager approval workflow
- Full GL integration

---

## 🗄️ Database Schema

### Core Tables
- **Products & Inventory**: `products`, `inventory_stock`, `inventory_cost_layers`
- **Sales**: `customers`, `sales_invoices`, `sales_invoice_items`
- **Procurement**: `vendors`, `purchase_orders`, `purchase_invoices`
- **Accounting**: `chart_of_accounts`, `journal_entries`, `bank_accounts`
- **HR**: `employees`, `attendance`, `payroll`, `advances`
- **Fleet**: `fleet_vehicles`, `fleet_drivers`, `fleet_trips`, `fleet_cash_deposits`, `fleet_fuel_allowances`

### Key Features
- **RLS Policies**: Row-level security on all tables
- **Triggers**: Automated workflows (inventory updates, GL posting, etc.)
- **Functions**: 60+ PostgreSQL functions for business logic
- **Indexes**: Optimized for performance

---

## 📊 Reports Available

### Inventory
- Stock Valuation (AVCO/FIFO)
- Stock Movement
- Low Stock Report

### Sales
- Sales Summary
- Customer Aging
- Sales by Product

### Accounting
- Trial Balance
- Profit & Loss
- Balance Sheet
- Sales Tax Return (FBR)
- WHT Return (FBR)

### HR
- Payroll Summary
- Attendance Report
- Advances Report

### Fleet
- Trip History
- Fuel Consumption
- Maintenance Schedule
- Variance Dashboard

---

## 🔐 Security & Permissions

### Role-Based Access Control
- Granular permissions per module
- User-level access control
- Location-based restrictions
- Audit trail for all transactions

### Permissions Format
```
module:feature:action
Example: inventory:stock:view
```

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn/ui
- **State Management**: React Query (TanStack Query)
- **Forms**: React Hook Form + Zod validation

### Backend
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **Real-time**: Supabase Realtime

### Export & Reporting
- **Excel**: xlsx
- **PDF**: jsPDF + jspdf-autotable
- **Charts**: Recharts

---

## 📖 Documentation

### Main Documents
- **IMPLEMENTATION_SUMMARY.md**: Complete feature list and technical details
- **FBR_AND_EXPORT_COMPLETE.md**: FBR tax reports and export utilities guide
- **FLEET_WORKFLOW_COMPLETE.md**: Fleet business workflow documentation
- **FUTURE_FEATURES_ROADMAP.md**: Planned enhancements

### Code Documentation
- Inline comments for complex logic
- TypeScript interfaces for all data structures
- README files in key directories

---

## 🧪 Testing

### System Health Tests
Access: `/system-health`

Tests all modules:
- ✅ Products & Inventory
- ✅ Sales & Customers
- ✅ Procurement & Vendors
- ✅ Accounting & GL
- ✅ HR & Payroll
- ✅ Fleet Management
- ✅ User Management

### Running Tests
```bash
# Navigate to system health page
http://localhost:3000/system-health

# Click "Run All Tests"
# All 16 tests should pass
```

---

## 🚀 Deployment

### Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
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

### Database Migration
1. Go to Supabase Dashboard → SQL Editor
2. Run migration file: `supabase/migrations/20260114170500_fleet_business_workflow.sql`
3. Verify tables and functions created

---

## 📞 Support & Maintenance

### Common Issues

**Issue**: Migration fails  
**Solution**: Ensure all prerequisite tables exist (chart_of_accounts, fleet_trips, etc.)

**Issue**: Permission denied  
**Solution**: Check RLS policies and user permissions in Settings → Role Management

**Issue**: Export not working  
**Solution**: Ensure xlsx and jspdf packages are installed

### System Requirements
- **Minimum**: 2GB RAM, 10GB storage
- **Recommended**: 4GB RAM, 20GB storage
- **Browser**: Chrome, Firefox, Safari (latest versions)

---

## 🔮 Future Enhancements

See `FUTURE_FEATURES_ROADMAP.md` for detailed roadmap including:
- Advanced inventory features
- Multi-currency support
- Email automation
- Mobile app
- Advanced analytics

---

## 📄 License

Proprietary - All rights reserved

---

## 👥 Credits

**Development Team**: Bismillah ERP Development Team  
**Built with**: Next.js, Supabase, TypeScript, Tailwind CSS

---

## 📞 Contact

For support or inquiries, please contact your system administrator.

---

**Version History**:
- v1.0.0 - Initial release
- v1.1.0 - Inventory & POS
- v1.2.0 - Accounting & HR
- v1.3.0 - UI/UX Standardization
- v1.4.0 - Fleet Business Workflow
- v1.5.0 - FBR Tax Reports + UI/UX Polish ⭐ **CURRENT**
