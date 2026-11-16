import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  defineApp,
  defineCollection,
  AppProvider,
  FormView,
  f,
  MaskedNumericInput,
  formatNumericValue,
  parseNumericString,
  getCurrencySymbol,
} from "../src/index.js";

describe("Interactive Masked Numeric Inputs (Issue #121)", () => {
  describe("Field Builders (f.number, f.currency, f.percent)", () => {
    it("creates standard numeric field with precision and thousandSeparator", () => {
      const field = f
        .number("Conversion Rate")
        .precision(4)
        .thousandSeparator(true)
        .min(0)
        .max(10)
        .build();

      expect(field.type).toBe("number");
      expect(field.label).toBe("Conversion Rate");
      expect(field.precision).toBe(4);
      expect(field.thousandSeparator).toBe(true);
      expect(field.min).toBe(0);
      expect(field.max).toBe(10);
    });

    it("creates currency field with default USD and precision chaining", () => {
      const field = f
        .currency("Product Price")
        .precision(2)
        .padDecimals(true)
        .build();

      expect(field.type).toBe("currency");
      expect(field.format).toBe("currency");
      expect(field.currencyCode).toBe("USD");
      expect(field.precision).toBe(2);
      expect(field.padDecimals).toBe(true);
    });

    it("creates custom currency and suffix fields", () => {
      const field = f
        .currency("Subscription Cost")
        .currencyCode("EUR")
        .precision(2)
        .build();

      expect(field.type).toBe("currency");
      expect(field.currencyCode).toBe("EUR");
    });

    it("creates percentage field with suffix %", () => {
      const field = f.percent("Discount Rate").min(0).max(100).build();

      expect(field.type).toBe("number");
      expect(field.format).toBe("percent");
      expect(field.suffix).toBe("%");
      expect(field.min).toBe(0);
      expect(field.max).toBe(100);
    });
  });

  describe("getCurrencySymbol utility", () => {
    it("resolves narrow currency symbols", () => {
      expect(getCurrencySymbol("USD")).toBe("$");
      expect(getCurrencySymbol("EUR")).toBe("€");
      expect(getCurrencySymbol("GBP")).toBe("£");
    });
  });

  describe("formatNumericValue utility", () => {
    it("formats thousand separators", () => {
      expect(formatNumericValue(1234567)).toBe("1,234,567");
      expect(formatNumericValue(1000)).toBe("1,000");
    });

    it("pads decimals when padDecimals is true", () => {
      expect(
        formatNumericValue(1250.5, { precision: 2, padDecimals: true })
      ).toBe("1,250.50");
      expect(
        formatNumericValue(50, { precision: 2, padDecimals: true })
      ).toBe("50.00");
    });

    it("respects custom thousand separator and negative numbers", () => {
      expect(
        formatNumericValue(-4567.89, {
          thousandSeparator: " ",
          precision: 2,
        })
      ).toBe("-4 567.89");
    });

    it("handles null, undefined, and empty string", () => {
      expect(formatNumericValue(null)).toBe("");
      expect(formatNumericValue(undefined)).toBe("");
      expect(formatNumericValue("")).toBe("");
    });
  });

  describe("parseNumericString utility", () => {
    it("parses formatted strings with commas back to clean numbers", () => {
      expect(parseNumericString("1,234.56")).toBe(1234.56);
      expect(parseNumericString("1,000,000")).toBe(1000000);
    });

    it("enforces decimal precision truncation", () => {
      expect(parseNumericString("10.5555", { precision: 2 })).toBe(10.55);
    });

    it("disallows negative numbers when allowNegative is false", () => {
      expect(parseNumericString("-50", { allowNegative: false })).toBe(50);
    });

    it("returns null for empty or non-numeric inputs", () => {
      expect(parseNumericString("")).toBe(null);
      expect(parseNumericString("   ")).toBe(null);
      expect(parseNumericString("-")).toBe(null);
    });
  });

  describe("MaskedNumericInput Component", () => {
    it("renders currency prefix badge and formatted initial value", () => {
      const html = renderToString(
        <MaskedNumericInput
          name="price"
          format="currency"
          currencyCode="USD"
          value={1250}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("masked-numeric-prefix");
      expect(html).toContain("$");
      expect(html).toContain("1,250.00");
    });

    it("renders percentage suffix badge", () => {
      const html = renderToString(
        <MaskedNumericInput
          name="discount"
          format="percent"
          value={15}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("masked-numeric-suffix");
      expect(html).toContain("%");
      expect(html).toContain("15");
    });

    it("renders custom prefix and suffix", () => {
      const html = renderToString(
        <MaskedNumericInput
          name="weight"
          prefix="Net:"
          suffix="kg"
          value={45.2}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("Net:");
      expect(html).toContain("kg");
    });

    it("renders disabled state", () => {
      const html = renderToString(
        <MaskedNumericInput
          name="amount"
          value={100}
          disabled
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("disabled");
    });

    it("renders error border when hasError is true", () => {
      const html = renderToString(
        <MaskedNumericInput
          name="amount"
          hasError
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("border-destructive");
    });
  });

  describe("FormView Integration", () => {
    it("renders masked numeric fields in FormView", () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      const products = defineCollection({
        name: "products",
        fields: {
          price: f.currency("Sale Price"),
          taxRate: f.percent("Tax Rate"),
          stock: f.number("Stock Qty").thousandSeparator(true),
        },
      });

      const app = defineApp({
        title: "Store App",
        apiBaseUrl: "http://localhost:3000/api",
        collections: [products],
      });

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <AppProvider app={app}>
            <FormView
              collection={products}
              initialValues={{
                price: 2499.99,
                taxRate: 8.5,
                stock: 12000,
              }}
            />
          </AppProvider>
        </QueryClientProvider>
      );

      expect(html).toContain("Sale Price");
      expect(html).toContain("$");
      expect(html).toContain("2,499.99");
      expect(html).toContain("Tax Rate");
      expect(html).toContain("%");
      expect(html).toContain("Stock Qty");
      expect(html).toContain("12,000");
    });
  });
});
