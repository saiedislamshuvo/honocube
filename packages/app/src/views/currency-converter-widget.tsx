import * as React from "react";
import { useState, useMemo } from "react";
import {
  ArrowRightLeft,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@honocube/ui";
import {
  convertCurrency,
  formatMoney,
  STANDARD_CURRENCIES,
  DEFAULT_EXCHANGE_RATES,
  type CurrencyDefinition,
  type ExchangeRate,
  type CurrencyConverterWidgetProps,
} from "@honocube/core";

export function CurrencyConverterWidget({
  currencies: customCurrencies,
  rates: customRates,
  baseCurrency = "USD",
  initialAmount = 100,
  initialFrom = "EUR",
  initialTo = "USD",
  onConvert,
  className = "",
}: CurrencyConverterWidgetProps): React.JSX.Element {
  const [amount, setAmount] = useState<number>(initialAmount);
  const [from, setFrom] = useState<string>(initialFrom.toUpperCase());
  const [to, setTo] = useState<string>(initialTo.toUpperCase());

  const availableCurrencies: CurrencyDefinition[] = useMemo(() => {
    if (customCurrencies && customCurrencies.length > 0) return customCurrencies;
    return Object.values(STANDARD_CURRENCIES);
  }, [customCurrencies]);

  const activeRates: ExchangeRate[] = useMemo(() => {
    if (customRates && customRates.length > 0) return customRates;
    return DEFAULT_EXCHANGE_RATES;
  }, [customRates]);

  const conversion = useMemo(() => {
    try {
      const res = convertCurrency(amount, from, to, activeRates, baseCurrency);
      if (onConvert) {
        onConvert(res);
      }
      return { success: true, result: res, error: null };
    } catch (err: any) {
      return { success: false, result: null, error: err?.message || "Rate unavailable" };
    }
  }, [amount, from, to, activeRates, baseCurrency, onConvert]);

  const handleSwap = () => {
    const nextFrom = to;
    const nextTo = from;
    setFrom(nextFrom);
    setTo(nextTo);
  };

  return (
    <Card
      data-testid="currency-converter-widget"
      className={`border border-slate-200 shadow-sm dark:border-slate-800 ${className}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <DollarSign className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Live Currency Converter
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
              Instant multi-currency exchange rate calculator.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Input amount */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Amount
          </label>
          <Input
            type="number"
            min="0"
            step="any"
            data-testid="convert-amount-input"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            className="text-sm font-semibold"
          />
        </div>

        {/* Currency selection row */}
        <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-2">
          {/* From Currency */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              From
            </label>
            <select
              data-testid="convert-from-select"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            >
              {availableCurrencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol}) - {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Swap button */}
          <div className="pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="convert-swap-btn"
              onClick={handleSwap}
              title="Swap Currencies"
              className="h-8 w-8 p-0"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* To Currency */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              To
            </label>
            <select
              data-testid="convert-to-select"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            >
              {availableCurrencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol}) - {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Conversion Result Display */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
          {conversion.success && conversion.result ? (
            <div className="space-y-1.5">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {formatMoney(amount, from, { showCode: true }, availableCurrencies)} =
              </div>
              <div
                data-testid="convert-result-amount"
                className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
              >
                {formatMoney(
                  conversion.result.convertedAmount,
                  to,
                  { showCode: true },
                  availableCurrencies
                )}
              </div>
              <div
                data-testid="convert-rate-info"
                className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 pt-1"
              >
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <span>
                  {`1 ${from} = ${conversion.result.rate.toFixed(4)} ${to}`}
                </span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span>
                  {`1 ${to} = ${conversion.result.inverseRate.toFixed(4)} ${from}`}
                </span>
              </div>
            </div>
          ) : (
            <div
              data-testid="convert-error-message"
              className="text-xs text-amber-600 dark:text-amber-400"
            >
              {conversion.error}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
