import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  defineApp,
  defineCollection,
  AppProvider,
  FormView,
  FormDialog,
  FormSheet,
  FormPage,
  queryKeys,
} from "../src/index.js";

describe("Form and Detail Views", () => {
  // 1. Child line items collection
  const invoiceItems = defineCollection({
    name: "invoice_items",
    fields: {
      description: { type: "text", label: "Item Description", required: true },
      quantity: { type: "number", label: "Qty", default: 1 },
      unitPrice: { type: "currency", label: "Price", default: 0 },
      subtotal: {
        type: "computed",
        label: "Subtotal",
        compute: (row: any) => (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0),
      },
    },
  });

  // 2. Main Invoices collection with tabs, sections, workflow, and child items
  const invoices = defineCollection({
    name: "invoices",
    label: "Invoices",
    singular: "Invoice",
    fields: {
      invoiceNumber: { type: "text", label: "Invoice #", required: true },
      clientName: { type: "text", label: "Client Name", required: true },
      notes: { type: "textarea", label: "Notes" },
      issueDate: { type: "date", label: "Issue Date" },
      status: {
        type: "select",
        label: "Invoice Status",
        options: [
          { label: "Draft", value: "draft" },
          { label: "Submitted", value: "submitted" },
          { label: "Approved", value: "approved" },
        ],
        default: "draft",
      },
      isPaid: { type: "boolean", label: "Paid in Full", default: false },
      items: {
        type: "collection",
        label: "Invoice Line Items",
        collection: invoiceItems,
      },
      total: {
        type: "computed",
        label: "Total Amount",
        compute: (rec: any) =>
          (rec.items || []).reduce(
            (sum: number, it: any) =>
              sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
            0
          ),
      },
    },
    form: {
      tabs: [
        {
          label: "General",
          sections: [
            {
              title: "Basic Details",
              description: "Core invoice details and customer references",
              columns: 2,
              fields: ["invoiceNumber", "clientName", "issueDate", "status", "isPaid"],
            },
            {
              title: "Additional Notes",
              columns: 1,
              fields: ["notes"],
            },
          ],
        },
        {
          label: "Line Items",
          fields: ["items", "total"],
        },
      ],
    },
    workflow: {
      field: "status",
      initial: "draft",
      states: [
        { name: "draft", label: "Draft Invoice", variant: "secondary" },
        { name: "submitted", label: "Pending Approval", variant: "default" },
        { name: "approved", label: "Approved & Finalized", variant: "default" },
      ],
      locked: ["approved"],
      transitions: {
        submit: { from: "draft", to: "submitted", label: "Submit" },
        approve: { from: "submitted", to: "approved", label: "Approve" },
      },
    },
  });

  const app = defineApp({
    title: "Billing ERP",
    apiBaseUrl: "https://api.erp.example.com",
    collections: [invoices, invoiceItems],
  });

  it("renders FormView with tabs, sections, fields, and default values", () => {
    const queryClient = new QueryClient();
    const customClient: any = {
      apiBaseUrl: "https://api.erp.example.com",
      get: vi.fn(),
    };

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <AppProvider app={app} client={customClient}>
          <FormView
            collection={invoices}
            initialValues={{
              invoiceNumber: "INV-2026-001",
              clientName: "Acme Industries",
              items: [
                { description: "Development Hours", quantity: 10, unitPrice: 150 },
                { description: "Hosting Setup", quantity: 1, unitPrice: 300 },
              ],
            }}
          />
        </AppProvider>
      </QueryClientProvider>
    );

    // 1. Header & Title
    expect(html).toContain("New Invoice");

    // 2. Tabs rendered
    expect(html).toContain("General");
    expect(html).toContain("Line Items");

    // 3. Section card headers
    expect(html).toContain("Basic Details");
    expect(html).toContain("Core invoice details and customer references");
    expect(html).toContain("Additional Notes");

    // 4. Fields rendered
    expect(html).toContain("Invoice #");
    expect(html).toContain("Client Name");
    expect(html).toContain("INV-2026-001");
    expect(html).toContain("Acme Industries");
    expect(html).toContain("Paid in Full");
    expect(html).toContain("Notes");

    // 5. Embedded child table rendered
    expect(html).toContain("Invoice Line Items");
    expect(html).toContain("(2 items)");
    expect(html).toContain("Development Hours");
    expect(html).toContain("Hosting Setup");
    expect(html).toContain("Add row");

    // 6. Action buttons
    expect(html).toContain("Create");
    expect(html).toContain("Cancel");
  });

  it("enforces document lock when workflow state is locked", () => {
    const queryClient = new QueryClient();
    const lockedRecord = {
      id: "INV-999",
      invoiceNumber: "INV-999",
      clientName: "Finalized Corp",
      status: "approved",
      isPaid: true,
      items: [],
    };

    const detailKey = queryKeys.collection.detail("invoices", "INV-999");
    queryClient.setQueryData(detailKey, {
      success: true,
      data: lockedRecord,
    });

    const customClient: any = {
      apiBaseUrl: "https://api.erp.example.com",
      get: vi.fn(),
    };

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <AppProvider app={app} client={customClient}>
          <FormView
            collection={invoices}
            id="INV-999"
          />
        </AppProvider>
      </QueryClientProvider>
    );

    // Locked badge rendered
    expect(html).toContain("Locked");
    expect(html).toContain("Approved &amp; Finalized");

    // Inputs disabled
    expect(html).toContain("disabled");
  });

  it("renders FormDialog presentation wrapper with trigger", () => {
    const queryClient = new QueryClient();
    const customClient: any = {
      apiBaseUrl: "https://api.erp.example.com",
      get: vi.fn(),
    };

    const handleOpenChange = vi.fn();

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <AppProvider app={app} client={customClient}>
          <FormDialog
            collection={invoices}
            open={false}
            onOpenChange={handleOpenChange}
            trigger={<button id="open-dialog-btn">Quick Create Invoice</button>}
            title="Quick Create Invoice"
          />
        </AppProvider>
      </QueryClientProvider>
    );

    // Trigger button rendered
    expect(html).toContain("Quick Create Invoice");
    expect(html).toContain('id="open-dialog-btn"');
  });

  it("renders FormSheet drawer presentation wrapper with trigger", () => {
    const queryClient = new QueryClient();
    const customClient: any = {
      apiBaseUrl: "https://api.erp.example.com",
      get: vi.fn(),
    };

    const handleOpenChange = vi.fn();

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <AppProvider app={app} client={customClient}>
          <FormSheet
            collection={invoices}
            open={false}
            onOpenChange={handleOpenChange}
            side="right"
            trigger={<button id="open-sheet-btn">Open Invoice Drawer</button>}
            title="Edit Invoice Details"
          />
        </AppProvider>
      </QueryClientProvider>
    );

    // Trigger button rendered
    expect(html).toContain("Open Invoice Drawer");
    expect(html).toContain('id="open-sheet-btn"');
  });

  it("renders FormPage full-page layout with back navigation button", () => {
    const queryClient = new QueryClient();
    const customClient: any = {
      apiBaseUrl: "https://api.erp.example.com",
      get: vi.fn(),
    };

    const handleBack = vi.fn();

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <AppProvider app={app} client={customClient}>
          <FormPage
            collection={invoices}
            onBack={handleBack}
          />
        </AppProvider>
      </QueryClientProvider>
    );

    expect(html).toContain("Back to Invoices");
    expect(html).toContain("New Invoice");
  });

  it("renders section cards layout when only sections are configured", () => {
    const leadsCollection = defineCollection({
      name: "leads",
      singular: "Lead",
      fields: {
        company: { type: "text", label: "Company Name", required: true },
        contact: { type: "text", label: "Contact Person" },
        email: { type: "text", label: "Email Address" },
        dealValue: { type: "currency", label: "Estimated Value" },
      },
      form: {
        sections: [
          {
            title: "Company Info",
            description: "Organization details",
            columns: 2,
            fields: ["company", "contact"],
          },
          {
            title: "Opportunity Details",
            columns: 2,
            fields: ["email", "dealValue"],
          },
        ],
      },
    });

    const queryClient = new QueryClient();
    const customClient: any = {
      apiBaseUrl: "https://api.erp.example.com",
      get: vi.fn(),
    };

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <AppProvider app={app} client={customClient}>
          <FormView
            collection={leadsCollection}
            initialValues={{ company: "Tech Corp", dealValue: 25000 }}
          />
        </AppProvider>
      </QueryClientProvider>
    );

    // Verify sections rendered without tab triggers
    expect(html).toContain("Company Info");
    expect(html).toContain("Organization details");
    expect(html).toContain("Opportunity Details");
    expect(html).toContain("Tech Corp");
    expect(html).toContain("25000");
    expect(html).not.toContain('role="tablist"');
  });
});
