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

describe("In-Table Instant Boolean Toggle (Issue #148)", () => {
  const users = defineCollection({
    name: "users",
    label: "Users",
    fields: {
      id: { type: "text", label: "ID" },
      name: { type: "text", label: "Full Name" },
      isActive: { type: "boolean", label: "Active Status" },
      isVerified: { type: "boolean", label: "Verified Email" },
    },
    table: {
      columns: ["id", "name", "isActive", "isVerified"],
    },
  });

  const app = defineApp({
    title: "Admin Console",
    apiBaseUrl: "https://api.example.com",
    collections: [users],
  });

  const mockUsersData = {
    data: [
      { id: "usr_1", name: "Alice Admin", isActive: true, isVerified: true },
      { id: "usr_2", name: "Bob Staff", isActive: false, isVerified: true },
      { id: "usr_3", name: "Charlie Guest", isActive: false, isVerified: false },
    ],
    meta: {
      total: 3,
      page: 1,
      limit: 10,
      totalPages: 1,
    },
  };

  function renderTableWithData(props: Partial<React.ComponentProps<typeof TableView>> = {}) {
    const queryClient = new QueryClient();
    const key = queryKeys.collection.list("users", {
      page: 1,
      limit: 10,
      sort: undefined,
      search: undefined,
      filters: undefined,
    });
    queryClient.setQueryData(key, {
      success: true,
      data: mockUsersData.data,
      meta: {
        pagination: {
          total: 3,
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        },
      },
    });

    const customClient: any = {
      apiBaseUrl: "https://api.example.com",
      get: vi.fn(),
      post: vi.fn(),
    };

    return renderToString(
      <QueryClientProvider client={queryClient}>
        <AppProvider app={app} client={customClient}>
          <TableView
            collection={users}
            options={{
              syncUrl: false,
              initialPage: 1,
              defaultLimit: 10,
            }}
            {...props}
          />
        </AppProvider>
      </QueryClientProvider>
    );
  }

  it("renders interactive switch elements for boolean columns in data rows", () => {
    const html = renderTableWithData();

    // Contains switch roles
    expect(html).toContain('role="switch"');
    // Checked switch for usr_1 (isActive: true)
    expect(html).toContain('data-testid="inline-toggle-isActive-usr_1"');
    expect(html).toContain('aria-label="Toggle Active Status for record usr_1"');

    // Unchecked switch for usr_2 (isActive: false)
    expect(html).toContain('data-testid="inline-toggle-isActive-usr_2"');
    expect(html).toContain('data-testid="inline-toggle-isVerified-usr_3"');
  });

  it("renders standard formatted text when enableInlineToggle is false", () => {
    const html = renderTableWithData({ enableInlineToggle: false });

    // Should NOT contain role switch
    expect(html).not.toContain('role="switch"');
    // Should display Yes / No text format
    expect(html).toContain("Yes");
    expect(html).toContain("No");
  });

  it("provisions automatic bulk toggle actions in table toolbar for boolean fields", () => {
    const onBulkToggleMock = vi.fn();
    const html = renderTableWithData({
      onBulkToggle: onBulkToggleMock,
      options: {
        syncUrl: false,
        initialPage: 1,
        defaultLimit: 10,
        initialRowSelection: { "0": true },
      },
    });

    // Verify automatic bulk actions are available in toolbar options
    expect(html).toContain("Enable Active Status");
    expect(html).toContain("Disable Active Status");
    expect(html).toContain("Enable Verified Email");
    expect(html).toContain("Disable Verified Email");
  });

  it("respects field-level inlineToggle: false constraint", () => {
    const customCollection = defineCollection({
      name: "items",
      fields: {
        id: { type: "text" },
        enabled: { type: "boolean", inlineToggle: false },
      },
      table: {
        columns: ["id", "enabled"],
      },
    });

    const queryClient = new QueryClient();
    const key = queryKeys.collection.list("items", {
      page: 1,
      limit: 10,
      sort: undefined,
      search: undefined,
      filters: undefined,
    });
    queryClient.setQueryData(key, {
      success: true,
      data: [{ id: "itm_1", enabled: true }],
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

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <AppProvider app={app}>
          <TableView
            collection={customCollection}
            options={{
              syncUrl: false,
              initialPage: 1,
              defaultLimit: 10,
            }}
          />
        </AppProvider>
      </QueryClientProvider>
    );

    // Switch should not be rendered for field with inlineToggle: false
    expect(html).not.toContain('data-testid="inline-toggle-enabled-itm_1"');
    expect(html).toContain("Yes");
  });
});
