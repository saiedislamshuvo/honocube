import { describe, expect, it } from "vitest";
import {
  createCurrencyManager,
  createApp,
  type CurrencyDefinition,
} from "../../src/index.js";

describe("Multi-Currency Management & Foreign Exchange Engine (Issue #152)", () => {
  describe("CurrencyManager Core Engine", () => {
    it("initializes with default base currency and standard ISO currencies", () => {
      const manager = createCurrencyManager();
      expect(manager.getBaseCurrency()).toBe("USD");

      const currencies = manager.listCurrencies();
      expect(currencies.length).toBeGreaterThanOrEqual(10);

      const usd = manager.getCurrency("USD");
      expect(usd?.isBase).toBe(true);
      expect(usd?.symbol).toBe("$");
      expect(usd?.decimals).toBe(2);

      const jpy = manager.getCurrency("JPY");
      expect(jpy?.decimals).toBe(0);
      expect(jpy?.symbol).toBe("¥");
    });

    it("updates base currency and updates isBase indicators across catalog", async () => {
      const manager = createCurrencyManager();
      await manager.setBaseCurrency("EUR");

      expect(manager.getBaseCurrency()).toBe("EUR");
      expect(manager.getCurrency("EUR")?.isBase).toBe(true);
      expect(manager.getCurrency("USD")?.isBase).toBe(false);
    });

    it("adds custom currency, updates definitions, and toggles active status", () => {
      const manager = createCurrencyManager();
      const aed: CurrencyDefinition = {
        code: "AED",
        name: "UAE Dirham",
        symbol: "د.إ",
        decimals: 2,
        symbolPosition: "suffix",
      };

      manager.addCurrency(aed);
      expect(manager.getCurrency("AED")).toBeDefined();
      expect(manager.getCurrency("AED")?.name).toBe("UAE Dirham");

      manager.toggleCurrency("AED", false);
      expect(manager.getCurrency("AED")?.enabled).toBe(false);

      const enabledOnly = manager.listCurrencies({ enabled: true });
      expect(enabledOnly.find((c) => c.code === "AED")).toBeUndefined();
    });

    it("prevents deleting the active base currency", () => {
      const manager = createCurrencyManager();
      expect(() => manager.removeCurrency("USD")).toThrow(
        "Cannot delete base currency (USD). Set another base currency first."
      );
    });

    it("performs direct, inverse, and triangular cross-currency conversions accurately", async () => {
      const manager = createCurrencyManager({
        baseCurrency: "USD",
        exchangeRates: [
          { from: "EUR", to: "USD", rate: 1.10, updatedAt: new Date().toISOString() },
          { from: "GBP", to: "USD", rate: 1.25, updatedAt: new Date().toISOString() },
        ],
      });

      // 1. Same currency conversion (1:1)
      const same = manager.convert(100, "USD", "USD");
      expect(same.convertedAmount).toBe(100);
      expect(same.rate).toBe(1);

      // 2. Direct conversion (EUR -> USD: 100 * 1.10 = 110)
      const direct = manager.convert(100, "EUR", "USD");
      expect(direct.convertedAmount).toBeCloseTo(110, 2);
      expect(direct.rate).toBe(1.10);

      // 3. Inverse conversion (USD -> EUR: 110 * (1 / 1.10) = 100)
      const inverse = manager.convert(110, "USD", "EUR");
      expect(inverse.convertedAmount).toBeCloseTo(100, 2);

      // 4. Triangular cross conversion (EUR -> GBP via USD: 100 EUR = 110 USD = 110 / 1.25 = 88 GBP)
      const triangular = manager.convert(100, "EUR", "GBP");
      expect(triangular.convertedAmount).toBeCloseTo(88, 2);
      expect(triangular.rate).toBeCloseTo(1.10 / 1.25, 4);

      // 5. Normalization to base
      const normalized = manager.normalizeToBase(250, "EUR");
      expect(normalized.baseAmount).toBeCloseTo(275, 2);
      expect(normalized.baseCurrency).toBe("USD");
    });

    it("formats monetary amounts with symbols and decimals", () => {
      const manager = createCurrencyManager();
      expect(manager.formatAmount(1250.5, "USD")).toBe("$1,250.50");
      expect(manager.formatAmount(5000, "JPY")).toBe("¥5,000");
      expect(manager.formatAmount(-45.2, "EUR")).toBe("-€45.20");
    });
  });

  describe("Hono REST Multi-Currency Endpoints", () => {
    it("serves currency catalog, rate management, and conversion API routes", async () => {
      const app = createApp({
        currency: {
          baseCurrency: "USD",
          exchangeRates: [
            { from: "EUR", to: "USD", rate: 1.08, updatedAt: new Date().toISOString() },
          ],
        },
      });

      const api = app.defineApi({});

      // 1. GET /currencies
      const getCurrenciesRes = await api.request("/currencies");
      expect(getCurrenciesRes.status).toBe(200);
      const currenciesJson = await getCurrenciesRes.json();
      expect(currenciesJson.baseCurrency).toBe("USD");
      expect(currenciesJson.data.length).toBeGreaterThan(0);

      // 2. POST /currencies
      const addRes = await api.request("/currencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "SGD",
          name: "Singapore Dollar",
          symbol: "S$",
          decimals: 2,
        }),
      });
      expect(addRes.status).toBe(201);
      const addJson = await addRes.json();
      expect(addJson.data.code).toBe("SGD");

      // 3. PUT /currencies/base
      const setBaseRes = await api.request("/currencies/base", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "EUR" }),
      });
      expect(setBaseRes.status).toBe(200);
      const setBaseJson = await setBaseRes.json();
      expect(setBaseJson.baseCurrency).toBe("EUR");

      // Reset base back to USD
      await api.request("/currencies/base", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "USD" }),
      });

      // 4. POST /currencies/rates & GET /currencies/rates
      const setRateRes = await api.request("/currencies/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "CAD",
          to: "USD",
          rate: 0.74,
          source: "Bank of Canada",
        }),
      });
      expect(setRateRes.status).toBe(200);

      const getRatesRes = await api.request("/currencies/rates");
      expect(getRatesRes.status).toBe(200);
      const ratesJson = await getRatesRes.json();
      expect(ratesJson.data.some((r: any) => r.from === "CAD" && r.to === "USD")).toBe(true);

      // 5. POST /currencies/convert
      const convertRes = await api.request("/currencies/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: 200,
          from: "CAD",
          to: "USD",
        }),
      });
      expect(convertRes.status).toBe(200);
      const convertJson = await convertRes.json();
      expect(convertJson.data.convertedAmount).toBeCloseTo(148, 2);
      expect(convertJson.data.rate).toBe(0.74);

      // 6. DELETE /currencies/:code
      const deleteRes = await api.request("/currencies/SGD", {
        method: "DELETE",
      });
      expect(deleteRes.status).toBe(200);
    });
  });
});
