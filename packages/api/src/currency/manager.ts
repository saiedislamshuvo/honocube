/**
 * Multi-Currency Management & Foreign Exchange Engine (Issue #152).
 * Provides base currency configuration, currency catalog management, exchange rate
 * lookups, and direct/inverse/triangular currency conversions for financial reporting.
 */

export interface CurrencyDefinition {
  code: string; // ISO-4217 code
  name: string;
  symbol: string;
  decimals: number;
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

export interface ConversionResult {
  amount: number;
  convertedAmount: number;
  from: string;
  to: string;
  rate: number;
  inverseRate: number;
  updatedAt?: string;
}

export interface CurrencyFormatOptions {
  showSymbol?: boolean;
  showCode?: boolean;
  decimals?: number;
  symbolPosition?: "prefix" | "suffix";
}

export interface CurrencyManagerConfig {
  baseCurrency?: string;
  currencies?: CurrencyDefinition[];
  exchangeRates?: ExchangeRate[];
  onRateUpdated?: (rate: ExchangeRate) => void | Promise<void>;
  onBaseCurrencyChanged?: (newBase: string, oldBase: string) => void | Promise<void>;
  authorize?: (c: any, appContext: any) => boolean | Promise<boolean>;
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

export interface CurrencyManager {
  getBaseCurrency: () => string;
  setBaseCurrency: (code: string) => Promise<string> | string;
  listCurrencies: (filter?: { enabled?: boolean }) => CurrencyDefinition[];
  getCurrency: (code: string) => CurrencyDefinition | undefined;
  addCurrency: (currency: CurrencyDefinition) => CurrencyDefinition;
  updateCurrency: (code: string, updates: Partial<CurrencyDefinition>) => CurrencyDefinition;
  toggleCurrency: (code: string, enabled?: boolean) => CurrencyDefinition;
  removeCurrency: (code: string) => boolean;
  listRates: () => ExchangeRate[];
  getRate: (from: string, to: string) => number | undefined;
  setRate: (from: string, to: string, rate: number, source?: string) => Promise<ExchangeRate> | ExchangeRate;
  deleteRate: (from: string, to: string) => boolean;
  convert: (amount: number, from: string, to: string) => ConversionResult;
  normalizeToBase: (amount: number, from: string) => { amount: number; baseAmount: number; rate: number; from: string; baseCurrency: string };
  formatAmount: (amount: number, currencyCode?: string, options?: CurrencyFormatOptions) => string;
}

export function createCurrencyManager(config: CurrencyManagerConfig = {}): CurrencyManager {
  let baseCurrency = (config.baseCurrency || DEFAULT_BASE_CURRENCY).toUpperCase().trim();
  const currencies = new Map<string, CurrencyDefinition>();
  const rates = new Map<string, ExchangeRate>();

  // Populate default standard currencies
  for (const [code, def] of Object.entries(STANDARD_CURRENCIES)) {
    currencies.set(code, {
      ...def,
      isBase: code === baseCurrency,
    });
  }

  // Populate custom currencies
  if (config.currencies) {
    for (const c of config.currencies) {
      const code = c.code.toUpperCase().trim();
      currencies.set(code, {
        ...c,
        code,
        isBase: code === baseCurrency,
      });
    }
  }

  // Populate rates
  const initialRates = config.exchangeRates || DEFAULT_EXCHANGE_RATES;
  for (const r of initialRates) {
    const from = r.from.toUpperCase().trim();
    const to = r.to.toUpperCase().trim();
    const key = `${from}:${to}`;
    rates.set(key, {
      ...r,
      from,
      to,
      inverseRate: r.inverseRate ?? (r.rate > 0 ? 1 / r.rate : 0),
    });
  }

  const getBaseCurrency = (): string => baseCurrency;

  const setBaseCurrency = async (code: string): Promise<string> => {
    const upper = code.toUpperCase().trim();
    if (!currencies.has(upper)) {
      throw new Error(`Currency ${upper} is not registered.`);
    }
    const oldBase = baseCurrency;
    baseCurrency = upper;

    // Update isBase flags
    for (const [c, def] of currencies.entries()) {
      currencies.set(c, {
        ...def,
        isBase: c === upper,
      });
    }

    if (config.onBaseCurrencyChanged && oldBase !== upper) {
      await config.onBaseCurrencyChanged(upper, oldBase);
    }

    return baseCurrency;
  };

  const listCurrencies = (filter?: { enabled?: boolean }): CurrencyDefinition[] => {
    let list = Array.from(currencies.values());
    if (filter?.enabled !== undefined) {
      list = list.filter((c) => (c.enabled !== false) === filter.enabled);
    }
    return list.sort((a, b) => {
      if (a.isBase) return -1;
      if (b.isBase) return 1;
      return a.code.localeCompare(b.code);
    });
  };

  const getCurrency = (code: string): CurrencyDefinition | undefined => {
    return currencies.get(code.toUpperCase().trim());
  };

  const addCurrency = (currency: CurrencyDefinition): CurrencyDefinition => {
    const code = currency.code.toUpperCase().trim();
    const created: CurrencyDefinition = {
      ...currency,
      code,
      decimals: currency.decimals ?? 2,
      symbol: currency.symbol || code,
      symbolPosition: currency.symbolPosition || "prefix",
      enabled: currency.enabled !== false,
      isBase: code === baseCurrency,
    };
    currencies.set(code, created);
    return created;
  };

  const updateCurrency = (code: string, updates: Partial<CurrencyDefinition>): CurrencyDefinition => {
    const upper = code.toUpperCase().trim();
    const existing = currencies.get(upper);
    if (!existing) {
      throw new Error(`Currency ${upper} not found.`);
    }
    const updated: CurrencyDefinition = {
      ...existing,
      ...updates,
      code: upper,
    };
    currencies.set(upper, updated);
    return updated;
  };

  const toggleCurrency = (code: string, enabled?: boolean): CurrencyDefinition => {
    const upper = code.toUpperCase().trim();
    const existing = currencies.get(upper);
    if (!existing) {
      throw new Error(`Currency ${upper} not found.`);
    }
    const nextEnabled = enabled !== undefined ? enabled : !existing.enabled;
    const updated = { ...existing, enabled: nextEnabled };
    currencies.set(upper, updated);
    return updated;
  };

  const removeCurrency = (code: string): boolean => {
    const upper = code.toUpperCase().trim();
    if (upper === baseCurrency) {
      throw new Error(`Cannot delete base currency (${upper}). Set another base currency first.`);
    }
    return currencies.delete(upper);
  };

  const listRates = (): ExchangeRate[] => {
    return Array.from(rates.values()).sort((a, b) => a.from.localeCompare(b.from));
  };

  const getRate = (from: string, to: string): number | undefined => {
    const f = from.toUpperCase().trim();
    const t = to.toUpperCase().trim();
    if (f === t) return 1;

    // Direct
    const direct = rates.get(`${f}:${t}`);
    if (direct && direct.rate > 0) return direct.rate;

    // Inverse
    const inverse = rates.get(`${t}:${f}`);
    if (inverse && inverse.rate > 0) return 1 / inverse.rate;

    // Triangular
    const fToBase = rates.get(`${f}:${baseCurrency}`)?.rate ?? (rates.get(`${baseCurrency}:${f}`) ? 1 / rates.get(`${baseCurrency}:${f}`)!.rate : undefined);
    const tToBase = rates.get(`${t}:${baseCurrency}`)?.rate ?? (rates.get(`${baseCurrency}:${t}`) ? 1 / rates.get(`${baseCurrency}:${t}`)!.rate : undefined);
    if (fToBase !== undefined && tToBase !== undefined && tToBase > 0) {
      return fToBase / tToBase;
    }

    return undefined;
  };

  const setRate = async (
    from: string,
    to: string,
    rate: number,
    source: string = "Manual"
  ): Promise<ExchangeRate> => {
    if (rate <= 0) {
      throw new Error("Exchange rate must be greater than 0");
    }
    const f = from.toUpperCase().trim();
    const t = to.toUpperCase().trim();
    const exchangeRate: ExchangeRate = {
      from: f,
      to: t,
      rate,
      inverseRate: 1 / rate,
      source,
      updatedAt: new Date().toISOString(),
    };
    rates.set(`${f}:${t}`, exchangeRate);

    if (config.onRateUpdated) {
      await config.onRateUpdated(exchangeRate);
    }

    return exchangeRate;
  };

  const deleteRate = (from: string, to: string): boolean => {
    const f = from.toUpperCase().trim();
    const t = to.toUpperCase().trim();
    const deleted = rates.delete(`${f}:${t}`);
    const invDeleted = rates.delete(`${t}:${f}`);
    return deleted || invDeleted;
  };

  const convert = (amount: number, from: string, to: string): ConversionResult => {
    const f = from.toUpperCase().trim();
    const t = to.toUpperCase().trim();
    if (f === t) {
      return {
        amount,
        convertedAmount: amount,
        from: f,
        to: t,
        rate: 1,
        inverseRate: 1,
      };
    }

    const calculatedRate = getRate(f, t);
    if (calculatedRate === undefined) {
      throw new Error(`Exchange rate path not found between ${f} and ${t}`);
    }

    const convertedAmount = amount * calculatedRate;
    return {
      amount,
      convertedAmount,
      from: f,
      to: t,
      rate: calculatedRate,
      inverseRate: 1 / calculatedRate,
      updatedAt: new Date().toISOString(),
    };
  };

  const normalizeToBase = (
    amount: number,
    from: string
  ): { amount: number; baseAmount: number; rate: number; from: string; baseCurrency: string } => {
    const res = convert(amount, from, baseCurrency);
    return {
      amount,
      baseAmount: res.convertedAmount,
      rate: res.rate,
      from: res.from,
      baseCurrency,
    };
  };

  const formatAmount = (
    amount: number,
    currencyCode?: string,
    options: CurrencyFormatOptions = {}
  ): string => {
    const code = (currencyCode || baseCurrency).toUpperCase().trim();
    const def = currencies.get(code) || {
      code,
      name: code,
      symbol: code,
      decimals: 2,
      symbolPosition: "prefix" as const,
      enabled: true,
    };

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
      result = symbolPos === "prefix" ? `${def.symbol}${result}` : `${result} ${def.symbol}`;
    }
    if (showCode) {
      result = `${result} ${def.code}`;
    }
    return `${sign}${result}`;
  };

  return {
    getBaseCurrency,
    setBaseCurrency,
    listCurrencies,
    getCurrency,
    addCurrency,
    updateCurrency,
    toggleCurrency,
    removeCurrency,
    listRates,
    getRate,
    setRate,
    deleteRate,
    convert,
    normalizeToBase,
    formatAmount,
  };
}
