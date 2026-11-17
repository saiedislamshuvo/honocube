import React from "react";
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  PrintDocument,
  PrintDocumentDialog,
  type PrintCompanyInfo,
  type PrintCustomerInfo,
  type PrintDocumentItem,
  type PrintDocumentTotal,
} from "../src/index.js";

describe("Print-Optimized Document Layouts (Issue #122)", () => {
  const mockCompany: PrintCompanyInfo = {
    name: "Acme Industrial Corp",
    logo: "https://example.com/logo.png",
    address: ["100 Innovation Way", "Tech District", "San Francisco, CA 94105"],
    taxId: "US-88291039",
    phone: "+1 (555) 019-2834",
    email: "billing@acmeindustrial.com",
    website: "https://acmeindustrial.com",
  };

  const mockCustomer: PrintCustomerInfo = {
    name: "Johnathan Miller",
    company: "Global Logistics Ltd",
    address: ["450 Warehouse Blvd", "Suite 200", "Chicago, IL 60607"],
    email: "jmiller@globallogistics.com",
    phone: "+1 (312) 555-8821",
    taxId: "IL-992104",
  };

  const mockShippingAddress: PrintCustomerInfo = {
    name: "Receiving Bay 4",
    company: "Global Logistics Midwest Hub",
    address: ["460 Warehouse Blvd", "Dock 12", "Chicago, IL 60607"],
    phone: "+1 (312) 555-8825",
  };

  const mockItems: PrintDocumentItem[] = [
    {
      sku: "SKU-H100",
      description: "Heavy-Duty Pallet Jack 5000lb",
      quantity: 2,
      unitPrice: 450,
      amount: 900,
      notes: "Yellow powder-coated finish",
    },
    {
      sku: "SKU-S200",
      description: "Industrial Polyurethane Wheel Set",
      quantity: 4,
      unitPrice: 35,
      discount: "10%",
      amount: 126,
    },
  ];

  const mockTotals: PrintDocumentTotal[] = [
    { label: "Subtotal", value: 1026 },
    { label: "State Tax (8.25%)", value: 84.65 },
    { label: "Freight Delivery", value: 50 },
    { label: "Total Balance Due", value: 1160.65, isGrandTotal: true },
  ];

  describe("Invoice Layout", () => {
    it("renders full tax invoice with company details, document identity, addresses, items, and totals", () => {
      const html = renderToString(
        <PrintDocument
          layout="invoice"
          paperSize="a4"
          documentNumber="INV-2026-0891"
          date="2026-11-16"
          dueDate="2026-12-16"
          status="PAID"
          company={mockCompany}
          customer={mockCustomer}
          shippingAddress={mockShippingAddress}
          items={mockItems}
          totals={mockTotals}
          notes="Thank you for your order! Goods remain property of Acme until fully paid."
          terms="Net 30 days. Wire transfer details: Chase Bank AC# 99281726"
          barcodeOrQrValue="INV-2026-0891"
          signature={{
            signerName: "Sarah Jenkins, CFO",
            date: "2026-11-16",
          }}
        />
      );

      // Document identity
      expect(html).toContain("data-testid=\"printable-document\"");
      expect(html).toContain("TAX INVOICE");
      expect(html).toContain("#INV-2026-0891");
      expect(html).toContain("PAID");

      // Company info
      expect(html).toContain("Acme Industrial Corp");
      expect(html).toContain("100 Innovation Way");
      expect(html).toContain("US-88291039");
      expect(html).toContain("billing@acmeindustrial.com");

      // Customer Bill To & Ship To
      expect(html).toContain("Johnathan Miller");
      expect(html).toContain("Global Logistics Ltd");
      expect(html).toContain("Receiving Bay 4");
      expect(html).toContain("Dock 12");

      // Line items
      expect(html).toContain("SKU-H100");
      expect(html).toContain("Heavy-Duty Pallet Jack 5000lb");
      expect(html).toContain("Yellow powder-coated finish");
      expect(html).toContain("SKU-S200");
      expect(html).toContain("$900.00");
      expect(html).toContain("$126.00");

      // Financial totals
      expect(html).toContain("Subtotal");
      expect(html).toContain("State Tax (8.25%)");
      expect(html).toContain("Total Balance Due");
      expect(html).toContain("$1,160.65");

      // Terms & Signature
      expect(html).toContain("Chase Bank AC# 99281726");
      expect(html).toContain("Sarah Jenkins, CFO");

      // Embedded media print styling
      expect(html).toContain("@media print");
      expect(html).toContain("table-header-group");
      expect(html).toContain(".no-print");
    });
  });

  describe("Packing Slip Layout", () => {
    it("renders packing slip layout with shipping details and warehouse verification boxes", () => {
      const html = renderToString(
        <PrintDocument
          layout="packing-slip"
          paperSize="letter"
          documentNumber="PS-2026-552"
          date="2026-11-16"
          company={mockCompany}
          customer={mockCustomer}
          shippingAddress={mockShippingAddress}
          items={mockItems}
          barcodeOrQrValue="PS-2026-552"
        />
      );

      expect(html).toContain("PACKING SLIP");
      expect(html).toContain("#PS-2026-552");
      expect(html).toContain("Ship To / Delivery Destination");
      expect(html).toContain("Dock 12");
      expect(html).toContain("Verified");
      expect(html).toContain("SKU-H100");

      // Should omit invoice pricing and financial totals
      expect(html).not.toContain("Total Balance Due");
      expect(html).not.toContain("Due Date:");
    });
  });

  describe("Thermal Receipt Layout (80mm)", () => {
    it("renders compact 80mm roll receipt with centered company header and dashed dividers", () => {
      const html = renderToString(
        <PrintDocument
          layout="receipt"
          paperSize="receipt80mm"
          documentNumber="REC-9021"
          date="2026-11-16"
          company={mockCompany}
          customer={mockCustomer}
          items={mockItems}
          totals={mockTotals}
          barcodeOrQrValue="REC-9021"
        />
      );

      expect(html).toContain("RECEIPT");
      expect(html).toContain("REC-9021");
      expect(html).toContain("Acme Industrial Corp");
      expect(html).toContain("Heavy-Duty Pallet Jack 5000lb");
      expect(html).toContain("border-dashed");
      expect(html).toContain("80mm auto");
    });
  });

  describe("PrintDocumentDialog Component", () => {
    it("renders modal print preview dialog with layout controls", () => {
      const html = renderToString(
        <PrintDocumentDialog
          open={true}
          onOpenChange={() => {}}
          company={mockCompany}
          customer={mockCustomer}
          items={mockItems}
          totals={mockTotals}
        />
      );

      expect(html).toContain("data-testid=\"print-document-dialog\"");
      expect(html).toContain("Print Preview");
      expect(html).toContain("Invoice");
      expect(html).toContain("Packing Slip");
      expect(html).toContain("Receipt");
      expect(html).toContain("A4");
      expect(html).toContain("Letter");
    });
  });
});
