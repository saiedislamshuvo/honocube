import React, { useState } from "react";
import { Check, Pipette, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button,
  Input,
  cn,
} from "@honocube/ui";
import type { ColorPickerFieldProps } from "@honocube/core";

export const DEFAULT_COLOR_PRESETS = [
  "#EF4444", // Red
  "#F97316", // Orange
  "#F59E0B", // Amber
  "#10B981", // Emerald
  "#06B6D4", // Cyan
  "#3B82F6", // Blue
  "#6366F1", // Indigo
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#64748B", // Slate
  "#1E293B", // Dark
  "#FFFFFF", // White
];

export function ColorPickerField({
  id,
  name,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  placeholder = "#000000",
  presets = DEFAULT_COLOR_PRESETS,
  hasError = false,
  className = "",
}: ColorPickerFieldProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const colorValue = value || "";

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.trim();
    if (raw && !raw.startsWith("#") && /^[0-9A-Fa-f]{1,6}$/.test(raw)) {
      raw = `#${raw}`;
    }
    onChange(raw);
  };

  const handleClear = () => {
    onChange("");
  };

  return (
    <div
      data-testid="color-picker-container"
      className={cn("flex items-center gap-2 w-full", className)}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id || name}
            data-testid="color-swatch-trigger"
            disabled={disabled || readOnly}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input shadow-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              hasError ? "border-destructive" : ""
            )}
            title="Choose color"
          >
            <span
              data-testid="color-swatch-preview"
              className="h-5 w-5 rounded border border-black/10 shadow-inner"
              style={{
                backgroundColor: colorValue || "transparent",
                backgroundImage: !colorValue
                  ? "repeating-conic-gradient(#cbd5e1 0% 25%, transparent 0% 50%) 50% / 8px 8px"
                  : undefined,
              }}
            />
          </button>
        </PopoverTrigger>

        <PopoverContent
          data-testid="color-picker-popover"
          align="start"
          className="w-64 p-3 space-y-3"
        >
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Palette Presets
          </div>

          <div className="grid grid-cols-6 gap-1.5">
            {presets.map((preset) => {
              const isSelected =
                colorValue.toLowerCase() === preset.toLowerCase();
              return (
                <button
                  key={preset}
                  type="button"
                  data-testid={`color-preset-${preset}`}
                  onClick={() => {
                    onChange(preset);
                    setOpen(false);
                  }}
                  className={cn(
                    "h-7 w-7 rounded-md border border-black/10 shadow-sm flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring",
                    isSelected ? "ring-2 ring-primary ring-offset-1" : ""
                  )}
                  style={{ backgroundColor: preset }}
                  title={preset}
                >
                  {isSelected && (
                    <Check
                      className={cn(
                        "h-3.5 w-3.5",
                        preset.toLowerCase() === "#ffffff"
                          ? "text-black"
                          : "text-white"
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t">
            <div className="relative flex items-center">
              <input
                type="color"
                data-testid="native-color-picker"
                value={colorValue.startsWith("#") && colorValue.length === 7 ? colorValue : "#3b82f6"}
                onChange={(e) => onChange(e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                title="Custom color picker"
              />
              <Pipette className="h-3.5 w-3.5 absolute pointer-events-none left-2 text-white drop-shadow" />
            </div>
            <Input
              data-testid="color-hex-popover-input"
              type="text"
              value={colorValue}
              onChange={handleTextChange}
              placeholder="#000000"
              className="h-8 text-xs font-mono"
            />
          </div>
        </PopoverContent>
      </Popover>

      <div className="relative flex-1">
        <Input
          data-testid="color-hex-input"
          type="text"
          value={colorValue}
          onChange={handleTextChange}
          disabled={disabled}
          readOnly={readOnly}
          placeholder={placeholder}
          maxLength={9}
          className={cn(
            "font-mono text-sm uppercase pr-8",
            hasError ? "border-destructive focus-visible:ring-destructive" : ""
          )}
        />
        {colorValue && !disabled && !readOnly && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            data-testid="color-clear-btn"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Clear color</span>
          </Button>
        )}
      </div>
    </div>
  );
}
