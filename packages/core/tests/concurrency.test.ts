import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  generateETag,
  parseETag,
  isRevisionConflict,
  extractConflictDetails,
} from "../src/concurrency/etag.js";
import { defineCollection } from "../src/core/collection.js";
import { f } from "../src/core/builder.js";
import { useCollectionMutation } from "../src/query/use-mutation.js";
import { useCollectionForm } from "../src/form/use-collection-form.js";
import { AppProvider } from "../src/query/provider.js";
import { ApiClientError } from "../src/client/errors.js";

describe("Concurrency Primitives & OCC Helpers", () => {
  it("generates and parses standard HTTP ETags", () => {
    expect(generateETag(1)).toBe('W/"1"');
    expect(generateETag("rev-456")).toBe('W/"rev-456"');

    expect(parseETag('W/"123"')).toBe("123");
    expect(parseETag('"abc-def"')).toBe("abc-def");
    expect(parseETag("999")).toBe("999");
    expect(parseETag(null)).toBeNull();
    expect(parseETag(undefined)).toBeNull();
  });

  it("identifies OCC and revision conflict status codes and error codes", () => {
    expect(isRevisionConflict(409)).toBe(true);
    expect(isRevisionConflict(412)).toBe(true);
    expect(isRevisionConflict(200, "OCC_FAILED")).toBe(true);
    expect(isRevisionConflict(400, "PRECONDITION_FAILED")).toBe(true);
    expect(isRevisionConflict(404, "NOT_FOUND")).toBe(false);
  });

  it("extracts structured conflict details from ApiClientError", () => {
    const error = new ApiClientError(
      409,
      "OCC_FAILED",
      "Stale record version",
      {
        expectedVersion: 1,
        currentVersion: 2,
        currentRecord: { id: "item-1", title: "Remote Update", version: 2 },
      }
    );

    const conflict = extractConflictDetails(error, "item-1", { title: "Local Edit" });
    expect(conflict).not.toBeNull();
    expect(conflict?.id).toBe("item-1");
    expect(conflict?.expectedVersion).toBe(1);
    expect(conflict?.currentVersion).toBe(2);
    expect(conflict?.serverRecord).toEqual({ id: "item-1", title: "Remote Update", version: 2 });
    expect(conflict?.clientRecord).toEqual({ title: "Local Edit" });
  });

  it("passes If-Match header in useCollectionMutation update and remove calls", async () => {
    const queryClient = new QueryClient();
    const mockPatch = vi.fn().mockResolvedValue({ success: true, data: { id: 1, version: 2 } });
    const mockDelete = vi.fn().mockResolvedValue({ success: true, data: { id: 1 } });
    const mockClient: any = { patch: mockPatch, delete: mockDelete };

    const testCollection = defineCollection({
      name: "items",
      fields: {
        title: f.text().required(),
        version: f.number().default(1),
      },
      versionControl: { field: "version" },
    });

    let mutationHook: any;
    function TestMutationComponent() {
      mutationHook = useCollectionMutation(testCollection);
      return React.createElement("div", null, "MutationTest");
    }

    renderToString(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(
          AppProvider,
          { app: { apiBaseUrl: "https://example.com" } as any, client: mockClient },
          React.createElement(TestMutationComponent)
        )
      )
    );

    // 1. Mutation with ifMatch passes If-Match: W/"1"
    await mutationHook.update.mutateAsync({
      id: "1",
      data: { title: "Updated" },
      ifMatch: 1,
    });

    expect(mockPatch).toHaveBeenCalledWith(
      "/api/items/1",
      { title: "Updated" },
      { headers: { "If-Match": 'W/"1"' } }
    );

    // 2. Remove mutation with ifMatch
    await mutationHook.remove.mutateAsync({
      id: "1",
      ifMatch: 2,
    });

    expect(mockDelete).toHaveBeenCalledWith(
      "/api/items/1",
      { headers: { "If-Match": 'W/"2"' } }
    );
  });

  it("intercepts OCC conflict during useCollectionForm submit and supports resolution strategies", async () => {
    const queryClient = new QueryClient();
    const conflictError = new ApiClientError(
      409,
      "OCC_FAILED",
      "Record was modified by another transaction",
      {
        expectedVersion: 1,
        currentVersion: 2,
        currentRecord: { id: "doc-1", title: "Server Title", version: 2 },
      }
    );

    let patchCallCount = 0;
    const mockPatch = vi.fn().mockImplementation(() => {
      patchCallCount++;
      if (patchCallCount === 1) {
        return Promise.reject(conflictError);
      }
      return Promise.resolve({ success: true, data: { id: "doc-1", title: "Resolved", version: 3 } });
    });

    const mockGet = vi.fn().mockResolvedValue({
      success: true,
      data: { id: "doc-1", title: "Initial Title", version: 1 },
    });

    const mockClient: any = { get: mockGet, patch: mockPatch, delete: vi.fn() };

    const testCollection = defineCollection({
      name: "documents",
      fields: {
        title: f.text().required(),
        version: f.number().default(1),
      },
      versionControl: { field: "version" },
    });

    const onConflictSpy = vi.fn();

    let formHook: any;
    function TestFormComponent() {
      formHook = useCollectionForm(testCollection, {
        id: "doc-1",
        initialValues: { title: "My Edits", version: 1 },
        onConflict: onConflictSpy,
      });
      return React.createElement("div", null, "FormTest");
    }

    renderToString(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(
          AppProvider,
          { app: { apiBaseUrl: "https://example.com" } as any, client: mockClient },
          React.createElement(TestFormComponent)
        )
      )
    );

    // Initial submission triggers OCC conflict
    await formHook.handleSubmit();

    expect(onConflictSpy).toHaveBeenCalled();
    expect(formHook.conflict).not.toBeNull();
    expect(formHook.conflict?.currentVersion).toBe(2);

    // Resolve conflict via overwrite
    await formHook.resolveConflict("overwrite");

    expect(formHook.conflict).toBeNull();
    expect(mockPatch).toHaveBeenCalledTimes(2);
  });
});
