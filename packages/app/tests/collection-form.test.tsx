import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { defineCollection } from "../src/core/collection.js";
import { defineApp } from "../src/core/app.js";
import { AppProvider } from "../src/query/provider.js";
import { ApiClient } from "../src/client/api-client.js";
import { useCollectionForm } from "../src/form/use-collection-form.js";

const invoiceCollection = defineCollection({
  name: "invoices",
  endpoint: "/api/invoices",
  fields: {
    customer: {
      type: "text",
      label: "Customer Name",
      required: true,
    },
    qty: {
      type: "number",
      default: 1,
    },
    rate: {
      type: "currency",
      default: 100,
    },
    subtotal: {
      type: "computed",
      compute: (r) => (r.qty || 0) * (r.rate || 0),
    },
    discount: {
      type: "number",
      default: 0,
    },
    total: {
      type: "computed",
      compute: (r) => (r.subtotal || 0) - (r.discount || 0),
    },
    status: {
      type: "select",
      options: ["draft", "submitted", "paid"],
      default: "draft",
    },
  },
});

const app = defineApp({
  title: "Billing App",
  apiBaseUrl: "https://api.example.com",
  collections: [invoiceCollection],
});

describe("useCollectionForm", () => {
  it("initializes form with defaults and initial computed values", () => {
    let hookResult: any;

    function TestComponent() {
      hookResult = useCollectionForm(invoiceCollection);
      return <div>Form</div>;
    }

    const qc = new QueryClient();
    const client = new ApiClient(app);

    renderToString(
      <QueryClientProvider client={qc}>
        <AppProvider app={app} client={client}>
          <TestComponent />
        </AppProvider>
      </QueryClientProvider>
    );

    expect(hookResult.values.qty).toBe(1);
    expect(hookResult.values.rate).toBe(100);
    expect(hookResult.values.subtotal).toBe(100);
    expect(hookResult.values.discount).toBe(0);
    expect(hookResult.values.total).toBe(100);
    expect(hookResult.values.status).toBe("draft");
    expect(hookResult.mode).toBe("create");
    expect(hookResult.isDirty).toBe(false);
  });

  it("reactively recalculates chained computed formulas when field values change", () => {
    let hookResult: any;

    function TestComponent() {
      hookResult = useCollectionForm(invoiceCollection);
      return <div>Form</div>;
    }

    const qc = new QueryClient();
    const client = new ApiClient(app);

    renderToString(
      <QueryClientProvider client={qc}>
        <AppProvider app={app} client={client}>
          <TestComponent />
        </AppProvider>
      </QueryClientProvider>
    );

    // Update qty to 5
    hookResult.setFieldValue("qty", 5);
    expect(hookResult.form.state.values.qty).toBe(5);
    expect(hookResult.form.state.values.subtotal).toBe(500);
    expect(hookResult.form.state.values.total).toBe(500);

    // Update discount to 50
    hookResult.setFieldValue("discount", 50);
    expect(hookResult.form.state.values.discount).toBe(50);
    expect(hookResult.form.state.values.total).toBe(450);
  });

  it("blocks submission on validation error and populates field error states", async () => {
    let hookResult: any;

    function TestComponent() {
      hookResult = useCollectionForm(invoiceCollection);
      return <div>Form</div>;
    }

    const qc = new QueryClient();
    const client = new ApiClient(app);

    renderToString(
      <QueryClientProvider client={qc}>
        <AppProvider app={app} client={client}>
          <TestComponent />
        </AppProvider>
      </QueryClientProvider>
    );

    // Customer is required but initially undefined
    await hookResult.handleSubmit();

    expect(hookResult.errors.customer).toEqual(["Customer Name is required"]);
    expect(hookResult.isValid).toBe(false);

    // Fill customer and verify error clearing
    hookResult.setFieldValue("customer", "Stark Industries");
    expect(hookResult.errors.customer).toBeUndefined();
  });

  it("dispatches POST mutation on successful creation submission", async () => {
    let hookResult: any;
    const onSuccessMock = vi.fn();

    function TestComponent() {
      hookResult = useCollectionForm(invoiceCollection, {
        onSuccess: onSuccessMock,
      });
      return <div>Form</div>;
    }

    const qc = new QueryClient();
    const client = new ApiClient(app);
    const mockPost = vi.fn().mockResolvedValue({
      data: { id: "inv-999", customer: "Wayne Enterprises", total: 100 },
      meta: {},
    });
    client.post = mockPost;

    renderToString(
      <QueryClientProvider client={qc}>
        <AppProvider app={app} client={client}>
          <TestComponent />
        </AppProvider>
      </QueryClientProvider>
    );

    hookResult.setFieldValue("customer", "Wayne Enterprises");
    await hookResult.handleSubmit();

    expect(mockPost).toHaveBeenCalledWith(
      "/api/invoices",
      expect.objectContaining({
        customer: "Wayne Enterprises",
        total: 100,
      })
    );
    expect(onSuccessMock).toHaveBeenCalled();
  });

  it("dispatches PATCH mutation on edit mode submission", async () => {
    let hookResult: any;
    const onSuccessMock = vi.fn();

    function TestComponent() {
      hookResult = useCollectionForm(invoiceCollection, {
        id: "inv-123",
        initialValues: { customer: "Acme Corp", qty: 2, rate: 50 },
        autoFetch: false,
        onSuccess: onSuccessMock,
      });
      return <div>Form</div>;
    }

    const qc = new QueryClient();
    const client = new ApiClient(app);
    const mockPatch = vi.fn().mockResolvedValue({
      data: { id: "inv-123", customer: "Acme Corp Updated", total: 100 },
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

    expect(hookResult.mode).toBe("edit");
    hookResult.setFieldValue("customer", "Acme Corp Updated");
    await hookResult.handleSubmit();

    expect(mockPatch).toHaveBeenCalledWith(
      "/api/invoices/inv-123",
      expect.objectContaining({
        customer: "Acme Corp Updated",
      })
    );
    expect(onSuccessMock).toHaveBeenCalled();
  });
});
