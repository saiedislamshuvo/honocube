import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { defineCollection } from "../src/core/collection.js";
import { defineApp } from "../src/core/app.js";
import { AppProvider } from "../src/query/provider.js";
import { ApiClient } from "../src/client/api-client.js";
import { useCollectionForm } from "../src/form/use-collection-form.js";
import { useChildCollection } from "../src/form/use-child-collection.js";

const lineItemCollection = defineCollection({
  name: "order_items",
  fields: {
    name: { type: "text", required: true, label: "Item Name" },
    qty: { type: "number", min: 1, default: 1, required: true },
    rate: { type: "currency", min: 0, default: 10, required: true },
    amount: {
      type: "computed",
      compute: (row) => (row.qty || 0) * (row.rate || 0),
    },
  },
});

const orderCollection = defineCollection({
  name: "orders",
  endpoint: "/api/orders",
  fields: {
    customerName: { type: "text", required: true, label: "Customer Name" },
    items: {
      type: "collection",
      collection: lineItemCollection,
      relation: "hasMany",
      required: true,
      label: "Line Items",
    },
    subtotal: {
      type: "computed",
      compute: (r) =>
        (r.items || []).reduce((sum: number, it: any) => sum + (it.amount || 0), 0),
    },
    tax: {
      type: "computed",
      compute: (r) => (r.subtotal || 0) * 0.1,
    },
    total: {
      type: "computed",
      compute: (r) => (r.subtotal || 0) + (r.tax || 0),
    },
  },
});

const app = defineApp({
  title: "Order Management",
  apiBaseUrl: "https://api.example.com",
  collections: [orderCollection],
});

describe("Collection Form Child Collections Integration", () => {
  it("integrates useChildCollection and triggers live parent rollups on row changes", () => {
    let formHook: any;
    let childHook: any;

    function TestComponent() {
      formHook = useCollectionForm(orderCollection);
      childHook = useChildCollection(formHook, orderCollection, "items");
      return <div>Order Form</div>;
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

    expect(childHook.count).toBe(0);
    expect(formHook.values.subtotal).toBe(0);

    // 1. Add first row: 3 x $50 = $150
    childHook.addRow({ name: "Widget A", qty: 3, rate: 50 });
    expect(childHook.count).toBe(1);
    expect(formHook.values.items[0]?.name).toBe("Widget A");
    expect(formHook.values.items[0]?.amount).toBe(150);
    expect(formHook.values.subtotal).toBe(150);
    expect(formHook.values.tax).toBe(15);
    expect(formHook.values.total).toBe(165);

    // 2. Add second row: default 1 x $10 = $10
    childHook.addRow({ name: "Widget B" });
    expect(childHook.count).toBe(2);
    expect(formHook.values.subtotal).toBe(160);
    expect(formHook.values.total).toBe(176);

    // 3. Update second row qty to 5: 5 x $10 = $50 -> subtotal = 150 + 50 = 200
    childHook.updateRow(1, { qty: 5 });
    expect(formHook.values.subtotal).toBe(200);
    expect(formHook.values.tax).toBe(20);
    expect(formHook.values.total).toBe(220);

    // 4. Remove first row: remaining Widget B is 5 x 10 = 50 -> subtotal = 50
    childHook.removeRow(0);
    expect(childHook.count).toBe(1);
    expect(formHook.values.subtotal).toBe(50);
    expect(formHook.values.total).toBe(55);
  });

  it("validates child row fields and blocks submission with indexed error paths", async () => {
    let formHook: any;

    function TestComponent() {
      formHook = useCollectionForm(orderCollection);
      return <div>Order Form</div>;
    }

    const qc = new QueryClient();
    const client = new ApiClient(app);
    const mockPost = vi.fn().mockResolvedValue({ data: {}, meta: {} });
    client.post = mockPost;

    renderToString(
      <QueryClientProvider client={qc}>
        <AppProvider app={app} client={client}>
          <TestComponent />
        </AppProvider>
      </QueryClientProvider>
    );

    formHook.setFieldValue("customerName", "Stark Industries");

    // Add row with invalid qty (0 when min is 1) and empty name
    const itemsHelper = formHook.child("items");
    itemsHelper.addRow({ name: "", qty: 0 });

    await formHook.handleSubmit();

    // Verification: submission blocked
    expect(mockPost).not.toHaveBeenCalled();

    // Indexed errors
    expect(formHook.errors["items[0].name"]).toEqual(["Item Name is required"]);
    expect(formHook.errors["items[0].qty"]).toEqual(["Must be at least 1"]);

    // Helper row error accessor
    expect(itemsHelper.getRowErrors(0)).toEqual({
      name: ["Item Name is required"],
      qty: ["Must be at least 1"],
    });

    // Fix invalid fields
    itemsHelper.updateRow(0, { name: "Arc Reactor", qty: 2 });
    await formHook.handleSubmit();

    expect(mockPost).toHaveBeenCalledWith(
      "/api/orders",
      expect.objectContaining({
        customerName: "Stark Industries",
        items: [
          expect.objectContaining({
            name: "Arc Reactor",
            qty: 2,
            amount: 20,
          }),
        ],
        subtotal: 20,
        total: 22,
      })
    );
  });
});
