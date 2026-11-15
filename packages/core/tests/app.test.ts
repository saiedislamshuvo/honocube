import { describe, expect, it } from "vitest";
import { defineApp, defineCollection } from "../src/index.js";

describe("defineApp", () => {
  const customers = defineCollection({
    name: "customers",
    fields: { name: { type: "text", required: true } },
  });

  const invoices = defineCollection({
    name: "invoices",
    fields: { total: { type: "currency", default: 0 } },
  });

  it("creates an app instance with metadata and helpers", () => {
    const app = defineApp({
      title: "Enterprise ERP",
      apiBaseUrl: "https://api.example.com",
      auth: {
        type: "bearer",
        getToken: () => "mock-token",
        loginUrl: "/auth/login",
      },
      tenant: {
        header: "X-Tenant-Id",
        getTenantId: () => "tenant-123",
      },
      idempotency: {
        enabled: true,
        header: "Idempotency-Key",
        generateKey: () => "mock-key",
      },
      navigation: [
        {
          group: "Sales",
          items: [customers, invoices],
        },
      ],
    });

    expect(app._isApp).toBe(true);
    expect(app.title).toBe("Enterprise ERP");
    expect(app.apiBaseUrl).toBe("https://api.example.com");
    expect(app.auth?.type).toBe("bearer");
    expect(app.auth?.getToken?.()).toBe("mock-token");
    expect(app.tenant?.getTenantId?.()).toBe("tenant-123");
    expect(app.idempotency?.generateKey?.()).toBe("mock-key");

    // Auto-collected collections
    expect(app.getCollections()).toHaveLength(2);
    expect(app.getCollection("customers")).toBe(customers);
    expect(app.getCollection("invoices")).toBe(invoices);
    expect(app.getCollection("unknown")).toBeUndefined();
    expect(app.getNavigation()).toHaveLength(1);
    expect(app.getNavigation()[0]?.group).toBe("Sales");
  });

  it("merges collections from direct array and navigation groups without duplicates", () => {
    const customLink = { label: "Custom Page", href: "/custom" };

    const app = defineApp({
      title: "Portal",
      apiBaseUrl: "http://localhost:3000",
      collections: [customers],
      navigation: [
        {
          group: "General",
          items: [customers, invoices, customLink],
        },
      ],
    });

    expect(app.getCollections()).toHaveLength(2);
    expect(app.getCollection("customers")).toBe(customers);
    expect(app.getCollection("invoices")).toBe(invoices);
  });

  it("registers extraCollections without adding them to navigation", () => {
    const invoiceItems = defineCollection({
      name: "invoice-items",
      fields: { description: { type: "text" } },
    });

    const app = defineApp({
      title: "ERP",
      apiBaseUrl: "http://localhost:3000",
      navigation: [
        {
          group: "Sales",
          items: [customers, invoices],
        },
      ],
      extraCollections: [invoiceItems],
    });

    // All collections are registered
    expect(app.getCollections()).toHaveLength(3);
    expect(app.getCollection("customers")).toBe(customers);
    expect(app.getCollection("invoices")).toBe(invoices);
    expect(app.getCollection("invoice-items")).toBe(invoiceItems);

    // Navigation only contains navigation items, NOT extraCollections
    expect(app.getNavigation()).toHaveLength(1);
    expect(app.getNavigation()[0]?.items).toHaveLength(2);
    expect(app.getNavigation()[0]?.items).toEqual([customers, invoices]);
  });

  it("auto-infers navigation groups from collections when navigation is omitted", () => {
    const products = defineCollection({
      name: "products",
      group: "Catalog",
      fields: { title: { type: "text" } },
    });

    const app = defineApp({
      title: "Store",
      apiBaseUrl: "http://localhost:3000",
      collections: [customers, products],
    });

    const nav = app.getNavigation();
    expect(nav).toHaveLength(2);
    expect(nav[0]?.group).toBe("Collections"); // customers has no group, defaults to "Collections"
    expect(nav[0]?.items).toEqual([customers]);
    expect(nav[1]?.group).toBe("Catalog");
    expect(nav[1]?.items).toEqual([products]);
  });

  it("throws when required configuration parameters are missing", () => {
    // @ts-expect-error missing config
    expect(() => defineApp()).toThrow("Configuration object is required");
    // @ts-expect-error missing title
    expect(() => defineApp({ apiBaseUrl: "https://api.example.com" })).toThrow("App 'title' is required");
    // @ts-expect-error missing apiBaseUrl
    expect(() => defineApp({ title: "Test" })).toThrow("App 'apiBaseUrl' is required");
  });
});
