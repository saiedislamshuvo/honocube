import { defineCollection, defineApp } from "@honocube/app";

// 1. Deals & Pipelines Collection (Twenty CRM style Kanban)
export const dealsCollection = defineCollection({
  name: "deals",
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
      type: "number",
      label: "ID",
      readOnly: true,
      visible: false,
    },
    title: {
      type: "text",
      label: "Deal Title",
      required: true,
      placeholder: "e.g. Stripe Global Integration",
    },
    company: {
      type: "text",
      label: "Company / Account",
      required: true,
      placeholder: "e.g. Acme Corp",
    },
    amount: {
      type: "number",
      label: "Deal Value ($)",
      required: true,
      min: 0,
      default: 0,
      format: "currency",
    },
    stage: {
      type: "select",
      label: "Stage",
      required: true,
      default: "lead",
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
      type: "select",
      label: "Priority",
      default: "medium",
      options: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
        { value: "urgent", label: "Urgent" },
      ],
    },
    contactName: {
      type: "text",
      label: "Contact Person",
      placeholder: "e.g. Sarah Connor",
    },
    contactEmail: {
      type: "text",
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
  name: "contacts",
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
      type: "number",
      label: "ID",
      readOnly: true,
      visible: false,
    },
    name: {
      type: "text",
      label: "Full Name",
      required: true,
      placeholder: "e.g. Sarah Connor",
    },
    email: {
      type: "text",
      label: "Email Address",
      required: true,
      placeholder: "sarah@acme.com",
    },
    company: {
      type: "text",
      label: "Company",
      placeholder: "Acme Corp",
    },
    phone: {
      type: "text",
      label: "Phone Number",
      placeholder: "+1 (555) 0101",
    },
    city: {
      type: "text",
      label: "City / Location",
      placeholder: "San Francisco",
    },
    status: {
      type: "select",
      label: "Relationship Status",
      default: "lead",
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
  name: "invoice-items",
  label: "Invoice Line Items",
  singular: "Line Item",
  endpoint: "/api/invoice-items",
  fields: {
    id: {
      type: "number",
      label: "ID",
      readOnly: true,
      visible: false,
    },
    description: {
      type: "text",
      label: "Description",
      required: true,
      placeholder: "e.g. Cloud Architecture Consulting",
    },
    quantity: {
      type: "number",
      label: "Qty",
      required: true,
      default: 1,
      min: 1,
    },
    unitPrice: {
      type: "number",
      label: "Unit Price ($)",
      required: true,
      default: 0,
      min: 0,
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
  name: "invoices",
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
      type: "number",
      label: "ID",
      readOnly: true,
      visible: false,
    },
    invoiceNumber: {
      type: "series",
      prefix: "INV-",
      label: "Invoice #",
      required: true,
      readOnly: true,
      placeholder: "Auto-generated (e.g. INV-2026-0001)",
    },
    customerName: {
      type: "text",
      label: "Customer / Account",
      required: true,
      placeholder: "Acme Corp",
    },
    issueDate: {
      type: "date",
      label: "Issue Date",
      required: true,
    },
    dueDate: {
      type: "date",
      label: "Payment Due Date",
      required: true,
    },
    currency: {
      type: "select",
      label: "Currency",
      default: "USD",
      options: [
        { value: "USD", label: "USD ($)" },
        { value: "EUR", label: "EUR (€)" },
        { value: "GBP", label: "GBP (£)" },
      ],
    },
    status: {
      type: "select",
      label: "Invoice Status",
      readOnly: true,
      default: "draft",
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
      default: 0,
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
      default: 0,
      format: "currency",
      compute: (r) => Math.round((r.subtotal || 0) * 0.1),
    },
    grandTotal: {
      type: "computed",
      label: "Grand Total ($)",
      default: 0,
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
