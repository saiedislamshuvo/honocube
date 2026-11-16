import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  Button,
} from "@honocube/ui";
import { ScanBarcode, X } from "lucide-react";
import type { BarcodeScannerDialogProps } from "@honocube/core";
import { BarcodeCameraScanner } from "../scanner/barcode-camera-scanner.js";
import { useBarcodeScanner } from "../scanner/use-barcode-scanner.js";

export function BarcodeScannerDialog({
  open,
  onOpenChange,
  onScan,
  title = "Barcode & QR Code Scanner",
  description = "Point your camera at a barcode, enter manually, or scan with a USB/Bluetooth hardware scanner.",
  trigger,
}: BarcodeScannerDialogProps): React.JSX.Element {
  // Global hardware scanner listener while dialog is open
  useBarcodeScanner({
    enabled: open,
    onScan: (code) => {
      onScan(code);
      onOpenChange(false);
    },
  });

  const handleScanDetected = (scannedCode: string): void => {
    onScan(scannedCode);
    onOpenChange(false);
  };

  const dialogContent = (
    <>
      <div className="flex items-center justify-between pb-3 border-b">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ScanBarcode className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          data-testid="scanner-dialog-close"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="py-3">
        <BarcodeCameraScanner onScan={handleScanDetected} />
      </div>
    </>
  );

  // SSR / headless test fallback
  if (typeof document === "undefined") {
    if (!open) return trigger ? <>{trigger}</> : <></>;
    return (
      <div
        data-testid="barcode-scanner-dialog"
        role="dialog"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      >
        <div className="max-w-md w-full bg-background border p-5 rounded-lg shadow-xl">
          {dialogContent}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        data-testid="barcode-scanner-dialog"
        className="max-w-md p-5"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {dialogContent}
      </DialogContent>
    </Dialog>
  );
}
