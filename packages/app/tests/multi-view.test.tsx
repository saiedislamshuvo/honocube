import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  defineApp,
  defineCollection,
  AppProvider,
  KanbanView,
  CalendarView,
  ListView,
  GridView,
  ViewSwitcher,
  CollectionMultiView,
  queryKeys,
} from "../src/index.js";

describe("Multi-View Components", () => {
  // Deals CRM collection with Kanban, Calendar, List, and Grid configurations
  const deals = defineCollection({
    name: "deals",
    label: "Deals Pipeline",
    singular: "Deal",
    fields: {
      id: { type: "text", label: "Deal ID" },
      title: { type: "text", label: "Deal Title", required: true },
      client: { type: "text", label: "Client" },
      amount: { type: "currency", label: "Deal Value", default: 0 },
      stage: {
        type: "select",
        label: "Stage",
        options: [
          { label: "Lead", value: "lead" },
          { label: "Negotiation", value: "negotiation" },
          { label: "Won", value: "won" },
        ],
        default: "lead",
      },
      closeDate: { type: "date", label: "Expected Close" },
      description: { type: "text", label: "Details" },
    },
    table: {
      columns: ["id", "title", "client", "amount", "stage"],
    },
    kanban: {
      groupBy: "stage",
      card: {
        title: "title",
        subtitle: "client",
        badge: "stage",
        value: "amount",
      },
      columnSummary: "sum",
    },
    calendar: {
      title: "title",
      start: "closeDate",
    },
    list: {
      title: "title",
      subtitle: "client",
      badge: "stage",
      meta: "closeDate",
    },
    grid: {
      title: "title",
      subtitle: "client",
      body: "description",
      badge: "stage",
    },
    defaultView: "kanban",
  });

  const app = defineApp({
    title: "CRM",
    apiBaseUrl: "https://api.crm.example.com",
    collections: [deals],
  });

  const mockDeals = [
    {
      id: "DEAL-001",
      title: "Enterprise License",
      client: "Acme Corp",
      amount: 50000,
      stage: "negotiation",
      closeDate: "2026-11-15",
      description: "Annual multi-seat contract",
    },
    {
      id: "DEAL-002",
      title: "Cloud Migration",
      client: "Beta Global",
      amount: 25000,
      stage: "lead",
      closeDate: "2026-11-20",
      description: "AWS to GCP cloud migration",
    },
    {
      id: "DEAL-003",
      title: "Security Audit",
      client: "FinTech Group",
      amount: 15000,
      stage: "won",
      closeDate: "2026-11-10",
      description: "SOC2 Compliance assessment",
    },
  ];

  it("renders KanbanView with columns, card items, and aggregated summary totals", () => {
    const queryClient = new QueryClient();
    const queryKey = queryKeys.collection.list("deals", { limit: 100 });
    queryClient.setQueryData(queryKey, {
      success: true,
      data: mockDeals,
      meta: { pagination: { total: 3 } },
    });

    const customClient: any = {
      apiBaseUrl: "https://api.crm.example.com",
      get: vi.fn(),
    };

    const handleCardClick = vi.fn();

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <AppProvider app={app} client={customClient}>
          <KanbanView
            collection={deals}
            onCardClick={handleCardClick}
          />
        </AppProvider>
      </QueryClientProvider>
    );

    // 1. Column headers rendered from options
    expect(html).toContain("Lead");
    expect(html).toContain("Negotiation");
    expect(html).toContain("Won");

    // 2. Cards rendered in columns
    expect(html).toContain("Enterprise License");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("Cloud Migration");
    expect(html).toContain("Beta Global");
    expect(html).toContain("Security Audit");

    // 3. Formatted currency values and summaries rendered
    expect(html).toContain("50,000.00");
    expect(html).toContain("25,000.00");
    expect(html).toContain("15,000.00");
  });

  it("renders CalendarView with monthly grid and mapped event pills", () => {
    const queryClient = new QueryClient();
    const queryKey = queryKeys.collection.list("deals", { limit: 200 });
    queryClient.setQueryData(queryKey, {
      success: true,
      data: mockDeals,
      meta: { pagination: { total: 3 } },
    });

    const customClient: any = {
      apiBaseUrl: "https://api.crm.example.com",
      get: vi.fn(),
    };

    const initialDate = new Date("2026-11-01T00:00:00Z");

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <AppProvider app={app} client={customClient}>
          <CalendarView
            collection={deals}
            initialDate={initialDate}
          />
        </AppProvider>
      </QueryClientProvider>
    );

    // 1. Month header
    expect(html).toContain("November 2026");
    expect(html).toContain("Today");

    // 2. Weekday headers
    expect(html).toContain("Sun");
    expect(html).toContain("Mon");
    expect(html).toContain("Tue");
    expect(html).toContain("Wed");
    expect(html).toContain("Thu");
    expect(html).toContain("Fri");
    expect(html).toContain("Sat");

    // 3. Event pills placed on calendar
    expect(html).toContain("Enterprise License");
    expect(html).toContain("Cloud Migration");
    expect(html).toContain("Security Audit");
  });

  it("renders ListView with compact list tiles and initial avatars", () => {
    const queryClient = new QueryClient();
    const queryKey = queryKeys.collection.list("deals", { limit: 100 });
    queryClient.setQueryData(queryKey, {
      success: true,
      data: mockDeals,
      meta: { pagination: { total: 3 } },
    });

    const customClient: any = {
      apiBaseUrl: "https://api.crm.example.com",
      get: vi.fn(),
    };

    const handleItemClick = vi.fn();

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <AppProvider app={app} client={customClient}>
          <ListView
            collection={deals}
            onItemClick={handleItemClick}
          />
        </AppProvider>
      </QueryClientProvider>
    );

    // 1. Titles and subtitles
    expect(html).toContain("Enterprise License");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("Cloud Migration");
    expect(html).toContain("Beta Global");

    // 2. Stage badge rendered
    expect(html).toContain("negotiation");
    expect(html).toContain("lead");

    // 3. Avatar initials
    expect(html).toContain("EL"); // Enterprise License
    expect(html).toContain("CM"); // Cloud Migration
  });

  it("renders GridView with responsive cards layout", () => {
    const queryClient = new QueryClient();
    const queryKey = queryKeys.collection.list("deals", { limit: 100 });
    queryClient.setQueryData(queryKey, {
      success: true,
      data: mockDeals,
      meta: { pagination: { total: 3 } },
    });

    const customClient: any = {
      apiBaseUrl: "https://api.crm.example.com",
      get: vi.fn(),
    };

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <AppProvider app={app} client={customClient}>
          <GridView
            collection={deals}
            columns={3}
          />
        </AppProvider>
      </QueryClientProvider>
    );

    // 1. Card titles and subtitles
    expect(html).toContain("Enterprise License");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("Annual multi-seat contract");

    expect(html).toContain("Cloud Migration");
    expect(html).toContain("AWS to GCP cloud migration");

    // 2. Grid CSS classes
    expect(html).toContain("grid-cols-1 sm:grid-cols-2 lg:grid-cols-3");
  });

  it("renders ViewSwitcher and toggles between available views", () => {
    const handleViewChange = vi.fn();

    const html = renderToString(
      <ViewSwitcher
        activeView="kanban"
        onViewChange={handleViewChange}
        availableViews={["table", "kanban", "calendar", "list", "grid"]}
      />
    );

    expect(html).toContain("Table");
    expect(html).toContain("Kanban");
    expect(html).toContain("Calendar");
    expect(html).toContain("List");
    expect(html).toContain("Grid");
    expect(html).toContain('aria-selected="true"');
  });

  it("renders CollectionMultiView seamlessly switching views", () => {
    const queryClient = new QueryClient();
    const queryKey = queryKeys.collection.list("deals", { limit: 100 });
    queryClient.setQueryData(queryKey, {
      success: true,
      data: mockDeals,
      meta: { pagination: { total: 3 } },
    });

    const customClient: any = {
      apiBaseUrl: "https://api.crm.example.com",
      get: vi.fn(),
    };

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <AppProvider app={app} client={customClient}>
          <CollectionMultiView
            collection={deals}
            defaultView="kanban"
            actions={<button id="new-deal-btn">+ New Deal</button>}
          />
        </AppProvider>
      </QueryClientProvider>
    );

    // Title and actions
    expect(html).toContain("Deals Pipeline");
    expect(html).toContain("+ New Deal");

    // ViewSwitcher rendered
    expect(html).toContain("View Switcher");
    expect(html).toContain("Kanban");
    expect(html).toContain("Table");

    // Default view (Kanban) rendered
    expect(html).toContain("Enterprise License");
    expect(html).toContain("Negotiation");
  });
});
