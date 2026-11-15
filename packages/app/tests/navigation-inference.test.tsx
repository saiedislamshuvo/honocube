import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  defineApp,
  defineCollection,
  resolveWorkspaceRoute,
  WorkspaceSidebar,
  type NavigationGroup,
} from "../src/index.js";

describe("Declarative App Navigation Auto-Inference and Registration (Issue #110)", () => {
  const dealsCollection = defineCollection({
    name: "deals",
    label: "Deals Pipeline",
    singular: "Deal",
    group: "Sales",
    fields: {
      title: { type: "text", required: true },
      amount: { type: "currency", default: 0 },
    },
  });

  const contactsCollection = defineCollection({
    name: "contacts",
    label: "Contacts Directory",
    singular: "Contact",
    group: "Sales",
    fields: {
      name: { type: "text", required: true },
      email: { type: "email" },
    },
  });

  const invoicesCollection = defineCollection({
    name: "invoices",
    label: "Customer Invoices",
    singular: "Invoice",
    group: "Finance",
    fields: {
      invoiceNumber: { type: "text", required: true },
      total: { type: "currency", default: 0 },
    },
  });

  const invoiceItemsCollection = defineCollection({
    name: "invoice-items",
    label: "Invoice Line Items",
    singular: "Line Item",
    fields: {
      description: { type: "text", required: true },
      quantity: { type: "number", default: 1 },
      price: { type: "currency", default: 0 },
    },
  });

  it("automatically registers collections defined in navigation without explicit collections array", () => {
    const app = defineApp({
      title: "CRM Suite",
      apiBaseUrl: "https://api.crm.example.com",
      navigation: [
        {
          group: "Sales",
          items: [dealsCollection, contactsCollection],
        },
        {
          group: "Finance",
          items: [invoicesCollection],
        },
      ],
    });

    // 1. Collections are automatically registered globally
    expect(app.getCollections()).toHaveLength(3);
    expect(app.getCollection("deals")).toBe(dealsCollection);
    expect(app.getCollection("contacts")).toBe(contactsCollection);
    expect(app.getCollection("invoices")).toBe(invoicesCollection);
    expect(app.getCollection("unknown")).toBeUndefined();

    // 2. app.collections property matches getCollections()
    expect(app.collections).toHaveLength(3);
    expect(app.collections).toContain(dealsCollection);
    expect(app.collections).toContain(contactsCollection);
    expect(app.collections).toContain(invoicesCollection);

    // 3. Navigation hierarchy is preserved exactly
    const nav = app.getNavigation();
    expect(nav).toHaveLength(2);
    expect(nav[0]?.group).toBe("Sales");
    expect(nav[0]?.items).toEqual([dealsCollection, contactsCollection]);
    expect(nav[1]?.group).toBe("Finance");
    expect(nav[1]?.items).toEqual([invoicesCollection]);
  });

  it("resolves workspace routes for navigation-inferred collections without explicit collections array", () => {
    const app = defineApp({
      title: "CRM Suite",
      apiBaseUrl: "https://api.crm.example.com",
      navigation: [
        {
          group: "Sales",
          items: [dealsCollection, contactsCollection],
        },
        {
          group: "Finance",
          items: [invoicesCollection],
        },
      ],
    });

    // Root / Home
    const homeRoute = resolveWorkspaceRoute(app, []);
    expect(homeRoute.type).toBe("home");

    // List view route
    const listRoute = resolveWorkspaceRoute(app, ["deals"]);
    expect(listRoute.type).toBe("list");
    expect(listRoute.collectionName).toBe("deals");
    expect(listRoute.collection).toBe(dealsCollection);

    // Create record route
    const createRoute = resolveWorkspaceRoute(app, ["contacts", "new"]);
    expect(createRoute.type).toBe("create");
    expect(createRoute.collectionName).toBe("contacts");
    expect(createRoute.collection).toBe(contactsCollection);

    // Detail record route
    const detailRoute = resolveWorkspaceRoute(app, ["invoices", "INV-1001"]);
    expect(detailRoute.type).toBe("detail");
    expect(detailRoute.collectionName).toBe("invoices");
    expect(detailRoute.collection).toBe(invoicesCollection);
    expect(detailRoute.recordId).toBe("INV-1001");

    // 404 Not found route
    const notFoundRoute = resolveWorkspaceRoute(app, ["non-existent"]);
    expect(notFoundRoute.type).toBe("not-found");
    expect(notFoundRoute.collectionName).toBe("non-existent");
  });

  it("registers extraCollections globally for routing while keeping them out of sidebar navigation", () => {
    const app = defineApp({
      title: "CRM Suite",
      apiBaseUrl: "https://api.crm.example.com",
      navigation: [
        {
          group: "Sales",
          items: [dealsCollection],
        },
        {
          group: "Finance",
          items: [invoicesCollection],
        },
      ],
      // Sub-resource child table:
      extraCollections: [invoiceItemsCollection],
    });

    // 1. Extra collection is registered globally
    expect(app.getCollections()).toHaveLength(3);
    expect(app.getCollection("invoice-items")).toBe(invoiceItemsCollection);
    expect(app.extraCollections).toEqual([invoiceItemsCollection]);

    // 2. Extra collection routes are resolvable
    const itemRoute = resolveWorkspaceRoute(app, ["invoice-items"]);
    expect(itemRoute.type).toBe("list");
    expect(itemRoute.collectionName).toBe("invoice-items");
    expect(itemRoute.collection).toBe(invoiceItemsCollection);

    const itemDetailRoute = resolveWorkspaceRoute(app, ["invoice-items", "item-42"]);
    expect(itemDetailRoute.type).toBe("detail");
    expect(itemDetailRoute.recordId).toBe("item-42");

    // 3. Navigation does NOT include extraCollections
    const nav = app.getNavigation();
    expect(nav).toHaveLength(2);
    expect(nav[0]?.items).toEqual([dealsCollection]);
    expect(nav[1]?.items).toEqual([invoicesCollection]);

    // 4. Sidebar HTML renders navigation items but omits extraCollections
    const sidebarHtml = renderToString(<WorkspaceSidebar app={app} pathname="/deals" />);
    expect(sidebarHtml).toContain("Deals Pipeline");
    expect(sidebarHtml).toContain("Customer Invoices");
    expect(sidebarHtml).not.toContain("Invoice Line Items");
    expect(sidebarHtml).not.toContain("/invoice-items");
  });

  it("handles custom navigation links alongside collections without treating links as collections", () => {
    const customLink = {
      label: "Analytics Dashboard",
      href: "/analytics",
      icon: "BarChart",
      badge: "Beta",
    };

    const app = defineApp({
      title: "CRM Suite",
      apiBaseUrl: "https://api.crm.example.com",
      navigation: [
        {
          group: "Dashboards",
          items: [customLink],
        },
        {
          group: "Sales",
          items: [dealsCollection],
        },
      ],
    });

    // Collections only includes dealsCollection
    expect(app.getCollections()).toHaveLength(1);
    expect(app.getCollection("deals")).toBe(dealsCollection);
    expect(app.getCollection("Analytics Dashboard")).toBeUndefined();

    // Navigation includes both
    expect(app.getNavigation()).toHaveLength(2);
    expect(app.getNavigation()[0]?.items).toEqual([customLink]);
    expect(app.getNavigation()[1]?.items).toEqual([dealsCollection]);

    // Sidebar renders custom link and collection
    const sidebarHtml = renderToString(<WorkspaceSidebar app={app} pathname="/deals" />);
    expect(sidebarHtml).toContain("Analytics Dashboard");
    expect(sidebarHtml).toContain("/analytics");
    expect(sidebarHtml).toContain("Beta");
    expect(sidebarHtml).toContain("Deals Pipeline");
  });

  it("maintains backwards compatibility with legacy collections array and deduplicates", () => {
    const app = defineApp({
      title: "CRM Suite",
      apiBaseUrl: "https://api.crm.example.com",
      navigation: [
        {
          group: "Sales",
          items: [dealsCollection],
        },
      ],
      extraCollections: [invoiceItemsCollection],
      // Redundantly passing dealsCollection and contactsCollection in legacy collections:
      collections: [dealsCollection, contactsCollection],
    });

    // Deduplicated: deals (from navigation), invoiceItems (from extra), contacts (from legacy collections)
    expect(app.getCollections()).toHaveLength(3);
    expect(app.getCollection("deals")).toBe(dealsCollection);
    expect(app.getCollection("invoice-items")).toBe(invoiceItemsCollection);
    expect(app.getCollection("contacts")).toBe(contactsCollection);
  });

  it("auto-infers navigation groups when navigation is omitted but legacy collections is passed", () => {
    const app = defineApp({
      title: "CRM Suite",
      apiBaseUrl: "https://api.crm.example.com",
      collections: [dealsCollection, contactsCollection, invoicesCollection],
    });

    const nav: NavigationGroup[] = app.getNavigation();
    expect(nav).toHaveLength(2); // "Sales" (deals, contacts) and "Finance" (invoices)
    expect(nav[0]?.group).toBe("Sales");
    expect(nav[0]?.items).toEqual([dealsCollection, contactsCollection]);
    expect(nav[1]?.group).toBe("Finance");
    expect(nav[1]?.items).toEqual([invoicesCollection]);

    // Route resolution also works
    expect(resolveWorkspaceRoute(app, ["deals"]).type).toBe("list");
    expect(resolveWorkspaceRoute(app, ["invoices"]).type).toBe("list");
  });
});
