import * as React from "react";
import { useState, useMemo } from "react";
import {
  Coins,
  Plus,
  Trash2,
  Edit2,
  Star,
} from "lucide-react";
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Switch,
} from "@honocube/ui";
import {
  STANDARD_CURRENCIES,
  DEFAULT_EXCHANGE_RATES,
  type CurrencyDefinition,
  type ExchangeRate,
  type CurrencySettingsViewProps,
} from "@honocube/core";
import { ExchangeRateDialog } from "./exchange-rate-dialog.js";
import { CurrencyConverterWidget } from "./currency-converter-widget.js";

export function CurrencySettingsView({
  currencies: customCurrencies,
  rates: customRates,
  baseCurrency = "USD",
  onSetBaseCurrency,
  onAddCurrency: _onAddCurrency,
  onToggleCurrency,
  onSaveRate,
  onDeleteRate,
  className = "",
}: CurrencySettingsViewProps): React.JSX.Element {
  const [isRateDialogOpen, setIsRateDialogOpen] = useState<boolean>(false);
  const [editingRate, setEditingRate] = useState<ExchangeRate | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<"rates" | "currencies" | "converter">("rates");

  const currencies: CurrencyDefinition[] = useMemo(() => {
    const list = customCurrencies && customCurrencies.length > 0
      ? customCurrencies
      : Object.values(STANDARD_CURRENCIES);

    return list.map((c) => ({
      ...c,
      isBase: c.code.toUpperCase() === baseCurrency.toUpperCase(),
    }));
  }, [customCurrencies, baseCurrency]);

  const rates: ExchangeRate[] = useMemo(() => {
    return customRates && customRates.length > 0 ? customRates : DEFAULT_EXCHANGE_RATES;
  }, [customRates]);

  const activeCurrenciesCount = useMemo(() => {
    return currencies.filter((c) => c.enabled !== false).length;
  }, [currencies]);

  const handleOpenAddRate = () => {
    setEditingRate(undefined);
    setIsRateDialogOpen(true);
  };

  const handleOpenEditRate = (rate: ExchangeRate) => {
    setEditingRate(rate);
    setIsRateDialogOpen(true);
  };

  return (
    <div
      data-testid="currency-settings-view"
      className={`space-y-6 p-6 max-w-7xl mx-auto ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Coins className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            Multi-Currency &amp; Exchange Rates
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure enterprise currency catalogs, benchmark exchange rates, and financial normalization rules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            data-testid="open-add-rate-btn"
            onClick={handleOpenAddRate}
            className="text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Set Exchange Rate
          </Button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1: Base Currency */}
        <Card data-testid="metric-base-currency">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Workspace Base Currency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {baseCurrency}
              </span>
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300">
                Default Ledger
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              All financial reports and charts normalize to this currency
            </p>
          </CardContent>
        </Card>

        {/* Metric 2: Active Currencies */}
        <Card data-testid="metric-active-currencies">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Enabled Currencies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {activeCurrenciesCount} / {currencies.length}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Active ISO-4217 currencies
            </p>
          </CardContent>
        </Card>

        {/* Metric 3: Configured Rates */}
        <Card data-testid="metric-rates-count">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Active Exchange Rates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {rates.length}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Configured conversion pairs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          data-testid="tab-rates"
          onClick={() => setActiveTab("rates")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "rates"
              ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Exchange Rates ({rates.length})
        </button>
        <button
          type="button"
          data-testid="tab-currencies"
          onClick={() => setActiveTab("currencies")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "currencies"
              ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Currencies Catalog ({currencies.length})
        </button>
        <button
          type="button"
          data-testid="tab-converter"
          onClick={() => setActiveTab("converter")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "converter"
              ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Live Calculator
        </button>
      </div>

      {/* Tab 1: Exchange Rates Table */}
      {activeTab === "rates" && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950">
          <Table data-testid="exchange-rates-table">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Currency Pair</TableHead>
                <TableHead className="text-xs">Direct Rate</TableHead>
                <TableHead className="text-xs">Inverse Rate</TableHead>
                <TableHead className="text-xs">Source</TableHead>
                <TableHead className="text-xs">Last Updated</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-xs text-slate-500">
                    No exchange rates configured.
                  </TableCell>
                </TableRow>
              ) : (
                rates.map((r) => (
                  <TableRow
                    key={`${r.from}-${r.to}`}
                    data-testid={`rate-row-${r.from}-${r.to}`}
                    className="hover:bg-slate-50 dark:hover:bg-slate-900/60"
                  >
                    <TableCell className="font-semibold text-xs">
                      <span className="text-slate-900 dark:text-slate-100">
                        {r.from} / {r.to}
                      </span>
                    </TableCell>

                    <TableCell className="font-mono text-xs font-medium text-slate-900 dark:text-slate-100">
                      1 {r.from} = {r.rate.toFixed(4)} {r.to}
                    </TableCell>

                    <TableCell className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      1 {r.to} = {(r.inverseRate ?? 1 / r.rate).toFixed(4)} {r.from}
                    </TableCell>

                    <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                      <Badge variant="outline" className="text-[10px]">
                        {r.source || "Manual"}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(r.updatedAt).toLocaleDateString()}
                    </TableCell>

                    <TableCell className="text-xs text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`edit-rate-${r.from}-${r.to}`}
                          onClick={() => handleOpenEditRate(r)}
                          className="h-7 w-7 p-0"
                          title="Edit Rate"
                        >
                          <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                        </Button>
                        {onDeleteRate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`delete-rate-${r.from}-${r.to}`}
                            onClick={() => onDeleteRate(r.from, r.to)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                            title="Delete Rate"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Tab 2: Currencies Catalog Table */}
      {activeTab === "currencies" && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950">
          <Table data-testid="currencies-table">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Currency</TableHead>
                <TableHead className="text-xs">Symbol</TableHead>
                <TableHead className="text-xs">Decimals</TableHead>
                <TableHead className="text-xs">Role</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Set as Base</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currencies.map((c) => (
                <TableRow
                  key={c.code}
                  data-testid={`currency-row-${c.code}`}
                  className="hover:bg-slate-50 dark:hover:bg-slate-900/60"
                >
                  <TableCell className="text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-900 dark:text-slate-100">{c.code}</span>
                      <span className="text-slate-400 font-normal">({c.name})</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-xs font-mono font-medium">
                    {c.symbol}
                  </TableCell>

                  <TableCell className="text-xs font-mono text-slate-500">
                    {c.decimals}
                  </TableCell>

                  <TableCell className="text-xs">
                    {c.isBase ? (
                      <Badge className="bg-emerald-600 text-white text-[10px] flex items-center gap-1 w-fit">
                        <Star className="h-3 w-3 fill-white" />
                        Base Currency
                      </Badge>
                    ) : (
                      <span className="text-slate-400 text-xs">Standard</span>
                    )}
                  </TableCell>

                  <TableCell className="text-xs">
                    <Switch
                      data-testid={`toggle-currency-${c.code}`}
                      checked={c.enabled !== false}
                      disabled={c.isBase}
                      onCheckedChange={(checked) => onToggleCurrency?.(c.code, checked)}
                    />
                  </TableCell>

                  <TableCell className="text-xs text-right">
                    {!c.isBase && onSetBaseCurrency && (
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`set-base-${c.code}`}
                        onClick={() => onSetBaseCurrency(c.code)}
                        className="h-7 text-[11px] px-2.5"
                      >
                        Make Base
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Tab 3: Interactive Live Converter */}
      {activeTab === "converter" && (
        <div className="max-w-xl">
          <CurrencyConverterWidget
            currencies={currencies}
            rates={rates}
            baseCurrency={baseCurrency}
          />
        </div>
      )}

      {/* Rate Dialog */}
      <ExchangeRateDialog
        open={isRateDialogOpen}
        onOpenChange={setIsRateDialogOpen}
        currencies={currencies}
        baseCurrency={baseCurrency}
        existingRate={editingRate}
        onSave={onSaveRate}
      />
    </div>
  );
}
