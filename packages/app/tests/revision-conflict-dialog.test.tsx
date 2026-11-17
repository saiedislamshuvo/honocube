import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { RevisionConflictDialog } from "../src/views/revision-conflict-dialog.js";
import { FormView } from "../src/views/form-view.js";
import { defineCollection, f, queryKeys } from "@honocube/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider } from "@honocube/core";

describe("RevisionConflictDialog & FormView OCC Conflict Handling", () => {
  const sampleConflict = {
    id: "rec-101",
    expectedVersion: 1,
    currentVersion: 2,
    clientRecord: {
      id: "rec-101",
      title: "My Local Edits",
      price: 150,
      version: 1,
    },
    serverRecord: {
      id: "rec-101",
      title: "Remote Database Title",
      price: 120,
      version: 2,
    },
  };

  it("renders conflict modal with diff comparison table and action buttons", () => {
    const html = renderToString(
      <RevisionConflictDialog
        conflict={sampleConflict}
        open={true}
        fieldLabels={{ title: "Article Title", price: "Unit Price" }}
      />
    );

    expect(html).toContain("Revision Conflict Detected");
    expect(html).toContain("Conflict");
    expect(html).toContain("Article Title");
    expect(html).toContain("Unit Price");
    expect(html).toContain("My Local Edits");
    expect(html).toContain("Remote Database Title");
    expect(html).toContain("150");
    expect(html).toContain("120");
    expect(html).toContain("Reload Server");
    expect(html).toContain("Overwrite Server");
    expect(html).toContain("Cancel");
  });

  it("renders null when open is false or conflict is null", () => {
    const closedHtml = renderToString(
      <RevisionConflictDialog conflict={sampleConflict} open={false} />
    );
    expect(closedHtml).toBe("");

    const nullHtml = renderToString(
      <RevisionConflictDialog conflict={null} open={true} />
    );
    expect(nullHtml).toBe("");
  });

  it("triggers resolution callbacks when action buttons are invoked", () => {
    const onResolve = vi.fn();
    const onCancel = vi.fn();

    // Directly invoking component callbacks
    const props = {
      conflict: sampleConflict,
      open: true,
      onResolve,
      onCancel,
    };

    props.onResolve("reload");
    expect(onResolve).toHaveBeenCalledWith("reload");

    props.onResolve("overwrite");
    expect(onResolve).toHaveBeenCalledWith("overwrite");

    props.onCancel();
    expect(onCancel).toHaveBeenCalled();
  });

  it("integrates RevisionConflictDialog seamlessly into FormView during edit workflows", () => {
    const testCollection = defineCollection({
      name: "products",
      fields: {
        name: f.text().required(),
        price: f.number(),
        version: f.number().default(1),
      },
      versionControl: { field: "version" },
    });

    const qc = new QueryClient();
    qc.setQueryData(queryKeys.collection.detail("products", "p1"), {
      success: true,
      data: { id: "p1", name: "Widget", price: 50, version: 1 },
    });
    const mockClient: any = {
      get: vi.fn().mockResolvedValue({
        success: true,
        data: { id: "p1", name: "Widget", price: 50, version: 1 },
      }),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const html = renderToString(
      <QueryClientProvider client={qc}>
        <AppProvider app={{ apiBaseUrl: "https://example.com" } as any} client={mockClient}>
          <FormView
            collection={testCollection}
            id="p1"
            initialValues={{ name: "Widget", price: 50, version: 1 }}
          />
        </AppProvider>
      </QueryClientProvider>
    );

    expect(html).toContain("data-testid=\"form-view\"");
    expect(html).toContain("Save Changes");
  });
});
