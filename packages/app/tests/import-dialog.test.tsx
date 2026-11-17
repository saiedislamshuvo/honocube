import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { defineCollection, f } from "@honocube/core";
import { ImportDialog } from "../src/views/import-dialog.js";
import { ImportButton } from "../src/views/import-button.js";
import { TableToolbar } from "../src/views/table-toolbar.js";

describe("Declarative CSV & Excel Import Dialog Engine", () => {
  const dummyCollection = defineCollection({
    name: "products",
    label: "Products",
    fields: {
      name: f.text({ label: "Product Name" }),
      sku: f.text({ label: "SKU" }),
      price: f.number({ label: "Unit Price" }),
      category: f.text({ label: "Category" }),
    },
  });

  it("renders ImportButton with icon and label", () => {
    const html = renderToString(
      <ImportButton collection={dummyCollection} label="Import Products" />
    );

    expect(html).toContain("Import Products");
    expect(html).toContain("<button");
  });

  it("renders ImportDialog in open state with template and upload components", () => {
    const html = renderToString(
      <ImportDialog
        open={true}
        onOpenChange={vi.fn()}
        collection={dummyCollection}
      />
    );

    expect(html).toContain("Import Products");
    expect(html).toContain("Download Template");
    expect(html).toContain("Upload CSV or Tabular File");
    expect(html).toContain("1. Upload");
    expect(html).toContain("2. Map");
    expect(html).toContain("3. Preview");
    expect(html).toContain("4. Finish");
  });

  it("renders closed dialog as empty string", () => {
    const html = renderToString(
      <ImportDialog
        open={false}
        onOpenChange={vi.fn()}
        collection={dummyCollection}
      />
    );

    expect(html).toBe("");
  });

  it("renders Import button inside TableToolbar when showImport is true", () => {
    const mockSearch: any = { query: "", setQuery: vi.fn(), clearSearch: vi.fn() };
    const mockFilters: any = { activeFilters: {}, setFilter: vi.fn(), removeFilter: vi.fn(), clearFilters: vi.fn() };
    const mockVisibility: any = { columnVisibility: {}, toggleColumn: vi.fn() };
    const mockSelection: any = { selectedRowIds: {}, selectRow: vi.fn(), clearSelection: vi.fn() };

    const html = renderToString(
      <TableToolbar
        collection={dummyCollection}
        search={mockSearch}
        filters={mockFilters}
        visibility={mockVisibility}
        selection={mockSelection}
        showImport={true}
      />
    );

    expect(html).toContain("Import");
  });

  it("supports custom onImport handler in TableToolbar", () => {
    const mockSearch: any = { query: "", setQuery: vi.fn(), clearSearch: vi.fn() };
    const mockFilters: any = { activeFilters: {}, setFilter: vi.fn(), removeFilter: vi.fn(), clearFilters: vi.fn() };
    const mockVisibility: any = { columnVisibility: {}, toggleColumn: vi.fn() };
    const mockSelection: any = { selectedRowIds: {}, selectRow: vi.fn(), clearSelection: vi.fn() };
    const onImport = vi.fn();

    const html = renderToString(
      <TableToolbar
        collection={dummyCollection}
        search={mockSearch}
        filters={mockFilters}
        visibility={mockVisibility}
        selection={mockSelection}
        showImport={true}
        onImport={onImport}
      />
    );

    expect(html).toContain("Import");
  });
});
