import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import {
  BulkMediaIngestButton,
  BulkMediaIngestDialog,
} from "../src/index.js";

describe("Bulk Media ZIP Ingestion UI (Issue #139)", () => {
  const mockRecords = [
    { id: "p1", sku: "SKU-001", name: "Premium Widget", image: null },
    { id: "p2", sku: "SKU-002", name: "Standard Gadget", image: "https://example.com/gadget.png" },
    { id: "p3", sku: "SKU-003", name: "Economy Gizmo", image: null },
  ];

  it("renders BulkMediaIngestButton with icon and default label", () => {
    const html = renderToString(
      <BulkMediaIngestButton records={mockRecords} collectionName="Products" />
    );

    expect(html).toContain("data-testid=\"bulk-media-ingest-button\"");
    expect(html).toContain("Ingest Media ZIP");
  });

  it("renders BulkMediaIngestButton with custom label and variant", () => {
    const html = renderToString(
      <BulkMediaIngestButton
        records={mockRecords}
        collectionName="Products"
        label="Upload Product Images"
        variant="secondary"
      />
    );

    expect(html).toContain("Upload Product Images");
  });

  it("renders BulkMediaIngestDialog safely in SSR when open", () => {
    const html = renderToString(
      <BulkMediaIngestDialog
        open={true}
        onOpenChange={vi.fn()}
        records={mockRecords}
        collectionName="Products"
        identifierFields={["sku", "barcode"]}
        mediaFields={["image", "thumbnail"]}
      />
    );

    expect(html).toContain("data-testid=\"bulk-media-ingest-dialog\"");
    expect(html).toContain("Bulk Ingest Media for Products");
  });

  it("renders nothing when BulkMediaIngestDialog is closed", () => {
    const html = renderToString(
      <BulkMediaIngestDialog
        open={false}
        onOpenChange={vi.fn()}
        records={mockRecords}
        collectionName="Products"
      />
    );

    expect(html).toBe("");
  });
});
