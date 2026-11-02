import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  defineApp,
  defineCollection,
  AppProvider,
  TableView,
  queryKeys,
} from "../src/index.js";

describe("TableView Component", () => {
  const customers = defineCollection({
    name: "customers",
    label: "Customers",
    fields: {
      id: { type: "text", label: "Customer ID" },
      name: { type: "text", label: "Full Name" },
      email: { type: "text", label: "Email Address" },
      status: {
        type: "select",
        label: "Status",
        options: [
          { label: "Active Customer", value: "active" },
          { label: "Inactive Customer", value: "inactive" },
        ],
      },
      balance: { type: "currency", label: "Account Balance" },
    },
    table: {
      columns: ["id", "name", "email", "status", "balance"],
      sort: "-id",
    },
    bulkActions: [
      {
        name: "delete",
        label: "Delete Selected",
        execute: vi.fn(),
      },
    ],
  });

  const app = defineApp({
    title: "CRM App",
    apiBaseUrl: "https://api.crm.example.com",
    collections: [customers],
  });

  it("renders table with headers, formatted cells, toolbar and pagination", () => {
    const mockRows = [
      {
        id: "CUST-001",
        name: "Alice Smith",
        email: "alice@example.com",
        status: "active",
        balance: 1450.75,
      },
      {
        id: "CUST-002",
        name: "Bob Jones",
        email: "bob@example.com",
        status: "inactive",
        balance: 0,
      },
    ];

    const queryClient = new QueryClient();
    const queryKey = queryKeys.collection.list("customers", {
      page: 1,
      limit: 10,
      sort: "-id",
      search: undefined,
      filters: undefined,
    });

    queryClient.setQueryData(queryKey, {
      success: true,
      data: mockRows,
      meta: {
        pagination: {
          total: 2,
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        },
      },
    });

    const customClient: any = {
      apiBaseUrl: "https://api.crm.example.com",
      get: vi.fn(),
    };

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <AppProvider app={app} client={customClient}>
          <TableView
            collection={customers}
            options={{
              syncUrl: false,
              initialPage: 1,
              defaultLimit: 10,
            }}
          />
        </AppProvider>
      </QueryClientProvider>
    );

    // 1. Verify headers
    expect(html).toContain("Customer ID");
    expect(html).toContain("Full Name");
    expect(html).toContain("Email Address");
    expect(html).toContain("Status");
    expect(html).toContain("Account Balance");

    // 2. Verify formatted data rows
    expect(html).toContain("CUST-001");
    expect(html).toContain("Alice Smith");
    expect(html).toContain("alice@example.com");
    expect(html).toContain("Active Customer");
    expect(html).toContain("1,450.75");

    expect(html).toContain("CUST-002");
    expect(html).toContain("Bob Jones");
    expect(html).toContain("Inactive Customer");

    // 3. Verify search placeholder
    expect(html).toContain("Search Customers...");

    // 4. Verify pagination counter
    expect(html).toContain("Showing 1 to 2 of 2 results");
    expect(html).toContain("Rows per page");
    expect(html).toContain("Page 1 of 1");
  });

  it("renders loading state when queries are pending", () => {
    const customClient: any = {
      apiBaseUrl: "https://api.crm.example.com",
      get: vi.fn().mockReturnValue(new Promise(() => {})),
    };

    const queryClient = new QueryClient();

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <AppProvider app={app} client={customClient}>
          <TableView
            collection={customers}
            loadingText="Fetching customer accounts..."
            options={{ syncUrl: false }}
          />
        </AppProvider>
      </QueryClientProvider>
    );

    expect(html).toContain("Fetching customer accounts...");
  });

  it("renders empty state message when no data is returned", () => {
    const queryClient = new QueryClient();
    const queryKey = queryKeys.collection.list("customers", {
      page: 1,
      limit: 20,
      sort: "-id",
      search: undefined,
      filters: undefined,
    });

    queryClient.setQueryData(queryKey, {
      success: true,
      data: [],
      meta: {
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        },
      },
    });

    const customClient: any = {
      apiBaseUrl: "https://api.crm.example.com",
      get: vi.fn(),
    };

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <AppProvider app={app} client={customClient}>
          <TableView
            collection={customers}
            emptyText="No customer accounts exist."
            options={{ syncUrl: false }}
          />
        </AppProvider>
      </QueryClientProvider>
    );

    expect(html).toContain("No customer accounts exist.");
    expect(html).toContain("Showing 0 to 0 of 0 results");
  });

  it("renders active filter pills and bulk action triggers properly", () => {
    const mockRows = [
      {
        id: "CUST-001",
        name: "Alice Smith",
        email: "alice@example.com",
        status: "active",
        balance: 1450.75,
      },
    ];

    const queryClient = new QueryClient();
    const queryKey = queryKeys.collection.list("customers", {
      page: 1,
      limit: 10,
      sort: "-id",
      search: undefined,
      filters: {
        status: "active",
      },
    });

    queryClient.setQueryData(queryKey, {
      success: true,
      data: mockRows,
      meta: {
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        },
      },
    });

    const customClient: any = {
      apiBaseUrl: "https://api.crm.example.com",
      get: vi.fn(),
    };

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <AppProvider app={app} client={customClient}>
          <TableView
            collection={customers}
            options={{
              syncUrl: false,
              initialPage: 1,
              defaultLimit: 10,
              initialFilters: {
                status: "active",
              },
            }}
          />
        </AppProvider>
      </QueryClientProvider>
    );

    // Active filter badge
    expect(html).toContain("Filters:");
    expect(html).toContain("Status: ");
    expect(html).toContain("active");
    expect(html).toContain("Clear all");
  });

  it("supports row click handler and custom toolbar actions slot", () => {
    const mockRows = [
      {
        id: "CUST-001",
        name: "Alice Smith",
        email: "alice@example.com",
        status: "active",
        balance: 100,
      },
    ];

    const queryClient = new QueryClient();
    const queryKey = queryKeys.collection.list("customers", {
      page: 1,
      limit: 20,
      sort: "-id",
      search: undefined,
      filters: undefined,
    });

    queryClient.setQueryData(queryKey, {
      success: true,
      data: mockRows,
      meta: {
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        },
      },
    });

    const customClient: any = {
      apiBaseUrl: "https://api.crm.example.com",
      get: vi.fn(),
    };

    const handleRowClick = vi.fn();

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <AppProvider app={app} client={customClient}>
          <TableView
            collection={customers}
            onRowClick={handleRowClick}
            actions={<button id="add-btn">+ Add Customer</button>}
            options={{ syncUrl: false }}
          />
        </AppProvider>
      </QueryClientProvider>
    );

    // Custom action button rendered
    expect(html).toContain("+ Add Customer");
    expect(html).toContain("cursor-pointer");
  });

  it("allows disabling toolbar elements and row selection via props", () => {
    const mockRows = [
      {
        id: "CUST-001",
        name: "Alice Smith",
        email: "alice@example.com",
        status: "active",
        balance: 100,
      },
    ];

    const queryClient = new QueryClient();
    const queryKey = queryKeys.collection.list("customers", {
      page: 1,
      limit: 20,
      sort: "-id",
      search: undefined,
      filters: undefined,
    });

    queryClient.setQueryData(queryKey, {
      success: true,
      data: mockRows,
      meta: {
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        },
      },
    });

    const customClient: any = {
      apiBaseUrl: "https://api.crm.example.com",
      get: vi.fn(),
    };

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <AppProvider app={app} client={customClient}>
          <TableView
            collection={customers}
            showSearch={false}
            showFilters={false}
            showColumnSelector={false}
            enableRowSelection={false}
            options={{ syncUrl: false }}
          />
        </AppProvider>
      </QueryClientProvider>
    );

    // Toolbar elements should not be rendered
    expect(html).not.toContain("Search Customers...");
    expect(html).not.toContain(">Filter<");
    expect(html).not.toContain(">Columns<");
    expect(html).not.toContain('aria-label="Select all rows"');
    expect(html).not.toContain('aria-label="Select row CUST-001"');

    // Table data should still render
    expect(html).toContain("Alice Smith");
  });
});
