import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  defineApp,
  defineCollection,
  AppProvider,
  useApp,
  useApiClient,
  queryKeys,
  useCollectionMutation,
} from "../src/index.js";

describe("TanStack Query & Provider Integration", () => {
  const invoices = defineCollection({
    name: "invoices",
    fields: {
      customerName: { type: "text", required: true },
      total: { type: "currency", default: 0 },
    },
  });

  const app = defineApp({
    title: "Test ERP",
    apiBaseUrl: "https://api.example.com",
    collections: [invoices],
  });

  it("generates predictable query keys for collections, lists, and details", () => {
    expect(queryKeys.all).toEqual(["honocube"]);
    expect(queryKeys.collection.all("invoices")).toEqual(["honocube", "collections", "invoices"]);
    expect(queryKeys.collection.list("invoices", { page: 1, limit: 10 })).toEqual([
      "honocube",
      "collections",
      "invoices",
      "list",
      { page: 1, limit: 10 },
    ]);
    expect(queryKeys.collection.detail("invoices", "INV-001")).toEqual([
      "honocube",
      "collections",
      "invoices",
      "detail",
      "INV-001",
    ]);
  });

  it("provides app and apiClient via AppContext", () => {
    function Consumer() {
      const { app: contextApp } = useApp();
      const client = useApiClient();
      return (
        <div>
          <span>{contextApp.title}</span>
          <span>{client.apiBaseUrl}</span>
        </div>
      );
    }

    const html = renderToString(
      <AppProvider app={app}>
        <Consumer />
      </AppProvider>
    );

    expect(html).toContain("Test ERP");
    expect(html).toContain("https://api.example.com");
  });

  it("throws helpful error when useApp is used outside AppProvider", () => {
    function Orphan() {
      useApp();
      return null;
    }

    expect(() => renderToString(<Orphan />)).toThrow("useApp must be used within an <AppProvider>");
  });

  it("invalidates collection query cache on mutation success", async () => {
    const mockPost = vi.fn().mockResolvedValue({ success: true, data: { id: "INV-1" } });
    const mockPatch = vi.fn().mockResolvedValue({ success: true, data: { id: "INV-1", total: 200 } });
    const mockDelete = vi.fn().mockResolvedValue({ success: true, data: { id: "INV-1" } });

    const customClient: any = {
      apiBaseUrl: "https://api.example.com",
      post: mockPost,
      patch: mockPatch,
      delete: mockDelete,
    };

    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    let mutationRef: any;

    function MutationTester() {
      mutationRef = useCollectionMutation(invoices);
      return null;
    }

    renderToString(
      <QueryClientProvider client={queryClient}>
        <AppProvider app={app} client={customClient}>
          <MutationTester />
        </AppProvider>
      </QueryClientProvider>
    );

    expect(mutationRef).toBeDefined();
    expect(typeof mutationRef.create.mutateAsync).toBe("function");
    expect(typeof mutationRef.update.mutateAsync).toBe("function");
    expect(typeof mutationRef.remove.mutateAsync).toBe("function");

    // Execute create mutation
    await mutationRef.create.mutateAsync({ customerName: "Acme", total: 100 });
    expect(mockPost).toHaveBeenCalledWith("/api/invoices", { customerName: "Acme", total: 100 });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["honocube", "collections", "invoices"],
    });

    // Execute update mutation
    await mutationRef.update.mutateAsync({ id: "INV-1", data: { total: 200 } });
    expect(mockPatch).toHaveBeenCalledWith("/api/invoices/INV-1", { total: 200 });

    // Execute remove mutation
    await mutationRef.remove.mutateAsync("INV-1");
    expect(mockDelete).toHaveBeenCalledWith("/api/invoices/INV-1");
  });
});
