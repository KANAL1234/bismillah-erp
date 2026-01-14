# Bismillah ERP

A comprehensive, modern Enterprise Resource Planning (ERP) system built for **Bismillah Oil Agency**. This application manages the complete business lifecycle including Inventory, Procurement, Sales, Point of Sale (POS), Accounting, and detailed Reporting.

## 🚀 Key Features

### 🔐 User & Role Management (RBAC)
- **Secure Authentication**: Powered by Supabase Auth.
- **Role-Based Access Control**: Granular permission management (View, Create, Edit, Delete) for every module.
- **System Admin Override**: Safety mechanisms to prevent admin lockouts.
- **Location Access**: Limit users to specific stores or warehouses.

### 📦 Inventory Management
- **Multi-Location Support**: Track stock across warehouses and stores.
- **Stock Movements**: Transfers, Adjustments, and Real-time stock tracking.
- **Product Catalog**: SKU management, Categories, and Variant pricing.

### 🛒 Point of Sale (POS)
- **Fast Checkout**: Designed for high-volume retail operations.
- **Walk-in Customers**: Quick handling of diverse customer types.
- **Daily Closing**: Cash reconciliation and sales summaries.

### 🛍️ Procurement & Purchasing
- **Purchase Orders (PO)**: Workflow from Draft -> Approval -> Receiving.
- **Goods Receipt Notes (GRN)**: Auto-updates inventory upon receipt.
- **Vendor Management**: Track vendor balances and contact details.

### 💼 B2B Sales
- **Quotations & Estimates**: Convert quotes to orders with one click.
- **Sales Orders & Deliveries**: Track fulfillment and shipping.
- **Credit Limits**: Automatic blocking of sales if customer exceeds credit limit.

### 📊 Accounting & Finance
- **Double-Entry General Ledger**: Automated journal entries for all transactions.
- **Chart of Accounts**: Customizable financial structure.
- **Reports**: Trial Balance, Profit & Loss, Balance Sheet, and Transaction Registers.

## 🛠️ Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Directory)
- **Language**: TypeScript
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)

## ⚙️ Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-repo/bismillah-erp.git
    cd bismillah-erp
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Configuration:**
    Create a `.env.local` file in the root directory and add your Supabase credentials:

    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
    ```
    > **Note:** The `SUPABASE_SERVICE_ROLE_KEY` is required for advanced User Management features (creating users, assigning roles).

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) to view the app.

## 🚀 Deployment (Vercel)

This application is optimized for deployment on [Vercel](https://vercel.com/):

1.  Push your code to a Git provider (GitHub, GitLab, Bitbucket).
2.  Import the project into Vercel.
3.  **Build Settings**: Leave the "Root Directory" empty.
4.  **Environment Variables**: Add the `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in the Vercel Project Settings.
5.  Click **Deploy**.

## 🛡️ Security

- **Row Level Security (RLS)**: Database policies ensure data isolation and security.
- **Middleware Proxy**: Protected routes are guarded against unauthorized access.
- **Input Validation**: Server Actions validation to prevent improper data entry.
