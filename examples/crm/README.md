# HonoCube Showcase CRM & ERP (`examples/crm`)

An end-to-end full-stack Enterprise CRM and ERP showcase application built on **Next.js 15 (App Router)** and **HonoCube** (`@honocube/api`, `@honocube/app`, `@honocube/ui`).

Modeled directly after the UX paradigms of **Twenty CRM** (Kanban pipelines, contact directory) and **ERPNext** (Naming series, child line-items with automated rollups, multi-step approval workflow state machines).

---

## Architecture Overview

This application runs as a **unified Next.js + Hono application** in the Turborepo monorepo:

```
examples/crm/
├── app/
│   ├── api/[...route]/route.ts       # HonoCube backend API route handler
│   ├── (workspace)/
│   │   ├── layout.tsx                # <WorkspaceShell /> (Sidebar, Topbar, Tenant switcher, Spotlight)
│   │   └── [[...slug]]/page.tsx      # <WorkspacePage /> (Catch-all: Home, Multi-View, Form, Detail)
│   ├── globals.css                   # Tailwind + Radix UI design tokens
│   ├── layout.tsx                    # Root HTML layout with React Query & HonoCube providers
│   └── providers.tsx                 # QueryClientProvider and AppProvider
├── lib/
│   ├── db.ts                         # LibSQL / SQLite client & auto-seeding engine
│   ├── schema.ts                     # Drizzle ORM tables (deals, contacts, invoices, invoice_items)
│   ├── cube.api.ts                   # @honocube/api resources & OpenAPI specification
│   └── cube.app.ts                   # @honocube/app collections & defineApp workspace configuration
└── test/
    └── crm.test.ts                   # End-to-end integration test suite
```

---

## Key Features

1. **Deals & Pipelines (Twenty CRM Style)**
   - **Kanban Board**: Drag-and-drop / column-grouped view by deal stage (`lead`, `qualified`, `proposal`, `negotiation`, `won`, `lost`).
   - **Multi-View Switcher**: Instant switching between Kanban board and sortable, filterable Table view.
   - **Side Panel**: Real-time activity diff tracking, user comments, and file attachments.

2. **Invoices & Billing (ERPNext Style)**
   - **Naming Series**: Auto-generated sequence identifiers (`INV-.YYYY.-.####`).
   - **Workflow State Machine**:
     - States: `draft` ➔ `submitted` (Pending Approval) ➔ `approved` ➔ `paid` (Locked) or `cancelled` (Locked).
     - Role-based transition permissions and strict state locking.
   - **Document Header**: Status badges and contextual action triggers.

3. **Contacts Directory**
   - Searchable, paginated directory with customer relationship status tracking (`lead`, `active`, `churned`).

4. **Zero-Setup Embedded Database**
   - Uses embedded **LibSQL / SQLite** (`file:crm.db`).
   - Tables are auto-created and pre-seeded with realistic sample data on first start. No Docker, PostgreSQL, or cloud setup required.

---

## Local Development & Commands

Run all commands from the repository root:

```bash
# Start Next.js development server
yarn workspace crm dev

# Run integration test suite
yarn workspace crm test

# Run TypeScript typecheck
yarn workspace crm check-types

# Create production build
yarn workspace crm build
```

Once running, open [http://localhost:3000](http://localhost:3000) in your browser:
- `/` ➔ Workspace Dashboard with metric summaries and quick actions
- `/deals` ➔ Deals Kanban Pipeline & Table View
- `/contacts` ➔ Contacts & Customer Directory
- `/invoices` ➔ Invoices Table with Approval Workflow
- `/api/docs` ➔ Interactive OpenAPI & Scalar documentation
