import * as React from "react";
import { QrCode } from "lucide-react";
import { Input, QRCode, Button, type QrErrorCorrectionLevel } from "@honocube/ui";
import type { QRCodeFieldProps } from "@honocube/core";
import { BarcodeScannerDialog } from "./barcode-scanner-dialog.js";

export const QRCodeField: React.FC<QRCodeFieldProps> = ({
  id,
  name,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  placeholder = "e.g. https://example.com/asset/123",
  size = 140,
  level = "M",
  includeMargin = true,
  hasError = false,
  className = "",
  showScanner = false,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [scannerOpen, setScannerOpen] = React.useState(false);
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

        {showScanner && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setScannerOpen(true)}
            disabled={disabled || readOnly}
            data-testid="qrcode-scan-button"
            className="shrink-0 text-xs px-2.5 h-9 gap-1"
            title="Scan QR code with camera"
          >
            <QrCode className="h-4 w-4" />
            <span>Scan</span>
          </Button>
        )}

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
        <div className="p-3 bg-muted/40 rounded-lg border border-border flex flex-col items-center justify-center">
          <QRCode
            value={currentVal}
            size={size}
            level={level as QrErrorCorrectionLevel}
            includeMargin={includeMargin}
            className="max-w-full"
          />
        </div>
      ) : (
        <div className="text-xs text-muted-foreground p-3 bg-muted/20 rounded border border-dashed text-center">
          Enter text or a URL above to preview the scannable QR code
        </div>
      )}

      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={(scanned) => onChange(scanned)}
        title="Scan QR Code"
      />
    </div>
  );
};

QRCodeField.displayName = "QRCodeField";
