# Bismillah ERP - Future Features Roadmap

**Last Updated**: January 14, 2026  
**Version**: 1.5.0  
**Status**: 📋 **PLANNING DOCUMENT**

---

## ✅ Recently Completed Features (v1.4.0 - v1.5.0)

### **Fleet Business Workflow** ✅ COMPLETED (v1.4.0)
- Cash deposit tracking with variance detection
- Fuel allowance management
- Expense variance alerts dashboard
- Manager approval workflow
- Full GL integration

### **FBR Tax Reports** ✅ COMPLETED (v1.5.0)
- Sales Tax Monthly Return (FBR-compliant)
- Withholding Tax (WHT) Monthly Return
- Excel export for FBR submission
- Period selection and automatic calculations

### **UI/UX Polish** ✅ COMPLETED (v1.5.0)
- Universal Excel export utilities
- Professional PDF generation (invoices, payslips)
- Print templates for all documents
- One-click exports across the system

---

## 📊 Executive Summary

This document catalogs all database tables and features that exist in the schema but are **not yet implemented** in the frontend application. These represent strategic opportunities for future development and system enhancement.

### Quick Stats
- **Total Unimplemented Tables**: 13
- **Partially Implemented**: 4
- **High Priority Features**: 5
- **Medium Priority Features**: 4
- **Low Priority Features**: 4

---

## 🎯 Priority Matrix

### 🔴 **HIGH PRIORITY** (Business Critical)

#### 1. **Barcode Scanning System**
**Status**: 📦 Not Implemented  
**Database Table**: `product_barcodes`  
**Business Impact**: ⭐⭐⭐⭐⭐

**Current Schema:**
```sql
CREATE TABLE public.product_barcodes (
    id uuid PRIMARY KEY,
    product_id uuid REFERENCES products(id),
    barcode text UNIQUE NOT NULL,
    barcode_type text, -- EAN-13, UPC, QR, etc.
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);
```

**Use Cases:**
- Fast POS checkout with barcode scanner
- Inventory receiving with handheld devices
- Stock counting automation
- Product lookup in warehouse

**Implementation Requirements:**
- Frontend: Barcode scanner integration (USB/Bluetooth)
- UI: Barcode management in product form
- API: Barcode lookup endpoint
- Mobile: Camera-based barcode scanning

**Estimated Effort**: 2-3 weeks  
**ROI**: High (reduces checkout time by 60%)

---

#### 2. **Cost Center Tracking**
**Status**: 📦 Not Implemented  
**Database Table**: `cost_centers`  
**Business Impact**: ⭐⭐⭐⭐⭐

**Current Schema:**
```sql
CREATE TABLE public.cost_centers (
    id uuid PRIMARY KEY,
    code text UNIQUE NOT NULL,
    name text NOT NULL,
    department_id uuid REFERENCES departments(id),
    manager_id uuid REFERENCES employees(id),
    budget_amount numeric(15,2),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);
```

**Use Cases:**
- Department-wise expense tracking
- Budget vs. actual analysis
- Profitability by cost center
- Management reporting

**Implementation Requirements:**
- Frontend: Cost center master data page
- UI: Expense allocation to cost centers
- Reports: Cost center P&L
- Integration: Link to GL entries

**Estimated Effort**: 3-4 weeks  
**ROI**: High (enables departmental accountability)

---

#### 3. **Financial Period Management**
**Status**: 📦 Not Implemented  
**Database Tables**: `financial_periods`, `financial_years`  
**Business Impact**: ⭐⭐⭐⭐⭐

**Current Schema:**
```sql
CREATE TABLE public.financial_years (
    id uuid PRIMARY KEY,
    year_code text UNIQUE NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_current boolean DEFAULT false,
    is_closed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.financial_periods (
    id uuid PRIMARY KEY,
    financial_year_id uuid REFERENCES financial_years(id),
    period_number integer NOT NULL,
    period_name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_closed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);
```

**Use Cases:**
- Period-end closing procedures
- Prevent backdated transactions
- Year-end financial statements
- Audit trail and compliance

**Implementation Requirements:**
- Frontend: Financial calendar setup
- UI: Period closing workflow
- Validation: Date range checks on transactions
- Reports: Period-wise financial statements

**Estimated Effort**: 4-5 weeks  
**ROI**: High (ensures accounting compliance)

---

#### 4. **Sales Commission Tracking**
**Status**: 📦 Not Implemented  
**Database Table**: `sales_commissions`  
**Business Impact**: ⭐⭐⭐⭐

**Current Schema:**
```sql
CREATE TABLE public.sales_commissions (
    id uuid PRIMARY KEY,
    employee_id uuid REFERENCES employees(id),
    period_start date NOT NULL,
    period_end date NOT NULL,
    total_sales numeric(15,2) DEFAULT 0,
    commission_rate numeric(5,2) NOT NULL,
    commission_amount numeric(15,2) NOT NULL,
    payslip_id uuid REFERENCES payslips(id),
    notes text,
    created_at timestamp with time zone DEFAULT now()
);
```

**Use Cases:**
- Automated commission calculation
- Sales performance tracking
- Payroll integration
- Incentive management

**Implementation Requirements:**
- Frontend: Commission setup page
- UI: Commission calculation rules
- Automation: Link sales to employees
- Reports: Commission statements

**Estimated Effort**: 3-4 weeks  
**ROI**: High (motivates sales team)

---

#### 5. **Multi-Supplier Product Management**
**Status**: 📦 Not Implemented  
**Database Table**: `product_suppliers`  
**Business Impact**: ⭐⭐⭐⭐

**Current Schema:**
```sql
CREATE TABLE public.product_suppliers (
    id uuid PRIMARY KEY,
    product_id uuid REFERENCES products(id),
    vendor_id uuid REFERENCES vendors(id),
    vendor_product_code text,
    unit_cost numeric(15,2),
    lead_time_days integer,
    minimum_order_qty numeric(15,3),
    is_preferred boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(product_id, vendor_id)
);
```

**Use Cases:**
- Multiple vendor pricing comparison
- Automatic vendor selection on PO
- Vendor performance tracking
- Supply chain optimization

**Implementation Requirements:**
- Frontend: Supplier management in product form
- UI: Vendor comparison view
- Logic: Auto-select best vendor
- Reports: Vendor pricing analysis

**Estimated Effort**: 2-3 weeks  
**ROI**: Medium-High (optimizes procurement)

---

### 🟡 **MEDIUM PRIORITY** (Operational Enhancement)

#### 6. **Employee Document Management**
**Status**: 📦 Not Implemented  
**Database Table**: `employee_documents`  
**Business Impact**: ⭐⭐⭐

**Current Schema:**
```sql
CREATE TABLE public.employee_documents (
    id uuid PRIMARY KEY,
    employee_id uuid REFERENCES employees(id),
    document_type text NOT NULL, -- CNIC, Contract, Certificate
    document_name text NOT NULL,
    file_path text NOT NULL,
    file_size integer,
    uploaded_by uuid REFERENCES user_profiles(id),
    expiry_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);
```

**Use Cases:**
- HR document repository
- Contract expiry alerts
- Compliance documentation
- Onboarding checklist

**Implementation Requirements:**
- Frontend: Document upload interface
- Storage: Supabase Storage integration
- UI: Document viewer
- Alerts: Expiry notifications

**Estimated Effort**: 2-3 weeks  
**ROI**: Medium (improves HR compliance)

---

#### 7. **Job Designation Master**
**Status**: 📦 Not Implemented  
**Database Table**: `designations`  
**Business Impact**: ⭐⭐⭐

**Current Schema:**
```sql
CREATE TABLE public.designations (
    id uuid PRIMARY KEY,
    code text UNIQUE NOT NULL,
    title text NOT NULL,
    department_id uuid REFERENCES departments(id),
    grade_level integer,
    min_salary numeric(15,2),
    max_salary numeric(15,2),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);
```

**Use Cases:**
- Standardized job titles
- Salary range enforcement
- Organizational hierarchy
- Career progression tracking

**Implementation Requirements:**
- Frontend: Designation master page
- UI: Link to employee records
- Validation: Salary range checks
- Reports: Org chart

**Estimated Effort**: 1-2 weeks  
**ROI**: Medium (standardizes HR data)

---

#### 8. **Late Arrival Tracking**
**Status**: 📦 Not Implemented  
**Database Table**: `late_arrivals`  
**Business Impact**: ⭐⭐⭐

**Current Schema:**
```sql
CREATE TABLE public.late_arrivals (
    id uuid PRIMARY KEY,
    employee_id uuid REFERENCES employees(id),
    attendance_id uuid REFERENCES attendance(id),
    late_by_minutes integer NOT NULL,
    penalty_amount numeric(10,2),
    reason text,
    approved_by uuid REFERENCES employees(id),
    created_at timestamp with time zone DEFAULT now()
);
```

**Use Cases:**
- Attendance discipline
- Payroll deductions
- Performance reviews
- HR analytics

**Implementation Requirements:**
- Frontend: Late arrival management
- Automation: Auto-detect from attendance
- UI: Approval workflow
- Integration: Link to payroll

**Estimated Effort**: 2 weeks  
**ROI**: Medium (improves punctuality)

---

#### 9. **System Settings Management**
**Status**: 📦 Not Implemented  
**Database Table**: `system_settings`  
**Business Impact**: ⭐⭐⭐

**Current Schema:**
```sql
CREATE TABLE public.system_settings (
    id uuid PRIMARY KEY,
    setting_key text UNIQUE NOT NULL,
    setting_value text,
    setting_type text, -- STRING, NUMBER, BOOLEAN, JSON
    category text, -- GENERAL, ACCOUNTING, INVENTORY, etc.
    description text,
    is_encrypted boolean DEFAULT false,
    updated_by uuid REFERENCES user_profiles(id),
    updated_at timestamp with time zone DEFAULT now()
);
```

**Use Cases:**
- Global configuration
- Feature toggles
- Business rules
- System customization

**Implementation Requirements:**
- Frontend: Settings management page
- UI: Category-wise settings
- Security: Encryption for sensitive data
- Validation: Type-safe updates

**Estimated Effort**: 2-3 weeks  
**ROI**: Medium (centralizes configuration)

---

### 🟢 **LOW PRIORITY** (Nice to Have)

#### 10. **Enhanced Leave Management**
**Status**: ⚠️ Partially Implemented  
**Database Table**: `employee_leaves`  
**Business Impact**: ⭐⭐

**Current Status:**
- Basic leave request exists in `employee_advances` (misnamed)
- Dedicated `employee_leaves` table exists but unused

**Implementation Requirements:**
- Migrate from current implementation
- Add leave balance tracking
- Calendar integration
- Approval workflow

**Estimated Effort**: 2 weeks  
**ROI**: Low (current system works)

---

#### 11. **Detailed Payslip Components**
**Status**: ⚠️ Partially Implemented  
**Database Tables**: `salary_components`, `payslip_details`  
**Business Impact**: ⭐⭐

**Current Status:**
- Basic payroll exists
- Component breakdown not implemented

**Implementation Requirements:**
- Component master setup
- Payslip line-item breakdown
- Tax calculation engine
- Detailed payslip report

**Estimated Effort**: 3-4 weeks  
**ROI**: Low (current payroll sufficient)

---

## 🗺️ Suggested Implementation Order

### **Quarter 1 (High ROI, Quick Wins)**
1. Barcode Scanning System (3 weeks)
2. Multi-Supplier Product Management (3 weeks)
3. Job Designation Master (2 weeks)

### **Quarter 2 (Financial Compliance)**
4. Financial Period Management (5 weeks)
5. Cost Center Tracking (4 weeks)

### **Quarter 3 (Sales & HR)**
6. Sales Commission Tracking (4 weeks)
7. Employee Document Management (3 weeks)
8. Late Arrival Tracking (2 weeks)

### **Quarter 4 (System Enhancement)**
9. System Settings Management (3 weeks)
10. Enhanced Leave Management (2 weeks)
11. Detailed Payslip Components (4 weeks)

---

## 📊 Resource Requirements

### **Development Team**
- **1 Full-Stack Developer**: 6-8 months full-time
- **1 UI/UX Designer**: 2-3 months part-time
- **1 QA Engineer**: 3-4 months part-time

### **Infrastructure**
- Supabase Storage (for document management)
- Barcode scanner hardware (USB/Bluetooth)
- Additional database storage (estimated +500MB)

### **Training**
- User training sessions (2 hours per feature)
- Documentation updates
- Video tutorials

---

## 🎯 Success Metrics

### **Barcode Scanning**
- Checkout time reduced by 60%
- Inventory accuracy improved to 99%+

### **Cost Center Tracking**
- 100% expense allocation
- Monthly budget variance reports

### **Financial Periods**
- Zero backdated transactions
- Audit-ready financial statements

### **Sales Commissions**
- Automated commission calculation
- 95% employee satisfaction

---

## 📝 Notes

- All tables are **already created** in the database
- No schema changes required for implementation
- Focus is on **frontend development** and **business logic**
- Existing RLS policies need to be reviewed for new features

---

## 🔗 Related Documents

- [README.md](./README.md) - System overview and quick start
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Current system status
- [supabase/migrations/00000000000000_complete_schema.sql](./supabase/migrations/00000000000000_complete_schema.sql) - Database schema

---

**Last Review**: January 14, 2026  
**Next Review**: March 1, 2026  
**Owner**: Development Team
