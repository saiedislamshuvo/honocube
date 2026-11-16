import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  defineApp,
  defineCollection,
  f,
  AppProvider,
  FormView,
  BarcodeField,
  QRCodeField,
} from "../src/index.js";

describe("Barcode & QR Code Visual Rendering Primitives (Issue #134)", () => {
  describe("f.barcode() Fluent Builder", () => {
    it("builds a barcode field config with default properties", () => {
      const field = f.barcode("Product SKU").build();

      expect(field.type).toBe("barcode");
      expect(field.label).toBe("Product SKU");
      expect(field.format).toBe("code128");
      expect(field.displayValue).toBe(true);
      expect(field.width).toBe(2);
      expect(field.height).toBe(70);
    });

    it("supports chaining format, displayValue, width, and height", () => {
      const field = f
        .barcode("Asset Tag")
        .format("code39")
        .displayValue(false)
        .width(3)
        .height(90)
        .build();

      expect(field.format).toBe("code39");
      expect(field.displayValue).toBe(false);
      expect(field.width).toBe(3);
      expect(field.height).toBe(90);
    });
  });

  describe("f.qrCode() Fluent Builder", () => {
    it("builds a QR code field config with default properties", () => {
      const field = f.qrCode("Landing URL").build();

      expect(field.type).toBe("qrcode");
      expect(field.label).toBe("Landing URL");
      expect(field.size).toBe(160);
      expect(field.level).toBe("M");
    });

    it("supports chaining size, level, and includeMargin", () => {
      const field = f
        .qrCode("Verification Link")
        .size(240)
        .level("H")
        .includeMargin(false)
        .build();

      expect(field.size).toBe(240);
      expect(field.level).toBe("H");
      expect(field.includeMargin).toBe(false);
    });

    it("supports f.qrcode alias", () => {
      const field = f.qrcode("Invoice Link").size(180).build();
      expect(field.type).toBe("qrcode");
      expect(field.size).toBe(180);
    });
  });

  describe("BarcodeField Component", () => {
    it("renders empty state placeholder when no value is provided", () => {
      const html = renderToString(
        <BarcodeField name="sku" onChange={vi.fn()} placeholder="Enter SKU" />
      );

      expect(html).toContain('placeholder="Enter SKU"');
      expect(html).toContain("Enter a code above to preview the scannable barcode");
      expect(html).not.toContain("<svg");
    });

    it("renders live SVG barcode and copy button when value is set", () => {
      const html = renderToString(
        <BarcodeField name="sku" value="SKU-8899" onChange={vi.fn()} />
      );

      expect(html).toContain('value="SKU-8899"');
      expect(html).toContain("Copy");
      expect(html).toContain("<svg");
      expect(html).toContain('aria-label="Barcode: SKU-8899"');
    });

    it("applies error styling when hasError is true", () => {
      const html = renderToString(
        <BarcodeField name="sku" onChange={vi.fn()} hasError={true} />
      );

      expect(html).toContain("border-destructive");
    });

    it("disables input and copy button when disabled is true", () => {
      const html = renderToString(
        <BarcodeField name="sku" value="LOCKED-CODE" onChange={vi.fn()} disabled={true} />
      );

      expect(html).toContain("disabled");
    });
  });

  describe("QRCodeField Component", () => {
    it("renders empty state placeholder when no value is provided", () => {
      const html = renderToString(
        <QRCodeField name="qr" onChange={vi.fn()} placeholder="Enter URL" />
      );

      expect(html).toContain('placeholder="Enter URL"');
      expect(html).toContain("Enter text or a URL above to preview the scannable QR code");
      expect(html).not.toContain("<svg");
    });

    it("renders live SVG QR code and copy button when value is set", () => {
      const html = renderToString(
        <QRCodeField name="qr" value="https://honocube.dev/asset/42" onChange={vi.fn()} />
      );

      expect(html).toContain('value="https://honocube.dev/asset/42"');
      expect(html).toContain("Copy");
      expect(html).toContain("<svg");
      expect(html).toContain('aria-label="QR Code: https://honocube.dev/asset/42"');
    });

    it("applies error styling when hasError is true", () => {
      const html = renderToString(
        <QRCodeField name="qr" onChange={vi.fn()} hasError={true} />
      );

      expect(html).toContain("border-destructive");
    });

    it("disables input and copy button when disabled is true", () => {
      const html = renderToString(
        <QRCodeField name="qr" value="https://locked.com" onChange={vi.fn()} disabled={true} />
      );

      expect(html).toContain("disabled");
    });
  });

  describe("FormField Integration in FormView", () => {
    it("renders barcode and qrcode fields within FormView", () => {
      const products = defineCollection({
        name: "products",
        fields: {
          title: f.text("Product Title").required(),
          barcode: f.barcode("Barcode").format("code128"),
          qr: f.qrCode("QR Link"),
        },
      });

      const app = defineApp({
        title: "Warehouse Inventory App",
        apiBaseUrl: "/api",
        collections: [products],
      });

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <AppProvider app={app}>
            <FormView
              collection={products}
              initialValues={{
                title: "Industrial Sensor A100",
                barcode: "SKU-A100-2026",
                qr: "https://inventory.acme.com/sensor/A100",
              }}
            />
          </AppProvider>
        </QueryClientProvider>
      );

      expect(html).toContain("Industrial Sensor A100");
      expect(html).toContain("SKU-A100-2026");
      expect(html).toContain("https://inventory.acme.com/sensor/A100");
      expect(html).toContain('aria-label="Barcode: SKU-A100-2026"');
      expect(html).toContain('aria-label="QR Code: https://inventory.acme.com/sensor/A100"');
    });
  });
});
