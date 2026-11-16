import * as React from "react";
import { Input } from "@honocube/ui";
import type { MaskedNumericInputProps } from "@honocube/core";

export function getCurrencySymbol(currencyCode: string = "USD", locale = "en-US"): string {
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
    });
    const parts = formatter.formatToParts(0);
    const symbolPart = parts.find((p) => p.type === "currency");
    return symbolPart ? symbolPart.value : currencyCode;
  } catch {
    const fallback: Record<string, string> = {
      USD: "$",
      EUR: "€",
      GBP: "£",
      JPY: "¥",
      CNY: "¥",
      INR: "₹",
      CAD: "CA$",
      AUD: "AU$",
    };
    return fallback[currencyCode.toUpperCase()] || currencyCode;
  }
}

export interface FormatNumericOptions {
  precision?: number;
  thousandSeparator?: boolean | string;
  padDecimals?: boolean;
}

export function formatNumericValue(
  value: number | string | null | undefined,
  options: FormatNumericOptions = {}
): string {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "number" ? value : Number(value);
  if (isNaN(num)) return "";

  const sep =
    typeof options.thousandSeparator === "string"
      ? options.thousandSeparator
      : options.thousandSeparator === false
      ? ""
      : ",";
  const precision = options.precision;

  let [integerPart, decimalPart] = String(num).split(".");
  if (precision !== undefined) {
    if (options.padDecimals) {
      const fixed = num.toFixed(precision);
      [integerPart, decimalPart] = fixed.split(".");
    } else if (decimalPart !== undefined) {
      decimalPart = decimalPart.slice(0, precision);
    }
  }

  if (sep && integerPart) {
    const isNegative = integerPart.startsWith("-");
    const rawDigits = isNegative ? integerPart.slice(1) : integerPart;
    const formattedDigits = rawDigits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    integerPart = isNegative ? `-${formattedDigits}` : formattedDigits;
  }

  if (decimalPart !== undefined && (precision === undefined || precision > 0)) {
    return `${integerPart}.${decimalPart}`;
  }
  return integerPart || "";
}

export interface ParseNumericOptions {
  thousandSeparator?: boolean | string;
  allowNegative?: boolean;
  precision?: number;
}

export function parseNumericString(
  raw: string,
  options: ParseNumericOptions = {}
): number | null {
  if (!raw || raw.trim() === "") return null;
  const sep =
    typeof options.thousandSeparator === "string"
      ? options.thousandSeparator
      : options.thousandSeparator === false
      ? ""
      : ",";

  let cleaned = sep ? raw.replace(new RegExp(`\\${sep}`, "g"), "").trim() : raw.trim();

  const isNegative = cleaned.startsWith("-");
  if (isNegative && options.allowNegative === false) {
    cleaned = cleaned.replace(/-/g, "");
  }

  const parts = cleaned.split(".");
  let integerPart = parts[0]?.replace(/[^\d-]/g, "") || "";
  if (parts.length > 1) {
    let decimals = parts.slice(1).join("").replace(/[^\d]/g, "");
    if (options.precision !== undefined) {
      decimals = decimals.slice(0, options.precision);
    }
    integerPart = `${integerPart}.${decimals}`;
  }

  if (integerPart === "" || integerPart === "-" || integerPart === ".") return null;
  const parsed = Number(integerPart);
  return isNaN(parsed) ? null : parsed;
}

export function MaskedNumericInput({
  id,
  name,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  placeholder,
  min,
  max,
  step,
  precision,
  prefix,
  suffix,
  format,
  currencyCode = "USD",
  thousandSeparator,
  allowNegative,
  padDecimals,
  hasError = false,
  className = "",
}: MaskedNumericInputProps): React.JSX.Element {
  const isCurrency = format === "currency";
  const isPercent = format === "percent";

  const resolvedPrecision =
    precision !== undefined ? precision : isCurrency ? 2 : undefined;

  const resolvedPadDecimals =
    padDecimals !== undefined ? padDecimals : isCurrency ? true : false;

  const resolvedThousandSeparator =
    thousandSeparator !== undefined ? thousandSeparator : isCurrency ? true : true;

  const resolvedAllowNegative =
    allowNegative !== undefined
      ? allowNegative
      : min !== undefined && min >= 0
      ? false
      : true;

  const resolvedPrefix =
    prefix !== undefined
      ? prefix
      : isCurrency
      ? getCurrencySymbol(currencyCode)
      : undefined;

  const resolvedSuffix =
    suffix !== undefined ? suffix : isPercent ? "%" : undefined;

  const [isFocused, setIsFocused] = React.useState(false);

  const initialFormatted = React.useMemo(() => {
    return formatNumericValue(value, {
      precision: resolvedPrecision,
      thousandSeparator: resolvedThousandSeparator,
      padDecimals: resolvedPadDecimals,
    });
  }, [value, resolvedPrecision, resolvedThousandSeparator, resolvedPadDecimals]);

  const [displayValue, setDisplayValue] = React.useState<string>(initialFormatted);

  // Sync external value when not actively typing/focused
  React.useEffect(() => {
    if (!isFocused) {
      setDisplayValue(
        formatNumericValue(value, {
          precision: resolvedPrecision,
          thousandSeparator: resolvedThousandSeparator,
          padDecimals: resolvedPadDecimals,
        })
      );
    }
  }, [value, isFocused, resolvedPrecision, resolvedThousandSeparator, resolvedPadDecimals]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Filter allowed characters while typing
    const sep =
      typeof resolvedThousandSeparator === "string"
        ? resolvedThousandSeparator
        : resolvedThousandSeparator === false
        ? ""
        : ",";

    // Build regex of allowed chars: digits, minus if negative, dot if precision > 0, and separator
    const cleanRaw = raw.replace(
      new RegExp(
        `[^0-9${resolvedAllowNegative ? "\\-" : ""}\\.${sep ? "\\" + sep : ""}]`,
        "g"
      ),
      ""
    );

    // Enforce single minus at beginning
    let sanitized = cleanRaw;
    if (sanitized.includes("-")) {
      const hasMinus = sanitized.startsWith("-");
      sanitized = (hasMinus ? "-" : "") + sanitized.replace(/-/g, "");
    }

    // Enforce single decimal dot and decimal precision
    const dotParts = sanitized.split(".");
    if (dotParts.length > 2) {
      sanitized = `${dotParts[0]}.${dotParts.slice(1).join("")}`;
    }

    if (resolvedPrecision !== undefined && dotParts.length > 1) {
      const decimals = dotParts.slice(1).join("").slice(0, resolvedPrecision);
      sanitized = `${dotParts[0]}.${decimals}`;
    }

    setDisplayValue(sanitized);

    const parsed = parseNumericString(sanitized, {
      thousandSeparator: resolvedThousandSeparator,
      allowNegative: resolvedAllowNegative,
      precision: resolvedPrecision,
    });

    onChange(parsed);
  };

  const handleBlur = () => {
    setIsFocused(false);
    let num = parseNumericString(displayValue, {
      thousandSeparator: resolvedThousandSeparator,
      allowNegative: resolvedAllowNegative,
      precision: resolvedPrecision,
    });

    if (num !== null) {
      if (min !== undefined && num < min) num = min;
      if (max !== undefined && num > max) num = max;
      onChange(num);
      setDisplayValue(
        formatNumericValue(num, {
          precision: resolvedPrecision,
          thousandSeparator: resolvedThousandSeparator,
          padDecimals: resolvedPadDecimals,
        })
      );
    } else {
      setDisplayValue("");
      onChange(null);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled || readOnly) return;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const currentNum =
        parseNumericString(displayValue, {
          thousandSeparator: resolvedThousandSeparator,
          allowNegative: resolvedAllowNegative,
          precision: resolvedPrecision,
        }) || 0;

      const delta =
        step !== undefined
          ? step
          : resolvedPrecision
          ? 1 / Math.pow(10, resolvedPrecision)
          : 1;

      let nextNum =
        e.key === "ArrowUp" ? currentNum + delta : currentNum - delta;

      if (resolvedPrecision !== undefined) {
        nextNum = Number(nextNum.toFixed(resolvedPrecision));
      }
      if (min !== undefined && nextNum < min) nextNum = min;
      if (max !== undefined && nextNum > max) nextNum = max;

      onChange(nextNum);
      setDisplayValue(
        formatNumericValue(nextNum, {
          precision: resolvedPrecision,
          thousandSeparator: resolvedThousandSeparator,
          padDecimals: resolvedPadDecimals,
        })
      );
    }
  };

  const isDisabled = disabled || readOnly;

  return (
    <div
      className={`relative flex items-center w-full ${className}`}
      data-testid="masked-numeric-container"
    >
      {resolvedPrefix && (
        <span
          className="inline-flex items-center px-2.5 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-xs font-medium select-none h-9 shrink-0"
          data-testid="masked-numeric-prefix"
        >
          {resolvedPrefix}
        </span>
      )}
      <Input
        id={id || name}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        placeholder={placeholder}
        className={`w-full ${resolvedPrefix ? "rounded-l-none" : ""} ${
          resolvedSuffix ? "rounded-r-none" : ""
        } ${hasError ? "border-destructive focus-visible:ring-destructive" : ""}`}
        data-testid="masked-numeric-input"
      />
      {resolvedSuffix && (
        <span
          className="inline-flex items-center px-2.5 rounded-r-md border border-l-0 border-input bg-muted text-muted-foreground text-xs font-medium select-none h-9 shrink-0"
          data-testid="masked-numeric-suffix"
        >
          {resolvedSuffix}
        </span>
      )}
    </div>
  );
}
