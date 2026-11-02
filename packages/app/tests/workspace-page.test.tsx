import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  defineApp,
  defineCollection,
  AppProvider,
  WorkspacePage,
  WorkspaceDashboard,
  resolveWorkspaceRoute,
  queryKeys,
} from "../src/index.js";

describe("WorkspacePage Catch-all Routing & SSR Hydration", () => {
  const deals = defineCollection({
    name: "deals",
    label: "Deals Pipeline",
    singular: "Deal",
    fields: {
      id: { type: "text", label: "Deal ID" },
      title: { type: "text", label: "Title", required: true },
      amount: { type: "currency", label: "Amount" },
      stage: {
        type: "select",
        label: "Stage",
        options: [
          { label: "Lead", value: "lead" },
          { label: "Won", value: "won" },
        ],
        default: "lead",
      },
    },
    table: {
      columns: ["id", "title", "amount", "stage"],
    },
  });

  const invoices = defineCollection({
    name: "invoices",
    label: "Invoices",
    singular: "Invoice",
    fields: {
      id: { type: "text", label: "Invoice ID" },
      invoiceNumber: { type: "text", label: "Invoice #" },
      client: { type: "text", label: "Client" },
    },
  });

  const app = defineApp({
    name: "cube_crm",
    title: "Cube Business Suite",
    apiBaseUrl: "https://api.crm.example.com",
    collections: [deals, invoices],
  });

  const queryClient = new QueryClient();
  const mockClient: any = {
    apiBaseUrl: "https://api.crm.example.com",
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
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

  describe("resolveWorkspaceRoute", () => {
    it("resolves root and empty slugs to home dashboard", () => {
      expect(resolveWorkspaceRoute(app, undefined).type).toBe("home");
      expect(resolveWorkspaceRoute(app, []).type).toBe("home");
      expect(resolveWorkspaceRoute(app, "").type).toBe("home");
      expect(resolveWorkspaceRoute(app, "/").type).toBe("home");
    });

    it("resolves single slug to collection list", () => {
      const route = resolveWorkspaceRoute(app, ["deals"]);
      expect(route.type).toBe("list");
      expect(route.collectionName).toBe("deals");
      expect(route.collection).toBe(deals);
    });

    it("resolves 'new' slug to create record form", () => {
      const route = resolveWorkspaceRoute(app, ["deals", "new"]);
      expect(route.type).toBe("create");
      expect(route.collectionName).toBe("deals");
      expect(route.collection).toBe(deals);
    });

    it("resolves identifier slug to record detail view", () => {
      const route = resolveWorkspaceRoute(app, ["deals", "DEAL-12345"]);
      expect(route.type).toBe("detail");
      expect(route.collectionName).toBe("deals");
      expect(route.collection).toBe(deals);
      expect(route.recordId).toBe("DEAL-12345");
    });

    it("resolves string path inputs correctly", () => {
      expect(resolveWorkspaceRoute(app, "deals").type).toBe("list");
      expect(resolveWorkspaceRoute(app, "deals/new").type).toBe("create");
      expect(resolveWorkspaceRoute(app, "deals/42").type).toBe("detail");
    });

    it("resolves unrecognized collections to not-found", () => {
      const route = resolveWorkspaceRoute(app, ["nonexistent"]);
      expect(route.type).toBe("not-found");
      expect(route.collectionName).toBe("nonexistent");
    });
  });

  describe("WorkspaceDashboard", () => {
    it("renders cards for all app collections with view and create actions", () => {
      const handleNavigate = vi.fn();
      const html = renderWithProviders(
        <WorkspaceDashboard app={app} onNavigate={handleNavigate} />
      );

      expect(html).toContain("data-testid=\"workspace-dashboard\"");
      expect(html).toContain("Cube Business Suite");
      expect(html).toContain("Deals Pipeline");
      expect(html).toContain("Invoices");
      expect(html).toContain("data-testid=\"card-view-deals\"");
      expect(html).toContain("data-testid=\"card-create-deals\"");
      expect(html).toContain("data-testid=\"card-view-invoices\"");
      expect(html).toContain("data-testid=\"card-create-invoices\"");
    });
  });

  describe("WorkspacePage Component", () => {
    it("renders Home Dashboard when slug is empty", () => {
      const html = renderWithProviders(
        <WorkspacePage app={app} params={{ slug: [] }} />
      );

      expect(html).toContain("data-route-type=\"home\"");
      expect(html).toContain("Cube Business Suite");
      expect(html).toContain("Deals Pipeline");
    });

    it("renders custom dashboard when dashboard slot is provided", () => {
      const html = renderWithProviders(
        <WorkspacePage
          app={app}
          params={{ slug: [] }}
          dashboard={<div data-testid="custom-dashboard">Custom Enterprise KPI Dashboard</div>}
        />
      );

      expect(html).toContain("data-testid=\"custom-dashboard\"");
      expect(html).toContain("Custom Enterprise KPI Dashboard");
    });

    it("renders Collection List when slug points to a collection", () => {
      const queryKey = queryKeys.collection.list("deals", {
        page: 1,
        limit: 20,
        sort: undefined,
        search: undefined,
        filters: undefined,
      });
      queryClient.setQueryData(queryKey, {
        success: true,
        data: [
          { id: "D1", title: "Acme Deal", amount: 5000, stage: "lead" },
        ],
        meta: { pagination: { total: 1 } },
      });

      const html = renderWithProviders(
        <WorkspacePage app={app} params={{ slug: ["deals"] }} />
      );

      expect(html).toContain("data-route-type=\"list\"");
      expect(html).toContain("data-testid=\"collection-create-button\"");
      expect(html).toContain("New Deal");
      expect(html).toContain("Acme Deal");
    });

    it("renders Create Record Form when slug is [collection, 'new']", () => {
      const html = renderWithProviders(
        <WorkspacePage app={app} params={{ slug: ["deals", "new"] }} />
      );

      expect(html).toContain("data-route-type=\"create\"");
      expect(html).toContain("New Deal");
      expect(html).toContain("Create");
    });

    it("renders Record Detail View when slug is [collection, id]", () => {
      const detailKey = queryKeys.collection.detail("deals", "D1");
      queryClient.setQueryData(detailKey, {
        success: true,
        data: { id: "D1", title: "Enterprise SLA Deal", amount: 75000, stage: "lead" },
      });

      const html = renderWithProviders(
        <WorkspacePage app={app} params={{ slug: ["deals", "D1"] }} />
      );

      expect(html).toContain("data-route-type=\"detail\"");
      expect(html).toContain("Enterprise SLA Deal");
      expect(html).toContain("data-testid=\"document-header\"");
    });

    it("renders Collection Not Found when slug references an unknown collection", () => {
      const html = renderWithProviders(
        <WorkspacePage app={app} params={{ slug: ["unknown_table"] }} />
      );

      expect(html).toContain("data-route-type=\"not-found\"");
      expect(html).toContain("Collection Not Found");
      expect(html).toContain("unknown_table");
      expect(html).toContain("Return to Dashboard");
    });

    it("renders custom notFoundSlot if provided", () => {
      const html = renderWithProviders(
        <WorkspacePage
          app={app}
          params={{ slug: ["unknown_table"] }}
          notFoundSlot={<div data-testid="custom-404">Oops! 404 Custom Error</div>}
        />
      );

      expect(html).toContain("data-testid=\"custom-404\"");
      expect(html).toContain("Oops! 404 Custom Error");
    });
  });
});
