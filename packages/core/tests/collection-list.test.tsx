import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  defineApp,
  defineCollection,
  AppProvider,
  useCollectionList,
  generateColumnsFromCollection,
} from "../src/index.js";

describe("Collection List Engine", () => {
  const invoices = defineCollection({
    name: "invoices",
    fields: {
      id: { type: "text" },
      customerName: { type: "text", label: "Client Name" },
      amount: { type: "currency", label: "Invoice Amount" },
      isPaid: { type: "boolean", label: "Paid" },
      status: {
        type: "select",
        options: [
          { label: "Draft Invoice", value: "draft" },
          { label: "Submitted Invoice", value: "submitted" },
        ],
      },
    },
    table: {
      columns: ["id", "customerName", "amount", "isPaid", "status"],
      sort: "-id",
    },
  });

  const app = defineApp({
    title: "ERP",
    apiBaseUrl: "https://api.example.com",
    collections: [invoices],
  });

  describe("generateColumnsFromCollection", () => {
    it("generates TanStack column definitions matching collection table columns", () => {
      const columns = generateColumnsFromCollection(invoices);
      expect(columns).toHaveLength(5);
      expect(columns[0]?.id).toBe("id");
      expect(columns[1]?.header).toBe("Client Name");
      expect(columns[2]?.header).toBe("Invoice Amount");

      // Verify cell formatter for currency
      const currencyCol = columns[2] as any;
      const formattedCurrency = currencyCol.cell({ getValue: () => 1250.5 });
      expect(formattedCurrency).toContain("1,250.50");

      // Verify cell formatter for boolean
      const booleanCol = columns[3] as any;
      expect(booleanCol.cell({ getValue: () => true })).toBe("Yes");
      expect(booleanCol.cell({ getValue: () => false })).toBe("No");

      // Verify cell formatter for select options
      const selectCol = columns[4] as any;
      expect(selectCol.cell({ getValue: () => "draft" })).toBe("Draft Invoice");
    });
  });

  describe("useCollectionList", () => {
    it("initializes table state, pagination, sorting, and handles selection", async () => {
      const mockRows = [
        { id: "INV-1", customerName: "Acme Corp", amount: 500, isPaid: false, status: "draft" },
        { id: "INV-2", customerName: "Beta LLC", amount: 1200, isPaid: true, status: "submitted" },
      ];

      const mockGet = vi.fn().mockResolvedValue({
        success: true,
        data: mockRows,
        meta: {
          pagination: {
            total: 50,
            page: 1,
            limit: 20,
            totalPages: 3,
            hasNext: true,
            hasPrevious: false,
          },
        },
      });

      const customClient: any = {
        apiBaseUrl: "https://api.example.com",
        get: mockGet,
      };

      const queryClient = new QueryClient();
      let hookResult: any;

      function ListTester() {
        hookResult = useCollectionList(invoices, {
          syncUrl: false, // In-memory for testing
          initialPage: 1,
          defaultLimit: 20,
        });
        return (
          <div>
            <span>Rows: {hookResult.data.length}</span>
            <span>Total: {hookResult.pagination.total}</span>
          </div>
        );
      }

      renderToString(
        <QueryClientProvider client={queryClient}>
          <AppProvider app={app} client={customClient}>
            <ListTester />
          </AppProvider>
        </QueryClientProvider>
      );

      // Trigger fetch
      await hookResult.refetch();

      // Verify API query parameters dispatched
      expect(mockGet).toHaveBeenCalledWith(
        "/api/invoices",
        expect.objectContaining({
          page: 1,
          limit: 20,
          sort: "-id",
        })
      );

      // Verify exposed hook methods & state
      expect(hookResult).toBeDefined();
      expect(hookResult.pagination.page).toBe(1);
      expect(hookResult.pagination.limit).toBe(20);
      expect(hookResult.sorting.sortField).toBe("id");
      expect(hookResult.sorting.sortOrder).toBe("desc");

      // Test helper actions
      expect(typeof hookResult.pagination.setPage).toBe("function");
      expect(typeof hookResult.pagination.setLimit).toBe("function");
      expect(typeof hookResult.sorting.setSort).toBe("function");
      expect(typeof hookResult.filters.setFilter).toBe("function");
      expect(typeof hookResult.search.setQuery).toBe("function");
      expect(typeof hookResult.selection.toggleRowSelected).toBe("function");
      expect(typeof hookResult.visibility.toggleColumn).toBe("function");
    });
  });
});
