import * as React from "react";
import { CalendarIcon, Clock, X } from "lucide-react";
import {
  Button,
  Calendar,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@honocube/ui";
import type { DateRangePickerProps } from "@honocube/core";

export interface DateRangePreset {
  label: string;
  getValue: () => { from: Date; to: Date };
}

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  {
    label: "Today",
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      return { from: start, to: end };
    },
  },
  {
    label: "Yesterday",
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
      return { from: start, to: end };
    },
  },
  {
    label: "Last 7 Days",
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      return { from: start, to: end };
    },
  },
  {
    label: "Last 30 Days",
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      return { from: start, to: end };
    },
  },
  {
    label: "This Month",
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { from: start, to: end };
    },
  },
  {
    label: "Last Month",
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { from: start, to: end };
    },
  },
  {
    label: "This Quarter",
    getValue: () => {
      const now = new Date();
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), currentQuarter * 3, 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), currentQuarter * 3 + 3, 0, 23, 59, 59);
      return { from: start, to: end };
    },
  },
  {
    label: "Year to Date",
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      return { from: start, to: end };
    },
  },
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDateString(d: Date, includeTime = false): string {
  const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (!includeTime) return ymd;
  return `${ymd}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDisplayDate(d: Date, includeTime = false): string {
  const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (!includeTime) return ymd;
  return `${ymd} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDateRange(val: unknown): { from?: Date; to?: Date } {
  if (!val) return {};
  let parsed: any = val;
  if (typeof val === "string") {
    try {
      parsed = JSON.parse(val);
    } catch {
      if (val.includes(" to ")) {
        const [f, t] = val.split(" to ");
        parsed = { from: f?.trim(), to: t?.trim() };
      } else if (val.includes(",")) {
        const [f, t] = val.split(",");
        parsed = { from: f?.trim(), to: t?.trim() };
      } else {
        parsed = { from: val.trim() };
      }
    }
  }

  const fromDate = parsed?.from ? new Date(parsed.from) : undefined;
  const toDate = parsed?.to ? new Date(parsed.to) : undefined;

  return {
    from: fromDate && !isNaN(fromDate.getTime()) ? fromDate : undefined,
    to: toDate && !isNaN(toDate.getTime()) ? toDate : undefined,
  };
}

export function DateRangePicker({
  id,
  name,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  placeholder = "Select date range",
  includeTime = false,
  presets = true,
  hasError = false,
  className = "",
}: DateRangePickerProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  const { from, to } = React.useMemo(() => parseDateRange(value), [value]);

  const [fromTime, setFromTime] = React.useState<string>(() => {
    if (from) return `${pad(from.getHours())}:${pad(from.getMinutes())}`;
    return "00:00";
  });

  const [toTime, setToTime] = React.useState<string>(() => {
    if (to) return `${pad(to.getHours())}:${pad(to.getMinutes())}`;
    return "23:59";
  });

  // Sync times when from / to changes
  React.useEffect(() => {
    if (from) {
      setFromTime(`${pad(from.getHours())}:${pad(from.getMinutes())}`);
    }
    if (to) {
      setToTime(`${pad(to.getHours())}:${pad(to.getMinutes())}`);
    }
  }, [from, to]);

  const handleSelectRange = (range: { from?: Date; to?: Date } | undefined) => {
    if (!range) {
      onChange({ from: undefined, to: undefined });
      return;
    }

    let nextFrom = range.from;
    let nextTo = range.to;

    if (includeTime && nextFrom) {
      const [fH, fM] = fromTime.split(":").map(Number);
      nextFrom = new Date(nextFrom);
      nextFrom.setHours(fH || 0, fM || 0, 0, 0);
    }

    if (includeTime && nextTo) {
      const [tH, tM] = toTime.split(":").map(Number);
      nextTo = new Date(nextTo);
      nextTo.setHours(tH || 23, tM || 59, 59, 999);
    }

    onChange({
      from: nextFrom ? formatDateString(nextFrom, includeTime) : undefined,
      to: nextTo ? formatDateString(nextTo, includeTime) : undefined,
    });
  };

  const handlePresetClick = (preset: DateRangePreset) => {
    const range = preset.getValue();
    onChange({
      from: formatDateString(range.from, includeTime),
      to: formatDateString(range.to, includeTime),
    });
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ from: undefined, to: undefined });
  };

  const displayText = React.useMemo(() => {
    if (from && to) {
      return `${formatDisplayDate(from, includeTime)} – ${formatDisplayDate(to, includeTime)}`;
    }
    if (from) {
      return `${formatDisplayDate(from, includeTime)} – ...`;
    }
    return placeholder;
  }, [from, to, includeTime, placeholder]);

  const availablePresets = React.useMemo(() => {
    if (!presets) return [];
    if (Array.isArray(presets)) {
      return DATE_RANGE_PRESETS.filter((p) => presets.includes(p.label));
    }
    return DATE_RANGE_PRESETS;
  }, [presets]);

  const isDisabled = disabled || readOnly;

  return (
    <div className={`relative flex items-center ${className}`}>
      <Popover open={open} onOpenChange={(nextOpen) => !isDisabled && setOpen(nextOpen)}>
        <PopoverTrigger asChild>
          <Button
            id={id || name}
            type="button"
            variant="outline"
            disabled={isDisabled}
            className={`w-full justify-between text-left font-normal h-9 px-3 ${
              !from ? "text-muted-foreground" : "text-foreground"
            } ${hasError ? "border-destructive text-destructive focus:ring-destructive" : ""}`}
            data-testid="date-range-picker-trigger"
          >
            <div className="flex items-center gap-2 truncate">
              <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{displayText}</span>
            </div>
            {from && !isDisabled && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear date range"
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleClear(e as any);
                  }
                }}
                className="ml-2 rounded-sm p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                data-testid="date-range-clear-btn"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col sm:flex-row">
            {availablePresets.length > 0 && (
              <div className="border-b sm:border-b-0 sm:border-r border-border p-2 flex flex-row sm:flex-col gap-1 overflow-x-auto sm:overflow-x-visible">
                {availablePresets.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="justify-start text-xs h-8 px-2.5 font-normal whitespace-nowrap"
                    onClick={() => handlePresetClick(preset)}
                    data-testid={`preset-${preset.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            )}
            <div className="p-2">
              <Calendar
                mode="range"
                selected={from ? { from, to: to || from } : undefined}
                onSelect={(range: any) => handleSelectRange(range)}
                numberOfMonths={2}
                autoFocus
              />
              {includeTime && (
                <div className="mt-2 pt-2 border-t border-border flex items-center justify-between gap-4 px-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">Start:</span>
                    <Input
                      type="time"
                      value={fromTime}
                      onChange={(e) => {
                        const newTime = e.target.value;
                        setFromTime(newTime);
                        if (from) {
                          const [h, m] = newTime.split(":").map(Number);
                          const updated = new Date(from);
                          updated.setHours(h || 0, m || 0, 0, 0);
                          onChange({
                            from: formatDateString(updated, true),
                            to: to ? formatDateString(to, true) : undefined,
                          });
                        }
                      }}
                      className="h-7 text-xs w-24 px-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">End:</span>
                    <Input
                      type="time"
                      value={toTime}
                      onChange={(e) => {
                        const newTime = e.target.value;
                        setToTime(newTime);
                        if (to) {
                          const [h, m] = newTime.split(":").map(Number);
                          const updated = new Date(to);
                          updated.setHours(h || 23, m || 59, 59, 999);
                          onChange({
                            from: from ? formatDateString(from, true) : undefined,
                            to: formatDateString(updated, true),
                          });
                        }
                      }}
                      className="h-7 text-xs w-24 px-1"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
