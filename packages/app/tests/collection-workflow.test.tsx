import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { defineCollection } from "../src/core/collection.js";
import { defineApp } from "../src/core/app.js";
import { AppProvider } from "../src/query/provider.js";
import { ApiClient } from "../src/client/api-client.js";
import { useCollectionWorkflow } from "../src/workflow/use-workflow.js";
import { useCollectionForm } from "../src/form/use-collection-form.js";

const invoiceCollection = defineCollection({
  name: "invoices",
  endpoint: "/api/invoices",
  fields: {
    customer: { type: "text", required: true },
    amount: { type: "currency", default: 100 },
    status: {
      type: "select",
      options: ["draft", "submitted", "approved", "cancelled"],
      default: "draft",
    },
  },
  workflow: {
    field: "status",
    initial: "draft",
    locked: ["submitted", "approved", "cancelled"],
    states: [
      { name: "draft", label: "Draft" },
      { name: "submitted", label: "Pending Approval", variant: "default" },
      { name: "approved", label: "Approved", variant: "success" },
      { name: "cancelled", label: "Cancelled", variant: "destructive" },
    ],
    transitions: {
      submit: {
        from: "draft",
        to: "submitted",
        label: "Submit Invoice",
      },
      approve: {
        from: "submitted",
        to: "approved",
        label: "Approve Invoice",
        role: "admin",
      },
    },
  },
});

const app = defineApp({
  title: "Workflow App",
  apiBaseUrl: "https://api.example.com",
  collections: [invoiceCollection],
});

describe("Collection Workflow Integration", () => {
  it("useCollectionWorkflow computes state, available transitions, and executes transition", async () => {
    let workflowHook: any;
    const onSuccessMock = vi.fn();

    function TestComponent() {
      workflowHook = useCollectionWorkflow(
        invoiceCollection,
        { id: "inv-101", customer: "Acme", status: "draft" },
        { id: "inv-101", onSuccess: onSuccessMock }
      );
      return <div>Workflow Test</div>;
    }

    const qc = new QueryClient();
    const client = new ApiClient(app);
    const mockPatch = vi.fn().mockResolvedValue({
      data: { id: "inv-101", customer: "Acme", status: "submitted" },
      meta: {},
    });
    client.patch = mockPatch;

    renderToString(
      <QueryClientProvider client={qc}>
        <AppProvider app={app} client={client}>
          <TestComponent />
        </AppProvider>
      </QueryClientProvider>
    );

    expect(workflowHook.currentState).toBe("draft");
    expect(workflowHook.isLocked).toBe(false);
    expect(workflowHook.canTransitionTo("submitted")).toBe(true);
    expect(workflowHook.canTransitionTo("approved")).toBe(false);

    // Execute transition
    await workflowHook.executeTransition("submit");

    expect(mockPatch).toHaveBeenCalledWith("/api/invoices/inv-101", {
      status: "submitted",
    });
    expect(onSuccessMock).toHaveBeenCalled();
  });

  it("freezes form fields when record is in a locked workflow state", () => {
    let draftForm: any;
    let lockedForm: any;

    function DraftComponent() {
      draftForm = useCollectionForm(invoiceCollection, {
        initialValues: { customer: "Acme Corp", status: "draft" },
      });
      return <div>Draft</div>;
    }

    function LockedComponent() {
      lockedForm = useCollectionForm(invoiceCollection, {
        initialValues: { customer: "Acme Corp", status: "submitted" },
      });
      return <div>Locked</div>;
    }

    const qc = new QueryClient();
    const client = new ApiClient(app);

    // 1. In draft mode: fields are editable
    renderToString(
      <QueryClientProvider client={qc}>
        <AppProvider app={app} client={client}>
          <DraftComponent />
        </AppProvider>
      </QueryClientProvider>
    );

    expect(draftForm.workflow?.currentState).toBe("draft");
    expect(draftForm.workflow?.isLocked).toBe(false);
    expect(draftForm.getFieldState("customer").disabled).toBe(false);

    // 2. In locked (submitted) mode: fields are frozen/disabled
    renderToString(
      <QueryClientProvider client={qc}>
        <AppProvider app={app} client={client}>
          <LockedComponent />
        </AppProvider>
      </QueryClientProvider>
    );

    expect(lockedForm.workflow?.currentState).toBe("submitted");
    expect(lockedForm.workflow?.isLocked).toBe(true);
    expect(lockedForm.getFieldState("customer").disabled).toBe(true);
    expect(lockedForm.getFieldState("amount").disabled).toBe(true);
  });
});
