import { defineCollection, defineApp } from "@honocube/app";
import {
  dealsResource,
  contactsResource,
  invoicesResource,
  invoiceItemsResource,
} from "./cube.api";

// 1. Deals & Pipelines Collection (Twenty CRM style Kanban)
export const dealsCollection = defineCollection({
  resource: dealsResource,
  label: "Deals & Pipelines",
  singular: "Deal",
  icon: "Briefcase",
  group: "Sales",
  defaultView: "kanban",
  identifier: {
    field: "id",
    titleField: "title",
  },
  fields: {
    id: {
      label: "ID",
      visible: false,
    },
    title: {
      label: "Deal Title",
      placeholder: "e.g. Stripe Global Integration",
    },
    company: {
      label: "Company / Account",
      placeholder: "e.g. Acme Corp",
    },
    amount: {
      label: "Deal Value ($)",
      format: "currency",
    },
    stage: {
      label: "Stage",
      options: [
        { value: "lead", label: "Lead In" },
        { value: "qualified", label: "Qualified" },
        { value: "proposal", label: "Proposal Sent" },
        { value: "negotiation", label: "In Negotiation" },
        { value: "won", label: "Closed Won" },
        { value: "lost", label: "Closed Lost" },
      ],
    },
    priority: {
      label: "Priority",
      options: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
        { value: "urgent", label: "Urgent" },
      ],
    },
    contactName: {
      label: "Contact Person",
      placeholder: "e.g. Sarah Connor",
    },
    contactEmail: {
      label: "Contact Email",
      placeholder: "e.g. sarah@acme.com",
    },
    closeDate: {
      type: "date",
      label: "Target Close Date",
    },
    notes: {
      type: "textarea",
      label: "Notes & Background",
    },
  },
  table: {
    columns: ["title", "company", "amount", "stage", "priority", "contactName", "closeDate"],
    sort: "-id",
    search: ["title", "company", "contactName", "contactEmail"],
  },
  kanban: {
    groupBy: "stage",
    card: {
      title: "title",
      subtitle: "company",
      value: "amount",
      badge: "priority",
    },
    columnSummary: "sum",
  },
  form: {
    sections: [
      {
        title: "Deal Overview",
        description: "Core sales opportunity information and expected value.",
        columns: 2,
        fields: ["title", "company", "amount", "stage", "priority", "closeDate"],
      },
      {
        title: "Primary Contact",
        description: "Key decision-maker details for this opportunity.",
        columns: 2,
        fields: ["contactName", "contactEmail"],
      },
      {
        title: "Additional Notes",
        columns: 1,
        fields: ["notes"],
      },
    ],
  },
  sidePanel: {
    enabled: true,
    tabs: ["activity", "comments", "attachments"],
  },
});

// 2. Contacts Collection (Twenty CRM style customer directory)
export const contactsCollection = defineCollection({
  resource: contactsResource,
  label: "Contacts & Leads",
  singular: "Contact",
  icon: "Users",
  group: "Sales",
  defaultView: "table",
  identifier: {
    field: "id",
    titleField: "name",
  },
  fields: {
    id: {
      label: "ID",
      visible: false,
    },
    name: {
      label: "Full Name",
      placeholder: "e.g. Sarah Connor",
    },
    email: {
      label: "Email Address",
      placeholder: "sarah@acme.com",
    },
    company: {
      placeholder: "Acme Corp",
    },
    phone: {
      label: "Phone Number",
      placeholder: "+1 (555) 0101",
    },
    city: {
      label: "City / Location",
      placeholder: "San Francisco",
    },
    status: {
      label: "Relationship Status",
      options: [
        { value: "lead", label: "Lead" },
        { value: "active", label: "Active Customer" },
        { value: "churned", label: "Churned" },
      ],
    },
  },
  table: {
    columns: ["name", "email", "company", "phone", "city", "status"],
    search: ["name", "email", "company", "city"],
  },
  form: {
    sections: [
      {
        title: "Contact Details",
        columns: 2,
        fields: ["name", "email", "company", "phone", "city", "status"],
      },
    ],
  },
  sidePanel: {
    enabled: true,
    tabs: ["activity", "comments"],
  },
});

// 3. Invoice Items Child Collection (ERPNext style Line Items Table)
export const invoiceItemsCollection = defineCollection({
  resource: invoiceItemsResource,
  label: "Invoice Line Items",
  singular: "Line Item",
  fields: {
    id: {
      label: "ID",
      visible: false,
    },
    description: {
      placeholder: "e.g. Cloud Architecture Consulting",
    },
    quantity: {
      label: "Qty",
      min: 1,
    },
    unitPrice: {
      label: "Unit Price ($)",
      format: "currency",
    },
    amount: {
      type: "computed",
      label: "Amount ($)",
      format: "currency",
      compute: (row) => (row.quantity || 0) * (row.unitPrice || 0),
    },
  },
});

// 4. Invoices Collection (ERPNext style Naming Series + Workflow State Machine with Roles + Child Table)
export const invoicesCollection = defineCollection({
  resource: invoicesResource,
  label: "Invoices & Billing",
  singular: "Invoice",
  icon: "Receipt",
  group: "Accounting",
  defaultView: "table",
  identifier: {
    field: "invoiceNumber",
    series: "INV-.YYYY.-.####",
    titleField: "invoiceNumber",
  },
  fields: {
    id: {
      label: "ID",
      visible: false,
    },
    invoiceNumber: {
      type: "series",
      prefix: "INV-",
      label: "Invoice #",
      readOnly: true,
      placeholder: "Auto-generated (e.g. INV-2026-0001)",
    },
    customerName: {
      label: "Customer / Account",
      placeholder: "Acme Corp",
    },
    issueDate: {
      type: "date",
      label: "Issue Date",
    },
    dueDate: {
      type: "date",
      label: "Payment Due Date",
    },
    currency: {
      options: [
        { value: "USD", label: "USD ($)" },
        { value: "EUR", label: "EUR (€)" },
        { value: "GBP", label: "GBP (£)" },
      ],
    },
    status: {
      label: "Invoice Status",
      readOnly: true,
      options: [
        { value: "draft", label: "Draft" },
        { value: "submitted", label: "Pending Approval" },
        { value: "approved", label: "Approved" },
        { value: "paid", label: "Paid" },
        { value: "cancelled", label: "Cancelled" },
      ],
    },
    items: {
      type: "collection",
      label: "Invoice Line Items",
      description: "Billable items, quantities, and rates for this invoice.",
      collection: invoiceItemsCollection,
      relation: "hasMany",
    },
    subtotal: {
      type: "computed",
      label: "Subtotal ($)",
      format: "currency",
      compute: (r) =>
        (r.items || []).reduce(
          (sum: number, it: any) => sum + (it.amount || (it.quantity || 0) * (it.unitPrice || 0)),
          0
        ),
    },
    tax: {
      type: "computed",
      label: "Tax (10%) ($)",
      format: "currency",
      compute: (r) => Math.round((r.subtotal || 0) * 0.1),
    },
    grandTotal: {
      type: "computed",
      label: "Grand Total ($)",
      format: "currency",
      compute: (r) => (r.subtotal || 0) + (r.tax || 0),
    },
    notes: {
      type: "textarea",
      label: "Payment Terms / Notes",
      placeholder: "e.g. Net 15 days upon receipt.",
    },
  },
  workflow: {
    field: "status",
    initial: "draft",
    states: [
      { name: "draft", label: "Draft", variant: "secondary" },
      { name: "submitted", label: "Pending Approval", variant: "default" },
      { name: "approved", label: "Approved", variant: "default" },
      { name: "paid", label: "Paid", variant: "success" },
      { name: "cancelled", label: "Cancelled", variant: "destructive" },
    ],
    locked: ["paid", "cancelled"],
    transitions: {
      submit: {
        from: "draft",
        to: "submitted",
        label: "Submit for Approval",
        role: ["admin", "sales"],
      },
      approve: {
        from: "submitted",
        to: "approved",
        label: "Approve Invoice",
        role: "admin",
      },
      returnDraft: {
        from: "submitted",
        to: "draft",
        label: "Return to Draft",
        role: "admin",
      },
      markPaid: {
        from: "approved",
        to: "paid",
        label: "Mark as Paid",
        variant: "success",
        role: "admin",
      },
      cancel: {
        from: ["draft", "submitted"],
        to: "cancelled",
        label: "Cancel Invoice",
        variant: "destructive",
        role: "admin",
      },
    },
  },
  table: {
    columns: ["invoiceNumber", "customerName", "issueDate", "dueDate", "status", "grandTotal"],
    search: ["invoiceNumber", "customerName"],
    sort: "-id",
  },
  form: {
    tabs: [
      {
        label: "Invoice Details",
        sections: [
          {
            title: "Header & Customer",
            columns: 2,
            fields: ["invoiceNumber", "customerName", "issueDate", "dueDate", "currency", "status"],
          },
          {
            title: "Line Items",
            description: "Billable products and services for this invoice.",
            columns: 1,
            fields: ["items"],
          },
          {
            title: "Summary & Totals",
            columns: 3,
            fields: ["subtotal", "tax", "grandTotal"],
          },
          {
            title: "Payment Notes",
            columns: 1,
            fields: ["notes"],
          },
        ],
      },
    ],
  },
  sidePanel: {
    enabled: true,
    tabs: ["activity", "comments", "attachments"],
  },
});

// Root App Configuration (shadcn sidebar-07 defaults with Auth)
export const app = defineApp({
  title: "HonoCube Enterprise CRM",
  apiBaseUrl: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
  layout: {
    tenantSwitcher: "sidebar", // shadcn sidebar-07 team-switcher in sidebar header
    userProfile: "sidebar",    // shadcn sidebar-07 nav-user in sidebar footer
    themeToggle: true,
    themePresets: true,
  },
  theme: {
    defaultTheme: "system",
    defaultPreset: "zinc",
    enablePresets: true,
  },
  auth: {
    type: "bearer",
    getToken: () =>
      typeof window !== "undefined"
        ? localStorage.getItem("crm_auth_token") || "demo-admin-token"
        : "demo-admin-token",
  },
  navigation: [
    {
      group: "Sales & Pipelines",
      items: [dealsCollection, contactsCollection],
    },
    {
      group: "Finance & ERP",
      items: [invoicesCollection],
    },
  ],
  collections: [dealsCollection, contactsCollection, invoicesCollection, invoiceItemsCollection],
});
