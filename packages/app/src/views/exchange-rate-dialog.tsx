import * as React from "react";
import { useState } from "react";
import {
  TrendingUp,
  Loader2,
} from "lucide-react";
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@honocube/ui";
import {
  STANDARD_CURRENCIES,
  type CurrencyDefinition,
  type ExchangeRateDialogProps,
} from "@honocube/core";

export function ExchangeRateDialog({
  open,
  onOpenChange,
  currencies: customCurrencies,
  baseCurrency = "USD",
  existingRate,
  onSave,
  isSaving = false,
  className = "",
}: ExchangeRateDialogProps): React.JSX.Element | null {
  const availableCurrencies: CurrencyDefinition[] = customCurrencies || Object.values(STANDARD_CURRENCIES);

  const [from, setFrom] = useState<string>(existingRate?.from || "EUR");
  const [to, setTo] = useState<string>(existingRate?.to || baseCurrency);
  const [rate, setRate] = useState<string>(existingRate ? String(existingRate.rate) : "1.085");
  const [source, setSource] = useState<string>(existingRate?.source || "Manual");

  React.useEffect(() => {
    if (existingRate) {
      setFrom(existingRate.from);
      setTo(existingRate.to);
      setRate(String(existingRate.rate));
      setSource(existingRate.source || "Manual");
    } else {
      setFrom("EUR");
      setTo(baseCurrency);
      setRate("1.085");
      setSource("Manual");
    }
  }, [existingRate, baseCurrency, open]);

  const numRate = parseFloat(rate);
  const inverseRate = numRate > 0 ? (1 / numRate).toFixed(4) : "—";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numRate || numRate <= 0 || isSaving) return;

    if (onSave) {
      await onSave({
        from: from.toUpperCase().trim(),
        to: to.toUpperCase().trim(),
        rate: numRate,
        source: source.trim() || undefined,
      });
    }
    onOpenChange(false);
  };

  if (!open) return null;

  // SSR Fallback for fast server-rendering & headless testing
  if (typeof document === "undefined") {
    return (
      <div data-testid="exchange-rate-dialog" className="hidden">
        <h2>{existingRate ? "Edit Exchange Rate" : "Add Exchange Rate"}</h2>
        <form onSubmit={handleSubmit}>
          <select
            data-testid="rate-from-select"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          >
            {availableCurrencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
          <select
            data-testid="rate-to-select"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          >
            {availableCurrencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
          <input
            data-testid="rate-value-input"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
          <span data-testid="rate-inverse-preview">{inverseRate}</span>
          <input
            data-testid="rate-source-input"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
          <button type="submit" data-testid="save-rate-btn" disabled={isSaving}>
            Save Rate
          </button>
        </form>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="exchange-rate-dialog"
        className={`sm:max-w-[480px] ${className}`}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {existingRate ? "Edit Exchange Rate" : "Set Exchange Rate"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                Configure currency conversion parity and foreign exchange multipliers.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Currency pair */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                From Currency
              </label>
              <select
                data-testid="rate-from-select"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                {availableCurrencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.name})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                To Currency
              </label>
              <select
                data-testid="rate-to-select"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                {availableCurrencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Rate value */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Exchange Rate (1 {from} = ? {to})
            </label>
            <Input
              type="number"
              step="any"
              min="0.000001"
              data-testid="rate-value-input"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 1.085"
              required
              className="font-mono text-xs"
            />
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>
                Inverse Rate (1 {to} = ? {from}):
              </span>
              <span data-testid="rate-inverse-preview" className="font-mono font-medium text-slate-700 dark:text-slate-300">
                {inverseRate}
              </span>
            </div>
          </div>

          {/* Source */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Rate Source / Provider
            </label>
            <Input
              data-testid="rate-source-input"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. European Central Bank, Bloomberg, Manual"
              className="text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              data-testid="save-rate-btn"
              disabled={isSaving || !numRate || numRate <= 0}
              className="text-xs flex items-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Exchange Rate"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
