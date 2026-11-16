import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  cn,
} from "@honocube/ui";
import type { PhoneInputFieldProps } from "@honocube/core";

export interface CountryCallingCode {
  iso: string;
  name: string;
  dialCode: string;
  flag: string;
}

export const COUNTRY_CALLING_CODES: CountryCallingCode[] = [
  { iso: "US", name: "United States", dialCode: "+1", flag: "🇺🇸" },
  { iso: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧" },
  { iso: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦" },
  { iso: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺" },
  { iso: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪" },
  { iso: "FR", name: "France", dialCode: "+33", flag: "🇫🇷" },
  { iso: "BD", name: "Bangladesh", dialCode: "+880", flag: "🇧🇩" },
  { iso: "IN", name: "India", dialCode: "+91", flag: "🇮🇳" },
  { iso: "JP", name: "Japan", dialCode: "+81", flag: "🇯🇵" },
  { iso: "CN", name: "China", dialCode: "+86", flag: "🇨🇳" },
  { iso: "BR", name: "Brazil", dialCode: "+55", flag: "🇧🇷" },
  { iso: "AE", name: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪" },
  { iso: "SG", name: "Singapore", dialCode: "+65", flag: "🇸🇬" },
  { iso: "NL", name: "Netherlands", dialCode: "+31", flag: "🇳🇱" },
  { iso: "IT", name: "Italy", dialCode: "+39", flag: "🇮🇹" },
  { iso: "ES", name: "Spain", dialCode: "+34", flag: "🇪🇸" },
  { iso: "CH", name: "Switzerland", dialCode: "+41", flag: "🇨🇭" },
  { iso: "SE", name: "Sweden", dialCode: "+46", flag: "🇸🇪" },
  { iso: "NO", name: "Norway", dialCode: "+47", flag: "🇳🇴" },
  { iso: "MX", name: "Mexico", dialCode: "+52", flag: "🇲🇽" },
  { iso: "ZA", name: "South Africa", dialCode: "+27", flag: "🇿🇦" },
  { iso: "NZ", name: "New Zealand", dialCode: "+64", flag: "🇳🇿" },
  { iso: "PK", name: "Pakistan", dialCode: "+92", flag: "🇵🇰" },
  { iso: "NG", name: "Nigeria", dialCode: "+234", flag: "🇳🇬" },
  { iso: "ID", name: "Indonesia", dialCode: "+62", flag: "🇮🇩" },
  { iso: "TR", name: "Turkey", dialCode: "+90", flag: "🇹🇷" },
  { iso: "SA", name: "Saudi Arabia", dialCode: "+966", flag: "🇸🇦" },
  { iso: "KR", name: "South Korea", dialCode: "+82", flag: "🇰🇷" },
];

/**
 * Parses an incoming telephone number string into its ISO country and national number parts.
 */
export function parsePhoneNumber(
  rawVal?: string | null,
  defaultIso: string = "US"
): { country: CountryCallingCode; nationalNumber: string } {
  const fallback =
    COUNTRY_CALLING_CODES.find(
      (c) => c.iso.toUpperCase() === defaultIso.toUpperCase()
    ) || COUNTRY_CALLING_CODES[0]!;

  if (!rawVal || typeof rawVal !== "string") {
    return { country: fallback, nationalNumber: "" };
  }

  const clean = rawVal.trim();
  if (clean.startsWith("+")) {
    // Sort descending by dial code length to match longest prefix first (e.g. +880 before +88)
    const sorted = [...COUNTRY_CALLING_CODES].sort(
      (a, b) => b.dialCode.length - a.dialCode.length
    );
    for (const country of sorted) {
      if (clean.startsWith(country.dialCode)) {
        const national = clean.slice(country.dialCode.length).trim();
        return { country, nationalNumber: national };
      }
    }
  }

  return { country: fallback, nationalNumber: clean };
}

export function PhoneInputField({
  id,
  name,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  placeholder = "(555) 000-0000",
  defaultCountry = "US",
  allowedCountries,
  hasError = false,
  className = "",
}: PhoneInputFieldProps): React.JSX.Element {
  const availableCountries = useMemo(() => {
    if (!allowedCountries || allowedCountries.length === 0) {
      return COUNTRY_CALLING_CODES;
    }
    const set = new Set(allowedCountries.map((c) => c.toUpperCase()));
    return COUNTRY_CALLING_CODES.filter((c) => set.has(c.iso.toUpperCase()));
  }, [allowedCountries]);

  const parsed = useMemo(() => {
    return parsePhoneNumber(value, defaultCountry);
  }, [value, defaultCountry]);

  const [selectedCountry, setSelectedCountry] = useState<CountryCallingCode>(
    parsed.country
  );
  const [nationalNumber, setNationalNumber] = useState<string>(
    parsed.nationalNumber
  );

  // Sync internal state when external value changes
  useEffect(() => {
    setSelectedCountry(parsed.country);
    setNationalNumber(parsed.nationalNumber);
  }, [parsed]);

  const triggerChange = useCallback(
    (country: CountryCallingCode, numberStr: string) => {
      const cleanNumber = numberStr.trim();
      if (!cleanNumber) {
        onChange("");
        return;
      }
      onChange(`${country.dialCode} ${cleanNumber}`);
    },
    [onChange]
  );

  const handleCountryChange = (iso: string) => {
    const nextCountry =
      availableCountries.find((c) => c.iso === iso) || selectedCountry;
    setSelectedCountry(nextCountry);
    triggerChange(nextCountry, nationalNumber);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setNationalNumber(nextVal);
    triggerChange(selectedCountry, nextVal);
  };

  return (
    <div
      data-testid="phone-input-container"
      className={cn("flex items-center gap-2 w-full", className)}
    >
      {/* Country Calling Code Selector */}
      <div className="w-32 shrink-0">
        <Select
          value={selectedCountry.iso}
          onValueChange={handleCountryChange}
          disabled={disabled || readOnly}
        >
          <SelectTrigger
            data-testid="phone-country-trigger"
            className={cn(
              "h-9 px-2.5 font-normal text-xs",
              hasError ? "border-destructive focus:ring-destructive" : ""
            )}
          >
            <SelectValue placeholder="Code">
              <span className="flex items-center gap-1.5 truncate">
                <span className="text-sm">{selectedCountry.flag}</span>
                <span className="font-mono">{selectedCountry.dialCode}</span>
              </span>
            </SelectValue>
          </SelectTrigger>

          <SelectContent className="max-h-60 w-56">
            {availableCountries.map((c) => (
              <SelectItem
                key={c.iso}
                value={c.iso}
                data-testid={`phone-country-option-${c.iso}`}
                className="text-xs"
              >
                <div className="flex items-center justify-between w-full gap-2">
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="text-sm">{c.flag}</span>
                    <span className="truncate">{c.name}</span>
                  </span>
                  <span className="font-mono text-muted-foreground shrink-0">
                    {c.dialCode}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* National Number Input */}
      <Input
        id={id || name}
        data-testid="phone-number-input"
        type="tel"
        value={nationalNumber}
        onChange={handleNumberChange}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        className={cn(
          "h-9 font-mono text-sm",
          hasError ? "border-destructive focus-visible:ring-destructive" : ""
        )}
      />
    </div>
  );
}
