import React, { useState, useCallback } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  ScanBarcode,
  Camera,
  RotateCcw,
  PackageCheck,
} from "lucide-react";
import { Button, Input, Badge } from "@honocube/ui";
import type { VerificationItem, ScanVerificationWidgetProps } from "@honocube/core";
import { useBarcodeScanner, playScanBeep } from "../scanner/use-barcode-scanner.js";
import { BarcodeScannerDialog } from "./barcode-scanner-dialog.js";

export function ScanVerificationWidget({
  items: initialItems,
  onItemVerified,
  onComplete,
  title = "Warehouse Pick & Pack Verification",
  className = "",
}: ScanVerificationWidgetProps): React.JSX.Element {
  const [items, setItems] = useState<VerificationItem[]>(initialItems);
  const [lastScanAlert, setLastScanAlert] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  const totalRequired = items.reduce((acc, i) => acc + i.expectedQuantity, 0);
  const totalVerified = items.reduce((acc, i) => acc + i.verifiedQuantity, 0);
  const percentComplete = totalRequired > 0 ? Math.min(100, Math.round((totalVerified / totalRequired) * 100)) : 100;
  const isAllComplete = items.length > 0 && items.every((i) => i.verifiedQuantity >= i.expectedQuantity);

  const processScan = useCallback(
    (barcode: string) => {
      const code = barcode.trim();
      if (!code) return;

      const itemIndex = items.findIndex(
        (i) => i.barcode.toLowerCase() === code.toLowerCase() || (i.sku && i.sku.toLowerCase() === code.toLowerCase())
      );

      if (itemIndex === -1) {
        // Unknown barcode
        playScanBeep(400, 200); // Low warning tone
        setLastScanAlert({
          type: "error",
          message: `Unknown barcode "${code}" not found in this pick-list.`,
        });
        return;
      }

      const targetItem = items[itemIndex]!;
      const nextVerified = targetItem.verifiedQuantity + 1;
      const isOver = nextVerified > targetItem.expectedQuantity;

      const updatedItem: VerificationItem = {
        ...targetItem,
        verifiedQuantity: nextVerified,
        status: isOver ? "over" : nextVerified === targetItem.expectedQuantity ? "verified" : "pending",
      };

      const nextItems = [...items];
      nextItems[itemIndex] = updatedItem;
      setItems(nextItems);

      playScanBeep(1200, 80);
      setLastScanAlert({
        type: isOver ? "warning" : "success",
        message: isOver
          ? `Over-pick warning: "${targetItem.name}" verified (${nextVerified}/${targetItem.expectedQuantity}).`
          : `Verified: "${targetItem.name}" (${nextVerified}/${targetItem.expectedQuantity}).`,
      });

      const remainingInList = nextItems.reduce(
        (sum, i) => sum + Math.max(0, i.expectedQuantity - i.verifiedQuantity),
        0
      );

      if (onItemVerified) {
        onItemVerified(updatedItem, remainingInList);
      }

      if (remainingInList === 0 && onComplete) {
        onComplete();
      }
    },
    [items, onItemVerified, onComplete]
  );

  // Hardware HID scanner listener
  useBarcodeScanner({
    onScan: processScan,
    enabled: true,
  });

  const handleReset = (): void => {
    setItems(
      initialItems.map((i) => ({
        ...i,
        verifiedQuantity: 0,
        status: "pending",
      }))
    );
    setLastScanAlert(null);
  };

  return (
    <div
      data-testid="scan-verification-widget"
      className={`rounded-lg border bg-card text-card-foreground shadow-sm p-5 space-y-4 ${className}`}
    >
      {/* Header & Progress */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b">
        <div>
          <div className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-base text-foreground">{title}</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Scan items with USB/Bluetooth reader or camera to verify pick accuracy.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setScannerOpen(true)}
            data-testid="verification-camera-button"
            className="h-8 px-3 text-xs gap-1.5 shadow-sm"
          >
            <Camera className="h-3.5 w-3.5 text-primary" />
            <span>Camera Scanner</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleReset}
            data-testid="verification-reset-button"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Reset verification quantities"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Progress Bar & Stat Counter */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-semibold">
          <span>Overall Verification Progress</span>
          <span className="font-mono text-primary font-bold">
            {`${totalVerified} / ${totalRequired} Units (${percentComplete}%)`}
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
          <div
            data-testid="verification-progress-bar"
            className={`h-full transition-all duration-300 rounded-full ${
              isAllComplete ? "bg-emerald-500" : "bg-primary"
            }`}
            style={{ width: `${percentComplete}%` }}
          />
        </div>
      </div>

      {/* Alert Banner */}
      {lastScanAlert && (
        <div
          data-testid="verification-alert"
          className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
            lastScanAlert.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              : lastScanAlert.type === "warning"
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              : "bg-destructive/10 text-destructive border border-destructive/20"
          }`}
        >
          {lastScanAlert.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span>{lastScanAlert.message}</span>
        </div>
      )}

      {/* Complete Banner */}
      {isAllComplete && (
        <div
          data-testid="verification-complete-banner"
          className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-700 dark:text-emerald-300 flex items-center justify-between text-xs font-bold"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>All items fully picked and verified! Ready for dispatch.</span>
          </div>
          <Badge variant="default" className="bg-emerald-600 text-white hover:bg-emerald-700">
            PASSED
          </Badge>
        </div>
      )}

      {/* Manual Code Input Bar */}
      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder="Scan barcode or type SKU..."
          data-testid="verification-manual-input"
          className="text-xs h-9"
          onKeyDown={(e) => {
            if (e.key === "Enter" && manualInput.trim()) {
              e.preventDefault();
              processScan(manualInput.trim());
              setManualInput("");
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          onClick={() => {
            if (manualInput.trim()) {
              processScan(manualInput.trim());
              setManualInput("");
            }
          }}
          disabled={!manualInput.trim()}
          data-testid="verification-manual-submit"
          className="h-9 px-3 text-xs shrink-0"
        >
          <ScanBarcode className="h-3.5 w-3.5 mr-1" />
          <span>Verify</span>
        </Button>
      </div>

      {/* Pick-List Items Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-muted/50 border-b font-semibold text-muted-foreground">
            <tr>
              <th className="py-2 px-3">Item / SKU</th>
              <th className="py-2 px-3">Barcode</th>
              <th className="py-2 px-3 text-center">Required</th>
              <th className="py-2 px-3 text-center">Verified</th>
              <th className="py-2 px-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => {
              const isItemComplete = item.verifiedQuantity >= item.expectedQuantity;
              const isItemOver = item.verifiedQuantity > item.expectedQuantity;

              return (
                <tr
                  key={item.id}
                  data-testid={`verification-row-${item.id}`}
                  className={`transition-colors ${
                    isItemOver
                      ? "bg-amber-500/5"
                      : isItemComplete
                      ? "bg-emerald-500/5"
                      : "hover:bg-muted/30"
                  }`}
                >
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-foreground">{item.name}</div>
                    {item.sku && (
                      <div className="text-[11px] font-mono text-muted-foreground">
                        {item.sku}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                    {item.barcode}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold font-mono">
                    {item.expectedQuantity}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold font-mono">
                    <span
                      className={
                        isItemOver
                          ? "text-amber-600 font-extrabold"
                          : isItemComplete
                          ? "text-emerald-600 font-extrabold"
                          : "text-foreground"
                      }
                    >
                      {item.verifiedQuantity}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {isItemOver ? (
                      <Badge variant="outline" className="text-amber-600 border-amber-500/30 text-[10px]">
                        OVER
                      </Badge>
                    ) : isItemComplete ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 text-[10px]">
                        VERIFIED
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        PENDING
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Embedded Barcode Camera Scanner Dialog */}
      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={processScan}
        title="Scan Warehouse Item"
      />
    </div>
  );
}
