import { describe, expect, it } from "vitest";
import { defineCollection } from "../src/index.js";

describe("defineCollection", () => {
  it("creates a collection with frozen metadata and inferred defaults", () => {
    const users = defineCollection({
      name: "system_users",
      fields: {
        username: { type: "text", required: true },
        email: { type: "text", required: true },
        role: { type: "select", options: ["admin", "editor", "viewer"], default: "viewer" },
      },
    });

    expect(users._isCollection).toBe(true);
    expect(users.name).toBe("system_users");
    expect(users.label).toBe("System Users");
    expect(users.endpoint).toBe("/api/system_users");
    expect(users.defaultView).toBe("table");
    expect(Object.isFrozen(users)).toBe(true);
  });

  it("exposes getField and getFieldKeys helpers", () => {
    const products = defineCollection({
      name: "products",
      fields: {
        sku: { type: "text", required: true },
        price: { type: "currency", default: 0 },
        inStock: { type: "boolean", default: true },
      },
    });

    expect(products.getFieldKeys()).toEqual(["sku", "price", "inStock"]);
    expect(products.getField("sku")).toEqual({ type: "text", required: true });
    expect(products.getField("price")).toEqual({ type: "currency", default: 0 });
    // @ts-expect-error non-existent key
    expect(products.getField("unknown")).toBeUndefined();
  });

  it("supports embedded child collections and rollup computations", () => {
    const lineItems = defineCollection({
      name: "invoice_items",
      fields: {
        itemCode: { type: "text", required: true },
        qty: { type: "number", default: 1 },
        rate: { type: "currency", default: 0 },
        amount: {
          type: "computed",
          compute: (row) => (row.qty || 0) * (row.rate || 0),
        },
      },
    });

    const invoices = defineCollection({
      name: "invoices",
      endpoint: "/api/v1/invoices",
      fields: {
        customerName: { type: "text", required: true },
        items: {
          type: "collection",
          collection: lineItems,
          relation: "hasMany",
          inline: true,
        },
        total: {
          type: "computed",
          compute: (doc) => doc.items?.reduce((sum: number, item: any) => sum + (item.amount || 0), 0) ?? 0,
        },
      },
      table: {
        columns: ["customerName", "total"],
      },
    });

    expect(invoices.endpoint).toBe("/api/v1/invoices");
    expect(invoices.fields.items.type).toBe("collection");
    expect(invoices.fields.items.collection.name).toBe("invoice_items");
    expect(invoices.table?.columns).toEqual(["customerName", "total"]);
  });

  it("supports workflow state machines with locked states and transitions", () => {
    const orders = defineCollection({
      name: "orders",
      fields: {
        orderNumber: { type: "series", prefix: "ORD-" },
        status: { type: "select", options: ["draft", "submitted", "fulfilled", "cancelled"], default: "draft" },
      },
      workflow: {
        field: "status",
        initial: "draft",
        states: [
          { name: "draft", label: "Draft", variant: "secondary" },
          { name: "submitted", label: "Submitted", variant: "default" },
          { name: "fulfilled", label: "Fulfilled", variant: "success" },
          { name: "cancelled", label: "Cancelled", variant: "destructive" },
        ],
        locked: ["submitted", "fulfilled", "cancelled"],
        transitions: {
          submit: { from: "draft", to: "submitted", label: "Submit Order" },
          fulfill: { from: "submitted", to: "fulfilled", label: "Fulfill", role: "warehouse" },
          cancel: { from: ["draft", "submitted"], to: "cancelled", variant: "destructive" },
        },
      },
    });

    expect(orders.workflow?.locked).toEqual(["submitted", "fulfilled", "cancelled"]);
    expect(orders.workflow?.transitions?.submit.to).toBe("submitted");
    expect(orders.workflow?.transitions?.fulfill.role).toBe("warehouse");
  });

  it("validates required parameters and throws informative errors", () => {
    // @ts-expect-error missing config
    expect(() => defineCollection()).toThrow("Configuration object is required");
    // @ts-expect-error missing name
    expect(() => defineCollection({ fields: {} })).toThrow("Collection 'name' is required");
    // @ts-expect-error missing fields
    expect(() => defineCollection({ name: "test" })).toThrow("'fields' object is required");
  });
});
