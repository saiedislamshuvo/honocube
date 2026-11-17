import React from "react";
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  SpreadsheetView,
  SpreadsheetGrid,
  colIndexToLetter,
  letterToColIndex,
  coordToCellRef,
  cellRefToCoord,
  evaluateFormula,
  type SpreadsheetColumn,
} from "../src/index.js";
import { defineCollection } from "@honocube/core";

describe("Spreadsheet Grid View (Issue #132)", () => {
  describe("Coordinate and Address Utilities", () => {
    it("converts 0-based column index to spreadsheet letter address", () => {
      expect(colIndexToLetter(0)).toBe("A");
      expect(colIndexToLetter(1)).toBe("B");
      expect(colIndexToLetter(25)).toBe("Z");
      expect(colIndexToLetter(26)).toBe("AA");
      expect(colIndexToLetter(27)).toBe("AB");
    });

    it("converts spreadsheet letter address to 0-based column index", () => {
      expect(letterToColIndex("A")).toBe(0);
      expect(letterToColIndex("b")).toBe(1);
      expect(letterToColIndex("Z")).toBe(25);
      expect(letterToColIndex("AA")).toBe(26);
      expect(letterToColIndex("AB")).toBe(27);
    });

    it("converts between coordinate pairs and cell reference strings", () => {
      expect(coordToCellRef(0, 0)).toBe("A1");
      expect(coordToCellRef(4, 1)).toBe("B5");
      expect(coordToCellRef(9, 2)).toBe("C10");

      expect(cellRefToCoord("A1")).toEqual({ row: 0, col: 0 });
      expect(cellRefToCoord("B5")).toEqual({ row: 4, col: 1 });
      expect(cellRefToCoord("c10")).toEqual({ row: 9, col: 2 });
      expect(cellRefToCoord("invalid")).toBeNull();
    });
  });

  describe("Formula Evaluation Engine", () => {
    const mockColumns: SpreadsheetColumn[] = [
      { key: "qty", label: "Quantity", type: "number" },
      { key: "price", label: "Unit Price", type: "currency" },
      { key: "total", label: "Total", type: "currency" },
    ];

    const mockRows = [
      { qty: 10, price: 15, total: "=A1*B1" },
      { qty: 5, price: 20, total: "=A2*B2" },
      { qty: 2, price: 50, total: "=A3*B3" },
    ];

    it("evaluates basic arithmetic expressions", () => {
      const result1 = evaluateFormula("=A1*B1", mockRows, mockColumns);
      expect(result1).toBe(150);

      const result2 = evaluateFormula("=A2*B2", mockRows, mockColumns);
      expect(result2).toBe(100);

      const resultAdd = evaluateFormula("=A1+A2+A3", mockRows, mockColumns);
      expect(resultAdd).toBe(17);
    });

    it("evaluates aggregate functions: SUM, AVERAGE, COUNT, MIN, MAX", () => {
      expect(evaluateFormula("=SUM(A1:A3)", mockRows, mockColumns)).toBe(17);
      expect(evaluateFormula("=SUM(B1:B3)", mockRows, mockColumns)).toBe(85);
      expect(evaluateFormula("=AVERAGE(B1:B3)", mockRows, mockColumns)).toBeCloseTo(28.333, 2);
      expect(evaluateFormula("=COUNT(A1:A3)", mockRows, mockColumns)).toBe(3);
      expect(evaluateFormula("=MIN(B1:B3)", mockRows, mockColumns)).toBe(15);
      expect(evaluateFormula("=MAX(B1:B3)", mockRows, mockColumns)).toBe(50);
    });

    it("passes through non-formula strings unchanged", () => {
      expect(evaluateFormula("Plain Text", mockRows, mockColumns)).toBe("Plain Text");
      expect(evaluateFormula(1234, mockRows, mockColumns)).toBe(1234);
    });
  });

  describe("SpreadsheetView Component Rendering", () => {
    const columns: SpreadsheetColumn[] = [
      { key: "item", label: "Item Name", type: "text" },
      { key: "qty", label: "Quantity", type: "number", summary: "sum" },
      { key: "unitPrice", label: "Unit Price", type: "currency", summary: "avg" },
      { key: "subtotal", label: "Subtotal", type: "currency", summary: "sum" },
    ];

    const data = [
      { item: "Widget Pro", qty: 10, unitPrice: 25, subtotal: "=B1*C1" },
      { item: "Gadget Max", qty: 4, unitPrice: 50, subtotal: "=B2*C2" },
      { item: "Cables", qty: 20, unitPrice: 5, subtotal: "=B3*C3" },
    ];

    it("renders the spreadsheet grid container, toolbar, and formula bar", () => {
      const html = renderToString(
        <SpreadsheetView
          columns={columns}
          initialData={data}
          showToolbar={true}
          showFormulaBar={true}
          showSummaryRow={true}
        />
      );

      expect(html).toContain("data-testid=\"spreadsheet-grid\"");
      expect(html).toContain("data-testid=\"spreadsheet-toolbar\"");
      expect(html).toContain("data-testid=\"spreadsheet-formula-bar\"");
      expect(html).toContain("data-testid=\"cell-coordinate-badge\"");
      expect(html).toContain("data-testid=\"formula-bar-input\"");

      // Check toolbar buttons
      expect(html).toContain("Row");
      expect(html).toContain("Delete");
      expect(html).toContain("Fill Down");
      expect(html).toContain("Copy");
      expect(html).toContain("Undo");
      expect(html).toContain("CSV");
    });

    it("renders column headers with letter coordinates and column labels", () => {
      const html = renderToString(
        <SpreadsheetView columns={columns} initialData={data} />
      );

      // Letters A, B, C, D
      expect(html).toContain(">A<");
      expect(html).toContain(">B<");
      expect(html).toContain(">C<");
      expect(html).toContain(">D<");

      // Labels
      expect(html).toContain("Item Name");
      expect(html).toContain("Quantity");
      expect(html).toContain("Unit Price");
      expect(html).toContain("Subtotal");
    });

    it("renders rows, row numbers, and evaluated cell formula values", () => {
      const html = renderToString(
        <SpreadsheetView columns={columns} initialData={data} />
      );

      // Row indices
      expect(html).toContain("data-testid=\"spreadsheet-row-0\"");
      expect(html).toContain("data-testid=\"spreadsheet-row-1\"");
      expect(html).toContain("data-testid=\"spreadsheet-row-2\"");

      // Text items
      expect(html).toContain("Widget Pro");
      expect(html).toContain("Gadget Max");

      // Evaluated formulas for subtotal:
      // Row 1: 10 * 25 = $250
      // Row 2: 4 * 50 = $200
      // Row 3: 20 * 5 = $100
      expect(html).toContain("$250");
      expect(html).toContain("$200");
      expect(html).toContain("$100");
    });

    it("renders summary footer row with aggregated values", () => {
      const html = renderToString(
        <SpreadsheetView columns={columns} initialData={data} showSummaryRow={true} />
      );

      expect(html).toContain("data-testid=\"spreadsheet-summary-row\"");
      expect(html).toContain("Total");
      // Total qty = 10 + 4 + 20 = 34
      expect(html).toContain("34");
      // Avg unit price = (25 + 50 + 5) / 3 = 26.67
      expect(html).toContain("26.67");
      // Total subtotal = 250 + 200 + 100 = 550
      expect(html).toContain("$550");
    });

    it("renders alias SpreadsheetGrid identical to SpreadsheetView", () => {
      const html = renderToString(
        <SpreadsheetGrid columns={columns} initialData={data} />
      );

      expect(html).toContain("data-testid=\"spreadsheet-grid\"");
      expect(html).toContain("Widget Pro");
    });

    it("renders collection-driven spreadsheet with auto-inferred columns", () => {
      const inventoryCollection = defineCollection({
        name: "inventory",
        label: "Inventory Log",
        fields: {
          sku: { type: "text", label: "SKU" },
          stock: { type: "number", label: "In Stock" },
          cost: { type: "currency", label: "Cost" },
        },
      });

      const invData = [
        { sku: "SKU-001", stock: 120, cost: 45 },
        { sku: "SKU-002", stock: 85, cost: 70 },
      ];

      const html = renderToString(
        <SpreadsheetView collection={inventoryCollection} data={invData} />
      );

      expect(html).toContain("SKU");
      expect(html).toContain("In Stock");
      expect(html).toContain("Cost");
      expect(html).toContain("SKU-001");
      expect(html).toContain("SKU-002");
    });
  });
});
