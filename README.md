# PayFlow GST 💼

**Live Application**: [https://payflow-gst.vercel.app/](https://payflow-gst.vercel.app/)  
**Backend API**: [https://payflow-gst-backend.onrender.com](https://payflow-gst-backend.onrender.com) *(Note: Since the backend is hosted on Render's free tier, the initial request may take up to a minute to spin up if the service has been inactive and gone cold.)*

**PayFlow GST** is a multi-tenant, role-based SaaS billing and receivable tracking platform engineered specifically for Indian SMEs. It enables businesses to generate fully GST-compliant tax invoices, perform customer aging analysis, track receipts, log audit events, and export tax logs.

Built with a scalable **MERN + TypeScript** architecture, the platform enforces strict tenant isolation, type-safe API communication, and a sleek Material UI (MUI) design system with slate-emerald accents and fluid micro-animations.

---

## ⚡ Key Features

* **Multi-Tenant Architecture**: Robust isolation across business workspaces. Users only access data linked to their business scope.
* **Role-Based Access Control (RBAC)**: Fine-grained permissions for **Owner**, **Manager**, and **Staff** roles.
* **GST Compliance Engine**: Automated calculation of CGST, SGST, and IGST based on counterparty state codes (e.g., matching the prefix of GSTINs like `27AAAAA1111A1Z1`). Supports 5%, 12%, 18%, and 28% slabs.
* **Dynamic Invoicing**: Interactive invoice creator supporting live math updates (tax sums, discounts, and item additions) and generating custom, printable base64/HTML drafts.
* **Customer Ledgers & Aging Buckets**: Real-time accounts receivable aging analysis broken down into `0-30`, `31-60`, `61-90`, and `90+` day intervals.
* **Payment Log Tracking**: Logs full and partial receipts (UPI, Bank Transfer, Cash, Cheque) with automated invoice state transitions.
* **Audit Logging**: Fully automated database-backed change tracking logs for secure financial operations.

---

## 🛠️ Tech Stack & System Architecture

### Frontend
* **Core**: React 19, TypeScript, Vite
* **UI & Styling**: Material UI (MUI) v9 (custom slate/emerald palette, Outfit & Inter typography, glassmorphism modules)
* **Form & Validation**: React Hook Form + Zod
* **Data Fetching**: TanStack Query (React Query)
* **Charts**: Recharts (for receivables aging and income summaries)

### Backend
* **Core**: Node.js, Express, TypeScript
* **Database & ORM**: PostgreSQL + Prisma ORM
* **Authentication**: JSON Web Tokens (JWT) with secure HTTP headers
* **Logging**: Winston + Morgan

---

## 🗄️ Database Design

The database schema enforces relational integrity and cascade policies under multi-tenant scoping. Here is the Entity-Relationship (ER) model:

```mermaid
erDiagram
    Business ||--o{ User : "has team"
    Business ||--o{ Customer : "manages"
    Business ||--o{ Invoice : "issues"
    User ||--o{ AuditLog : "triggers"
    Customer ||--o{ Invoice : "billed to"
    Invoice ||--|{ InvoiceItem : "contains"
    Invoice ||--o{ Payment : "collects"
    Invoice ||--o{ Reminder : "schedules"

    Business {
        uuid id PK
        varchar name
        varchar gstin
        text address
        varchar phone
        varchar email
        text logoUrl
        timestamp createdAt
    }

    User {
        uuid id PK
        uuid businessId FK
        varchar name
        varchar email
        varchar phone
        varchar passwordHash
        varchar role
        boolean isActive
        timestamp createdAt
    }

    Customer {
        uuid id PK
        uuid businessId FK
        varchar name
        varchar phone
        varchar email
        varchar gstin
        text address
        timestamp createdAt
    }

    Invoice {
        uuid id PK
        uuid businessId FK
        uuid customerId FK
        varchar invoiceNumber
        date invoiceDate
        date dueDate
        decimal subtotal
        decimal gstAmount
        decimal discountAmount
        decimal totalAmount
        varchar status
        timestamp createdAt
    }

    InvoiceItem {
        uuid id PK
        uuid invoiceId FK
        varchar productName
        decimal quantity
        decimal unitPrice
        decimal gstRate
        decimal lineTotal
    }

    Payment {
        uuid id PK
        uuid invoiceId FK
        decimal amount
        varchar paymentMethod
        varchar referenceNo
        date paymentDate
        timestamp createdAt
    }
```

---

## 💻 Getting Started Locally

### Prerequisites
* **Node.js** (v18 or higher)
* **PostgreSQL** running locally

### 1. Setup Backend
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install packages:
   ```bash
   npm install
   ```
3. Create a `.env` file inside `/backend` and configure your credentials:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/payflow_gst?schema=public"
   DIRECT_URL="postgresql://postgres:password@localhost:5432/payflow_gst?schema=public"
   PORT=5000
   JWT_SECRET="your_jwt_signing_secret_key"
   JWT_REFRESH_SECRET="your_jwt_refresh_secret_key"
   NODE_ENV="development"
   ```
4. Push database tables and generate client:
   ```bash
   npx prisma db push
   ```
5. Seed mock data for immediate testing:
   ```bash
   npm run prisma:seed
   ```
6. Start dev server:
   ```bash
   npm run dev
   ```


### 2. Setup Frontend
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install packages:
   ```bash
   npm install
   ```
3. Start Vite dev server:
   ```bash
   npm run dev
   ```
   *Access the app at [http://localhost:5173](http://localhost:5173).*

---

## 🚀 Cloud Deployment

### Backend (Deployed on Render)
* **Root Directory**: `backend`
* **Build Command**: `npm install --production=false && npx prisma generate && npx prisma migrate deploy && npm run build`
* **Start Command**: `npm start`
* Configure the following environment variables on Render:
  * `DATABASE_URL`: Your pooled PostgreSQL connection URL (e.g., port 6543 with `?pgbouncer=true&connection_limit=1`).
  * `DIRECT_URL`: Your direct/session PostgreSQL connection URL (e.g., port 5432).

### Frontend (Deployed on Vercel)
* **Root Directory**: `frontend`
* **Framework Preset**: `Vite`
* **Environment Variables**:
  * `VITE_API_URL`: `<your-render-backend-url>/api`

---

## 🛡️ Strict Engineering Implementation Notes
* **Type Safety**: Avoids `any` casting. Utilizes Zod for API payload verification and automatic generation of type definitions.
* **Component Design**: Developed on top of Material UI v9 slot props (`slotProps`) to ensure compatibility with strict React 19 typings.
* **Clean Code**: Employs clean architecture layers (Routes ➔ Middlewares ➔ Repositories/Services ➔ Controllers ➔ Schema Models).
