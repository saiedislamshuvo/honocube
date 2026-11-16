import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import {
  PdfDocument,
  exportTableToPdf,
  exportDocumentToPdf,
  measureTextWidth,
  escapePdfString,
  truncateText,
  uint8ArrayToBase64,
  ExportPdfButton,
  PdfPreviewDialog,
  PrintDocument,
  type PrintCompanyInfo,
  type PrintCustomerInfo,
  type PrintDocumentItem,
  type PrintDocumentTotal,
} from "../src/index.js";

describe("Programmatic Client-Side PDF Export (Issue #133)", () => {
  describe("PdfDocument Engine & Compiler", () => {
    it("compiles a valid PDF 1.4 binary structure with header, catalog, pages, fonts, and xref trailer", () => {
      const doc = new PdfDocument({
        paperSize: "a4",
        orientation: "portrait",
        metadata: {
          title: "Test PDF Report",
          author: "HonoCube Team",
        },
      });

      const page = doc.addPage();
      expect(page.width).toBeCloseTo(595.28, 1);
      expect(page.height).toBeCloseTo(841.89, 1);

      page.drawText("Hello World from HonoCube", {
        x: 40,
        topY: 50,
        size: 14,
        font: "Helvetica-Bold",
        color: [0, 0, 0],
      });

      page.drawRect(40, 80, 200, 50, {
        fillColor: [0.9, 0.95, 1],
        strokeColor: [0.2, 0.4, 0.8],
        lineWidth: 1,
      });

      page.drawLine(40, 150, 300, 150, {
        color: [0.7, 0.7, 0.7],
        lineWidth: 0.5,
      });

      const bytes = doc.compile();
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBeGreaterThan(500);

      const pdfText = new TextDecoder().decode(bytes);
      expect(pdfText.startsWith("%PDF-1.4\n")).toBe(true);
      expect(pdfText).toContain("/Type /Catalog");
      expect(pdfText).toContain("/Type /Pages");
      expect(pdfText).toContain("/Type /Page");
      expect(pdfText).toContain("/BaseFont /Helvetica");
      expect(pdfText).toContain("/BaseFont /Helvetica-Bold");
      expect(pdfText).toContain("Hello World from HonoCube");
      expect(pdfText).toContain("xref\n");
      expect(pdfText).toContain("trailer\n");
      expect(pdfText).toContain("startxref\n");
      expect(pdfText.trim().endsWith("%%EOF")).toBe(true);
    });

    it("handles orientation switching to landscape dimensions", () => {
      const doc = new PdfDocument();
      const landscapePage = doc.addPage("letter", "landscape");

      // Letter landscape: width = 792, height = 612
      expect(landscapePage.width).toBe(792);
      expect(landscapePage.height).toBe(612);

      landscapePage.drawText("Landscape Grid", {
        x: 50,
        topY: 50,
        size: 12,
      });

      const pdf = new TextDecoder().decode(doc.compile());
      expect(pdf).toContain("/MediaBox [0 0 792.00 612.00]");
    });

    it("supports multi-page document pagination", () => {
      const doc = new PdfDocument();
      const page1 = doc.addPage();
      page1.drawText("Page 1 Content", { x: 50, topY: 50, size: 10 });

      const page2 = doc.addPage();
      page2.drawText("Page 2 Content", { x: 50, topY: 50, size: 10 });

      const pdf = new TextDecoder().decode(doc.compile());
      expect(pdf).toContain("/Count 2");
      expect(pdf).toContain("Page 1 Content");
      expect(pdf).toContain("Page 2 Content");
    });

    it("generates data URI string via toDataUri()", () => {
      const doc = new PdfDocument();
      doc.addPage().drawText("Test", { x: 20, topY: 20, size: 10 });
      const dataUri = doc.toDataUri();
      expect(dataUri.startsWith("data:application/pdf;base64,")).toBe(true);
      expect(dataUri.length).toBeGreaterThan(100);
    });
  });

  describe("Typography & Text Metrics Helpers", () => {
    it("measures font width and accounts for bold weight", () => {
      const regularWidth = measureTextWidth("Sample Title", 12, "Helvetica");
      const boldWidth = measureTextWidth("Sample Title", 12, "Helvetica-Bold");
      const courierWidth = measureTextWidth("Sample Title", 12, "Courier");

      expect(regularWidth).toBeGreaterThan(0);
      expect(boldWidth).toBeGreaterThan(regularWidth);
      expect(courierWidth).toBe("Sample Title".length * 12 * 0.6);
    });

    it("escapes special PDF characters and normalizes unicode punctuation", () => {
      const input = "Quote “smart” & ‘single’ (parentheses) \\backslash and € symbol";
      const escaped = escapePdfString(input);

      expect(escaped).not.toContain("“");
      expect(escaped).not.toContain("”");
      expect(escaped).toContain('\\(');
      expect(escaped).toContain('\\)');
      expect(escaped).toContain('\\\\');
      expect(escaped).toContain("EUR");
    });

    it("truncates long strings with ellipsis when exceeding maxWidth", () => {
      const longText = "Very long enterprise table description column text that exceeds container boundary";
      const truncated = truncateText(longText, 60, 10, "Helvetica");
      expect(truncated.endsWith("...")).toBe(true);
      expect(truncated.length).toBeLessThan(longText.length);
      expect(measureTextWidth(truncated, 10, "Helvetica")).toBeLessThanOrEqual(60);
    });

    it("converts byte arrays to base64 encoding", () => {
      const sample = new Uint8Array([72, 111, 110, 111, 67, 117, 98, 101]); // "HonoCube"
      const b64 = uint8ArrayToBase64(sample);
      expect(b64).toBe("SG9ub0N1YmU=");
    });
  });

  describe("exportTableToPdf Functionality", () => {
    it("exports data table with column headers, formatted rows, and title", () => {
      const columns = [
        { key: "id", header: "ID", width: 50, align: "center" as const },
        { key: "customer", header: "Customer Name", width: 180 },
        { key: "status", header: "Status", width: 80, align: "center" as const },
        { key: "revenue", header: "Total Revenue", width: 100, align: "right" as const },
      ];

      const data = [
        { id: "101", customer: "Acme Logistics Ltd", status: "Active", revenue: "$14,500.00" },
        { id: "102", customer: "Beta Global Cargo", status: "Pending", revenue: "$9,250.00" },
        { id: "103", customer: "Gamma Distribution Inc", status: "Active", revenue: "$23,800.00" },
      ];

      const bytes = exportTableToPdf({
        title: "Q4 Customer Revenue Report",
        subtitle: "Generated for Executive Operations",
        columns,
        data,
        paperSize: "a4",
        orientation: "portrait",
      });

      const pdfText = new TextDecoder().decode(bytes);
      expect(pdfText).toContain("Q4 Customer Revenue Report");
      expect(pdfText).toContain("Generated for Executive Operations");
      expect(pdfText).toContain("Customer Name");
      expect(pdfText).toContain("Total Revenue");
      expect(pdfText).toContain("Acme Logistics Ltd");
      expect(pdfText).toContain("$14,500.00");
      expect(pdfText).toContain("Page 1");
    });

    it("automatically paginates large data sets across multiple pages with repeated headers", () => {
      const columns = [
        { key: "sku", header: "SKU", width: 80 },
        { key: "name", header: "Item Name", width: 220 },
        { key: "qty", header: "Stock Qty", width: 80, align: "right" as const },
      ];

      // 60 rows will easily exceed a single A4 page (~35 rows max per page)
      const data = Array.from({ length: 60 }, (_, i) => ({
        sku: `SKU-${1000 + i}`,
        name: `Warehouse Part #${i + 1} Industrial Grade`,
        qty: String((i + 1) * 15),
      }));

      const bytes = exportTableToPdf({
        title: "Inventory Stock Manifest",
        columns,
        data,
      });

      const pdfText = new TextDecoder().decode(bytes);
      expect(pdfText).toContain("/Count 2");
      expect(pdfText).toContain("Page 1");
      expect(pdfText).toContain("Page 2");
      expect(pdfText).toContain("SKU-1000");
      expect(pdfText).toContain("SKU-1059");
    });
  });

  describe("exportDocumentToPdf Functionality", () => {
    const mockCompany: PrintCompanyInfo = {
      name: "Acme Industrial Corp",
      address: ["100 Innovation Way", "Tech District", "San Francisco, CA 94105"],
      taxId: "US-88291039",
    };

    const mockCustomer: PrintCustomerInfo = {
      name: "Johnathan Miller",
      company: "Global Logistics Ltd",
      address: ["450 Warehouse Blvd", "Suite 200", "Chicago, IL 60607"],
    };

    const mockItems: PrintDocumentItem[] = [
      {
        sku: "SKU-H100",
        description: "Heavy-Duty Pallet Jack 5000lb",
        quantity: 2,
        unitPrice: 450,
        amount: 900,
      },
      {
        sku: "SKU-S200",
        description: "Industrial Polyurethane Wheel Set",
        quantity: 4,
        unitPrice: 35,
        amount: 140,
      },
    ];

    const mockTotals: PrintDocumentTotal[] = [
      { label: "Subtotal", value: 1040 },
      { label: "Tax (8.25%)", value: 85.8 },
      { label: "Total Balance Due", value: 1125.8, isGrandTotal: true },
    ];

    it("exports tax invoice with company letterhead, bill to, items table, and totals", () => {
      const bytes = exportDocumentToPdf({
        layout: "invoice",
        documentNumber: "INV-2026-991",
        date: "2026-11-16",
        dueDate: "2026-12-16",
        status: "PAID",
        company: mockCompany,
        customer: mockCustomer,
        items: mockItems,
        totals: mockTotals,
        terms: "Net 30 days. Wire transfer details on invoice.",
        signature: {
          signerName: "Sarah Jenkins, CFO",
          date: "2026-11-16",
        },
      });

      const pdfText = new TextDecoder().decode(bytes);
      expect(pdfText).toContain("TAX INVOICE");
      expect(pdfText).toContain("#INV-2026-991");
      expect(pdfText).toContain("Acme Industrial Corp");
      expect(pdfText).toContain("Johnathan Miller");
      expect(pdfText).toContain("SKU-H100");
      expect(pdfText).toContain("Heavy-Duty Pallet Jack 5000lb");
      expect(pdfText).toContain("$900.00");
      expect(pdfText).toContain("Total Balance Due");
      expect(pdfText).toContain("$1,125.80");
      expect(pdfText).toContain("Sarah Jenkins, CFO");
    });

    it("exports packing slip layout without financial amounts", () => {
      const bytes = exportDocumentToPdf({
        layout: "packing-slip",
        documentNumber: "PS-8012",
        date: "2026-11-16",
        company: mockCompany,
        customer: mockCustomer,
        items: mockItems,
      });

      const pdfText = new TextDecoder().decode(bytes);
      expect(pdfText).toContain("PACKING SLIP");
      expect(pdfText).toContain("#PS-8012");
      expect(pdfText).toContain("VERIFIED");
      expect(pdfText).toContain("Heavy-Duty Pallet Jack 5000lb");
      expect(pdfText).not.toContain("Total Balance Due");
    });
  });

  describe("UI Components & Print Toolbar Integration", () => {
    it("renders ExportPdfButton with label and trigger attributes", () => {
      const handleExport = vi.fn();
      const html = renderToString(
        <ExportPdfButton
          label="Download Invoice PDF"
          onExport={handleExport}
        />
      );

      expect(html).toContain("data-testid=\"export-pdf-button\"");
      expect(html).toContain("Download Invoice PDF");
    });

    it("renders PdfPreviewDialog modal with download button and frame", () => {
      const html = renderToString(
        <PdfPreviewDialog
          open={true}
          onOpenChange={() => {}}
          filename="INV-2026-001.pdf"
          title="Tax Invoice Preview"
          pdfDataUri="data:application/pdf;base64,JVBERi0xLjQK..."
        />
      );

      expect(html).toContain("data-testid=\"pdf-preview-dialog\"");
      expect(html).toContain("Tax Invoice Preview");
      expect(html).toContain("INV-2026-001.pdf");
      expect(html).toContain("data-testid=\"pdf-download-button\"");
      expect(html).toContain("data-testid=\"pdf-preview-frame\"");
    });

    it("renders Export PDF button in PrintDocument preview toolbar", () => {
      const html = renderToString(
        <PrintDocument
          documentNumber="INV-772"
          showPrintButton={true}
          showPdfExport={true}
          items={[]}
        />
      );

      expect(html).toContain("data-testid=\"print-toolbar\"");
      expect(html).toContain("data-testid=\"export-pdf-button\"");
      expect(html).toContain("data-testid=\"print-button\"");
      expect(html).toContain("Export PDF");
      expect(html).toContain("Print Document");
    });
  });
});
