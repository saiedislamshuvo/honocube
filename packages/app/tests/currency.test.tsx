import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  convertCurrency,
  formatMoney,
  STANDARD_CURRENCIES,
  DEFAULT_EXCHANGE_RATES,
  CurrencyConverterWidget,
  ExchangeRateDialog,
  CurrencySettingsView,
  type CurrencyDefinition,
  type ExchangeRate,
} from "../src/index.js";

describe("Multi-Currency Management & Foreign Exchange UI (Issue #152)", () => {
  describe("Currency Utilities", () => {
    it("formats monetary values with currency symbols and decimals", () => {
      expect(formatMoney(1250.5, "USD")).toBe("$1,250.50");
      expect(formatMoney(2500000, "EUR")).toBe("€2,500,000.00");
      expect(formatMoney(4500, "JPY")).toBe("¥4,500");
      expect(formatMoney(-50.25, "GBP")).toBe("-£50.25");
      expect(formatMoney(99.9, "USD", { showCode: true })).toBe("$99.90 USD");
    });

    it("converts amounts across direct and triangular currency pairs", () => {
      const rates: ExchangeRate[] = [
        { from: "EUR", to: "USD", rate: 1.10, updatedAt: new Date().toISOString() },
        { from: "CAD", to: "USD", rate: 0.75, updatedAt: new Date().toISOString() },
      ];

      // Same
      expect(convertCurrency(50, "USD", "USD", rates).convertedAmount).toBe(50);

      // Direct
      const direct = convertCurrency(100, "EUR", "USD", rates);
      expect(direct.convertedAmount).toBeCloseTo(110, 2);

      // Inverse
      const inverse = convertCurrency(110, "USD", "EUR", rates);
      expect(inverse.convertedAmount).toBeCloseTo(100, 2);

      // Triangular
      const triangular = convertCurrency(100, "EUR", "CAD", rates);
      expect(triangular.convertedAmount).toBeCloseTo(110 / 0.75, 2);
    });
  });

  describe("CurrencyConverterWidget Component", () => {
    it("renders converter controls and live calculation result", () => {
      const html = renderToString(
        <CurrencyConverterWidget
          initialAmount={100}
          initialFrom="EUR"
          initialTo="USD"
        />
      );

      expect(html).toContain("data-testid=\"currency-converter-widget\"");
      expect(html).toContain("Live Currency Converter");
      expect(html).toContain("data-testid=\"convert-amount-input\"");
      expect(html).toContain("data-testid=\"convert-from-select\"");
      expect(html).toContain("data-testid=\"convert-swap-btn\"");
      expect(html).toContain("data-testid=\"convert-to-select\"");
      expect(html).toContain("data-testid=\"convert-result-amount\"");
      expect(html).toContain("data-testid=\"convert-rate-info\"");
      expect(html).toContain("1 EUR =");
    });
  });

  describe("ExchangeRateDialog Component", () => {
    it("renders currency pair selectors, rate input, and inverse rate preview", () => {
      const sampleRate: ExchangeRate = {
        from: "EUR",
        to: "USD",
        rate: 1.085,
        source: "ECB",
        updatedAt: new Date().toISOString(),
      };

      const html = renderToString(
        <ExchangeRateDialog
          open={true}
          onOpenChange={vi.fn()}
          existingRate={sampleRate}
          onSave={vi.fn()}
        />
      );

      expect(html).toContain("data-testid=\"exchange-rate-dialog\"");
      expect(html).toContain("Edit Exchange Rate");
      expect(html).toContain("data-testid=\"rate-from-select\"");
      expect(html).toContain("data-testid=\"rate-to-select\"");
      expect(html).toContain("data-testid=\"rate-value-input\"");
      expect(html).toContain("data-testid=\"rate-inverse-preview\"");
      expect(html).toContain("data-testid=\"rate-source-input\"");
      expect(html).toContain("data-testid=\"save-rate-btn\"");
    });
  });

  describe("CurrencySettingsView Component", () => {
    it("renders overview metrics and rate table", () => {
      const customCurrencies: CurrencyDefinition[] = [
        STANDARD_CURRENCIES.USD,
        STANDARD_CURRENCIES.EUR,
        STANDARD_CURRENCIES.GBP,
      ];

      const html = renderToString(
        <CurrencySettingsView
          baseCurrency="USD"
          currencies={customCurrencies}
          rates={DEFAULT_EXCHANGE_RATES}
          onSetBaseCurrency={vi.fn()}
          onToggleCurrency={vi.fn()}
          onSaveRate={vi.fn()}
          onDeleteRate={vi.fn()}
        />
      );

      // Stat cards
      expect(html).toContain("data-testid=\"currency-settings-view\"");
      expect(html).toContain("data-testid=\"metric-base-currency\"");
      expect(html).toContain("USD");
      expect(html).toContain("data-testid=\"metric-active-currencies\"");
      expect(html).toContain("data-testid=\"metric-rates-count\"");

      // Tabs
      expect(html).toContain("data-testid=\"tab-rates\"");
      expect(html).toContain("data-testid=\"tab-currencies\"");
      expect(html).toContain("data-testid=\"tab-converter\"");

      // Action button
      expect(html).toContain("data-testid=\"open-add-rate-btn\"");

      // Rate table
      expect(html).toContain("data-testid=\"exchange-rates-table\"");
      expect(html).toContain("data-testid=\"rate-row-EUR-USD\"");
      expect(html).toContain("data-testid=\"rate-row-GBP-USD\"");
      expect(html).toContain("data-testid=\"edit-rate-EUR-USD\"");
    });
  });
});
