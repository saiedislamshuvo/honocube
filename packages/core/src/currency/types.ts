/**
 * Multi-Currency Management & Foreign Exchange Rate Conversion (Issue #152).
 * ISO-4217 Currency schemas, exchange rate conversion with direct/inverse/triangular
 * resolution, and monetary formatting.
 */

export interface CurrencyDefinition {
  code: string; // ISO-4217 3-letter code (e.g. "USD", "EUR")
  name: string; // e.g. "US Dollar"
  symbol: string; // e.g. "$", "€"
  decimals: number; // e.g. 2 for USD, 0 for JPY
  symbolPosition?: "prefix" | "suffix";
  thousandsSeparator?: string;
  decimalSeparator?: string;
  isBase?: boolean;
  enabled?: boolean;
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  inverseRate?: number;
  source?: string;
  updatedAt: string;
}

export interface MoneyValue {
  amount: number;
  currency: string;
  baseAmount?: number;
  exchangeRate?: number;
}

export interface CurrencyFormatOptions {
  showSymbol?: boolean;
  showCode?: boolean;
  decimals?: number;
  locale?: string;
  symbolPosition?: "prefix" | "suffix";
}

export interface ConversionResult {
  amount: number;
  convertedAmount: number;
  from: string;
  to: string;
  rate: number;
  inverseRate: number;
  updatedAt?: string;
}

export interface CurrencyManagerConfig {
  baseCurrency?: string;
  currencies?: CurrencyDefinition[];
  exchangeRates?: ExchangeRate[];
  onRateUpdated?: (rate: ExchangeRate) => void | Promise<void>;
  onBaseCurrencyChanged?: (newBase: string, oldBase: string) => void | Promise<void>;
}

export const STANDARD_CURRENCIES: Record<string, CurrencyDefinition> = {
  USD: { code: "USD", name: "US Dollar", symbol: "$", decimals: 2, symbolPosition: "prefix", isBase: true, enabled: true },
  EUR: { code: "EUR", name: "Euro", symbol: "€", decimals: 2, symbolPosition: "prefix", enabled: true },
  GBP: { code: "GBP", name: "British Pound", symbol: "£", decimals: 2, symbolPosition: "prefix", enabled: true },
  JPY: { code: "JPY", name: "Japanese Yen", symbol: "¥", decimals: 0, symbolPosition: "prefix", enabled: true },
  CAD: { code: "CAD", name: "Canadian Dollar", symbol: "CA$", decimals: 2, symbolPosition: "prefix", enabled: true },
  AUD: { code: "AUD", name: "Australian Dollar", symbol: "A$", decimals: 2, symbolPosition: "prefix", enabled: true },
  CHF: { code: "CHF", name: "Swiss Franc", symbol: "CHF", decimals: 2, symbolPosition: "prefix", enabled: true },
  CNY: { code: "CNY", name: "Chinese Yuan", symbol: "¥", decimals: 2, symbolPosition: "prefix", enabled: true },
  INR: { code: "INR", name: "Indian Rupee", symbol: "₹", decimals: 2, symbolPosition: "prefix", enabled: true },
  SGD: { code: "SGD", name: "Singapore Dollar", symbol: "S$", decimals: 2, symbolPosition: "prefix", enabled: true },
  BRL: { code: "BRL", name: "Brazilian Real", symbol: "R$", decimals: 2, symbolPosition: "prefix", enabled: true },
  KRW: { code: "KRW", name: "South Korean Won", symbol: "₩", decimals: 0, symbolPosition: "prefix", enabled: true },
  SEK: { code: "SEK", name: "Swedish Krona", symbol: "kr", decimals: 2, symbolPosition: "suffix", enabled: true },
  NZD: { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", decimals: 2, symbolPosition: "prefix", enabled: true },
  MXN: { code: "MXN", name: "Mexican Peso", symbol: "MX$", decimals: 2, symbolPosition: "prefix", enabled: true },
};

export const DEFAULT_BASE_CURRENCY = "USD";

export const DEFAULT_EXCHANGE_RATES: ExchangeRate[] = [
  { from: "EUR", to: "USD", rate: 1.085, inverseRate: 1 / 1.085, source: "Default", updatedAt: new Date().toISOString() },
  { from: "GBP", to: "USD", rate: 1.275, inverseRate: 1 / 1.275, source: "Default", updatedAt: new Date().toISOString() },
  { from: "JPY", to: "USD", rate: 0.0065, inverseRate: 1 / 0.0065, source: "Default", updatedAt: new Date().toISOString() },
  { from: "CAD", to: "USD", rate: 0.735, inverseRate: 1 / 0.735, source: "Default", updatedAt: new Date().toISOString() },
  { from: "AUD", to: "USD", rate: 0.655, inverseRate: 1 / 0.655, source: "Default", updatedAt: new Date().toISOString() },
  { from: "CHF", to: "USD", rate: 1.120, inverseRate: 1 / 1.120, source: "Default", updatedAt: new Date().toISOString() },
  { from: "CNY", to: "USD", rate: 0.138, inverseRate: 1 / 0.138, source: "Default", updatedAt: new Date().toISOString() },
  { from: "INR", to: "USD", rate: 0.012, inverseRate: 1 / 0.012, source: "Default", updatedAt: new Date().toISOString() },
  { from: "SGD", to: "USD", rate: 0.750, inverseRate: 1 / 0.750, source: "Default", updatedAt: new Date().toISOString() },
];

/**
 * Resolve currency details by code with standard ISO fallback
 */
export function getCurrencyDefinition(
  code: string,
  customCurrencies?: CurrencyDefinition[]
): CurrencyDefinition {
  const upper = (code || "USD").toUpperCase().trim();
  if (customCurrencies) {
    const found = customCurrencies.find((c) => c.code.toUpperCase() === upper);
    if (found) return found;
  }
  if (STANDARD_CURRENCIES[upper]) {
    return STANDARD_CURRENCIES[upper];
  }
  return {
    code: upper,
    name: upper,
    symbol: upper,
    decimals: 2,
    symbolPosition: "prefix",
    enabled: true,
  };
}

/**
 * Format currency amount with symbol, decimal precision, and standard separators
 */
export function formatMoney(
  amount: number,
  currencyCode: string = "USD",
  options: CurrencyFormatOptions = {},
  customCurrencies?: CurrencyDefinition[]
): string {
  if (!Number.isFinite(amount)) return "0.00";
  const def = getCurrencyDefinition(currencyCode, customCurrencies);
  const decimals = options.decimals ?? def.decimals;
  const showSymbol = options.showSymbol ?? true;
  const showCode = options.showCode ?? false;
  const symbolPos = options.symbolPosition ?? def.symbolPosition ?? "prefix";

  const numFixed = Math.abs(amount).toFixed(decimals);
  const parts = numFixed.split(".");
  const intPart = parts[0] || "0";
  const decPart = parts[1];

  const thousandsSep = def.thousandsSeparator || ",";
  const decimalSep = def.decimalSeparator || ".";

  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep);
  const formattedNum = decPart !== undefined ? `${formattedInt}${decimalSep}${decPart}` : formattedInt;
  const sign = amount < 0 ? "-" : "";

  let result = formattedNum;

  if (showSymbol) {
    if (symbolPos === "prefix") {
      result = `${def.symbol}${result}`;
    } else {
      result = `${result} ${def.symbol}`;
    }
  }

  if (showCode) {
    result = `${result} ${def.code}`;
  }

  return `${sign}${result}`;
}

/**
 * Currency conversion supporting direct rate, inverse rate, and triangular cross-conversion
 */
export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: ExchangeRate[] | Map<string, number>,
  baseCurrency = DEFAULT_BASE_CURRENCY
): ConversionResult {
  const fromUpper = from.toUpperCase().trim();
  const toUpper = to.toUpperCase().trim();
  const baseUpper = baseCurrency.toUpperCase().trim();

  // Same currency -> 1:1 conversion
  if (fromUpper === toUpper) {
    return {
      amount,
      convertedAmount: amount,
      from: fromUpper,
      to: toUpper,
      rate: 1,
      inverseRate: 1,
    };
  }

  // Build rate lookup helper
  const getRate = (f: string, t: string): number | undefined => {
    if (f === t) return 1;
    if (Array.isArray(rates)) {
      const direct = rates.find((r) => r.from.toUpperCase() === f && r.to.toUpperCase() === t);
      if (direct && direct.rate > 0) return direct.rate;
      const inverse = rates.find((r) => r.from.toUpperCase() === t && r.to.toUpperCase() === f);
      if (inverse && inverse.rate > 0) return 1 / inverse.rate;
    } else if (rates instanceof Map) {
      const key = `${f}:${t}`;
      if (rates.has(key)) return rates.get(key);
      const invKey = `${t}:${f}`;
      if (rates.has(invKey) && rates.get(invKey)! > 0) return 1 / rates.get(invKey)!;
    }
    return undefined;
  };

  // 1. Direct or inverse rate
  const directRate = getRate(fromUpper, toUpper);
  if (directRate !== undefined) {
    const converted = amount * directRate;
    return {
      amount,
      convertedAmount: converted,
      from: fromUpper,
      to: toUpper,
      rate: directRate,
      inverseRate: 1 / directRate,
    };
  }

  // 2. Triangular conversion via base currency
  // from -> base and to -> base
  const fromToBase = getRate(fromUpper, baseUpper);
  const toToBase = getRate(toUpper, baseUpper);

  if (fromToBase !== undefined && toToBase !== undefined && toToBase > 0) {
    // 1 unit of from = fromToBase units of base
    // 1 unit of to = toToBase units of base
    // rate = fromToBase / toToBase
    const crossRate = fromToBase / toToBase;
    const converted = amount * crossRate;
    return {
      amount,
      convertedAmount: converted,
      from: fromUpper,
      to: toUpper,
      rate: crossRate,
      inverseRate: 1 / crossRate,
    };
  }

  throw new Error(`Exchange rate path not found between ${fromUpper} and ${toUpper}`);
}
