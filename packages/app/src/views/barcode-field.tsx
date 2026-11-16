import * as React from "react";
import { Input, Barcode, Button, type BarcodeFormat } from "@honocube/ui";
import type { BarcodeFieldProps } from "@honocube/core";

export const BarcodeField: React.FC<BarcodeFieldProps> = ({
  id,
  name,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  placeholder = "e.g. SKU-100234",
  format = "code128",
  displayValue = true,
  width = 2,
  height = 64,
  hasError = false,
  className = "",
}) => {
  const [copied, setCopied] = React.useState(false);
  const currentVal = value ?? "";

  const handleCopy = () => {
    if (!currentVal) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(currentVal);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <Input
          id={id || name}
          name={name}
          type="text"
          value={currentVal}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || readOnly}
          placeholder={placeholder}
          className={hasError ? "border-destructive focus-visible:ring-destructive" : ""}
        />
        {currentVal && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={disabled}
            className="shrink-0 text-xs px-2.5 h-9"
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        )}
      </div>

      {currentVal ? (
        <div className="p-3 bg-muted/40 rounded-lg border border-border flex flex-col items-center justify-center overflow-x-auto">
          <Barcode
            value={currentVal}
            format={format as BarcodeFormat}
            width={width}
            height={height}
            displayValue={displayValue}
            className="max-w-full"
          />
        </div>
      ) : (
        <div className="text-xs text-muted-foreground p-3 bg-muted/20 rounded border border-dashed text-center">
          Enter a code above to preview the scannable barcode
        </div>
      )}
    </div>
  );
};

BarcodeField.displayName = "BarcodeField";
