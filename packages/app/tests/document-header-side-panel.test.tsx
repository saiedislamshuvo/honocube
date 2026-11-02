import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  defineApp,
  defineCollection,
  AppProvider,
  DocumentHeader,
  WorkflowActionBar,
  SidePanel,
  formatFileSize,
  type AuditActivity,
  type DocumentComment,
  type DocumentAttachment,
} from "../src/index.js";

describe("DocumentHeader, WorkflowActionBar, and SidePanel", () => {
  // Test Invoice Collection with workflow, naming series, and custom actions
  const invoices = defineCollection({
    name: "invoices",
    label: "Invoices",
    singular: "Invoice",
    identifier: {
      field: "invoiceNumber",
      series: "INV-2026-",
      titleField: "title",
    },
    fields: {
      id: { type: "text", label: "ID" },
      invoiceNumber: { type: "text", label: "Invoice #" },
      title: { type: "text", label: "Title" },
      client: { type: "text", label: "Client" },
      amount: { type: "currency", label: "Amount" },
      status: {
        type: "select",
        label: "Status",
        options: [
          { label: "Draft", value: "draft" },
          { label: "Submitted & Locked", value: "submitted" },
          { label: "Paid", value: "paid" },
          { label: "Cancelled", value: "cancelled" },
        ],
        default: "draft",
      },
    },
    workflow: {
      field: "status",
      initial: "draft",
      states: [
        { name: "draft", label: "Draft", variant: "secondary" },
        { name: "submitted", label: "Submitted & Locked", variant: "default" },
        { name: "paid", label: "Paid", variant: "success" },
        { name: "cancelled", label: "Cancelled", variant: "destructive" },
      ],
      locked: ["submitted", "paid", "cancelled"],
      transitions: {
        submit: {
          from: "draft",
          to: "submitted",
          label: "Submit & Lock",
          variant: "default",
        },
        markPaid: {
          from: "submitted",
          to: "paid",
          label: "Mark Paid",
          variant: "success",
        },
        cancel: {
          from: ["draft", "submitted"],
          to: "cancelled",
          label: "Cancel Invoice",
          variant: "destructive",
        },
      },
    },
    actions: [
      {
        name: "send_email",
        label: "Send via Email",
        execute: () => {},
      },
    ],
  });

  const app = defineApp({
    name: "billing_erp",
    title: "Billing ERP",
    apiBaseUrl: "https://api.erp.example.com",
    collections: [invoices],
  });

  const queryClient = new QueryClient();
  const mockClient: any = {
    apiBaseUrl: "https://api.erp.example.com",
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  };

  const renderWithProviders = (ui: React.ReactElement) => {
    return renderToString(
      <QueryClientProvider client={queryClient}>
        <AppProvider app={app} client={mockClient}>
          {ui}
        </AppProvider>
      </QueryClientProvider>
    );
  };

  it("renders DocumentHeader with naming series badge, document title, lifecycle status, and workflow buttons", () => {
    const record = {
      id: "42",
      invoiceNumber: "INV-2026-00042",
      title: "Enterprise Annual Subscription",
      client: "Global Tech Inc.",
      amount: 150000,
      status: "draft",
    };

    const handleBack = vi.fn();
    const handleAction = vi.fn();

    const html = renderWithProviders(
      <DocumentHeader
        collection={invoices}
        record={record}
        onBack={handleBack}
        onAction={handleAction}
        actionsMenuOpen={true}
      />
    );

    // 1. Naming series badge
    expect(html).toContain("INV-2026-00042");

    // 2. Document Title
    expect(html).toContain("Enterprise Annual Subscription");

    // 3. Status Badge
    expect(html).toContain("Draft");

    // 4. Workflow Transition Buttons from 'draft' (submit & cancel)
    expect(html).toContain("Submit &amp; Lock");
    expect(html).toContain("Cancel Invoice");

    // 5. Action Dropdown menu trigger rendered
    expect(html).toContain("data-testid=\"document-actions-trigger\"");
    expect(html).toContain("Actions");

    // 6. Back button rendered
    expect(html).toContain("data-testid=\"document-header-back-button\"");
  });

  it("renders DocumentHeader in a locked state with subsequent transitions", () => {
    const record = {
      id: "42",
      invoiceNumber: "INV-2026-00042",
      title: "Enterprise Annual Subscription",
      status: "submitted",
    };

    const html = renderWithProviders(
      <DocumentHeader collection={invoices} record={record} />
    );

    // 1. Status reflects 'submitted'
    expect(html).toContain("Submitted &amp; Locked");

    // 2. Available transitions from 'submitted' (markPaid & cancel)
    expect(html).toContain("Mark Paid");
    expect(html).toContain("Cancel Invoice");
  });

  it("renders WorkflowActionBar showing locked indicator when no transitions are available from terminal state", () => {
    const record = {
      id: "42",
      status: "paid",
    };

    const html = renderWithProviders(
      <WorkflowActionBar collection={invoices} record={record} />
    );

    // Paid is locked and has 0 outbound transitions
    expect(html).toContain("data-testid=\"workflow-locked-indicator\"");
    expect(html).toContain("Locked");
  });

  it("renders SidePanel Activity tab with field-level before/after diffs", () => {
    const activities: AuditActivity[] = [
      {
        id: "act-1",
        actor: { name: "Alice Cooper" },
        action: "Updated invoice lifecycle state",
        timestamp: "2026-11-03 10:00 AM",
        diffs: [
          { field: "status", from: "draft", to: "submitted" },
          { field: "approvedBy", from: null, to: "Alice Cooper" },
        ],
      },
    ];

    const html = renderWithProviders(
      <SidePanel
        collection={invoices}
        recordId="42"
        activities={activities}
        defaultTab="activity"
      />
    );

    // 1. Tab triggers
    expect(html).toContain("Activity");
    expect(html).toContain("Comments");
    expect(html).toContain("Files");

    // 2. Activity Actor and action
    expect(html).toContain("Alice Cooper");
    expect(html).toContain("Updated invoice lifecycle state");

    // 3. Field Diffs
    expect(html).toContain("status:");
    expect(html).toContain("draft");
    expect(html).toContain("submitted");
    expect(html).toContain("approvedBy:");
  });

  it("renders SidePanel Comments tab with user mentions highlighted", () => {
    const comments: DocumentComment[] = [
      {
        id: "cmt-1",
        author: { name: "Bob Martin" },
        content: "Please review the VAT rate with @finance_lead before proceeding.",
        createdAt: "2026-11-03 10:15 AM",
      },
    ];

    const html = renderWithProviders(
      <SidePanel
        collection={invoices}
        recordId="42"
        comments={comments}
        defaultTab="comments"
      />
    );

    // 1. Author and text
    expect(html).toContain("Bob Martin");
    expect(html).toContain("Please review the VAT rate with");

    // 2. Highlighted @mention badge
    expect(html).toContain("data-testid=\"user-mention\"");
    expect(html).toContain("@finance_lead");

    // 3. Comment input form and send button
    expect(html).toContain("data-testid=\"comment-input\"");
    expect(html).toContain("data-testid=\"comment-submit-button\"");
  });

  it("renders SidePanel Attachments tab with formatted file size and action buttons", () => {
    const attachments: DocumentAttachment[] = [
      {
        id: "att-1",
        name: "Signed_Contract.pdf",
        size: 3450000,
        mimeType: "application/pdf",
        uploadedAt: "2026-11-02",
        url: "https://files.example.com/contract.pdf",
      },
      {
        id: "att-2",
        name: "Tax_Calculation.xlsx",
        size: 54200,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        uploadedAt: "2026-11-03",
      },
    ];

    const html = renderWithProviders(
      <SidePanel
        collection={invoices}
        recordId="42"
        attachments={attachments}
        defaultTab="attachments"
      />
    );

    // 1. Filenames
    expect(html).toContain("Signed_Contract.pdf");
    expect(html).toContain("Tax_Calculation.xlsx");

    // 2. Formatted sizes (3.3 MB and 52.9 KB)
    expect(html).toContain("3.3 MB");
    expect(html).toContain("52.9 KB");

    // 3. Download link and delete button
    expect(html).toContain("data-testid=\"download-attachment-att-1\"");
    expect(html).toContain("data-testid=\"delete-attachment-att-1\"");
    expect(html).toContain("data-testid=\"upload-attachment-trigger\"");
  });

  it("verifies formatFileSize utility handles various byte thresholds", () => {
    expect(formatFileSize(undefined)).toBe("—");
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(15728640)).toBe("15.0 MB");
  });
});
