import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  Button,
} from "@honocube/ui";
import { FileText, Package, Receipt } from "lucide-react";
import type {
  PaperSize,
  PrintDocumentLayout,
  PrintDocumentDialogProps,
} from "@honocube/core";
import { PrintDocument } from "./print-document.js";

export function PrintDocumentDialog({
  open,
  onOpenChange,
  trigger,
  layout: initialLayout = "invoice",
  paperSize: initialPaperSize = "a4",
  ...props
}: PrintDocumentDialogProps): React.JSX.Element {
  const [activeLayout, setActiveLayout] = useState<PrintDocumentLayout>(initialLayout);
  const [activePaperSize, setActivePaperSize] = useState<PaperSize>(initialPaperSize);

  const dialogInner = (
    <>
      <div className="no-print pb-2 border-b">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Print Preview</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Preview and configure print-ready layout for physical printers or PDF export.
            </p>
          </div>

          {/* Layout & Paper Size Controls */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Layout Switcher */}
            <div className="inline-flex rounded-md border bg-muted/50 p-0.5">
              <Button
                type="button"
                variant={activeLayout === "invoice" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setActiveLayout("invoice");
                  if (activePaperSize === "receipt80mm") setActivePaperSize("a4");
                }}
                className="h-7 px-2.5 text-xs gap-1"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Invoice</span>
              </Button>
              <Button
                type="button"
                variant={activeLayout === "packing-slip" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setActiveLayout("packing-slip");
                  if (activePaperSize === "receipt80mm") setActivePaperSize("a4");
                }}
                className="h-7 px-2.5 text-xs gap-1"
              >
                <Package className="h-3.5 w-3.5" />
                <span>Packing Slip</span>
              </Button>
              <Button
                type="button"
                variant={activeLayout === "receipt" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setActiveLayout("receipt");
                  setActivePaperSize("receipt80mm");
                }}
                className="h-7 px-2.5 text-xs gap-1"
              >
                <Receipt className="h-3.5 w-3.5" />
                <span>Receipt</span>
              </Button>
            </div>

            {/* Paper Size Switcher */}
            {activeLayout !== "receipt" && (
              <div className="inline-flex rounded-md border bg-muted/50 p-0.5">
                <Button
                  type="button"
                  variant={activePaperSize === "a4" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setActivePaperSize("a4")}
                  className="h-7 px-2 text-xs"
                >
                  A4
                </Button>
                <Button
                  type="button"
                  variant={activePaperSize === "letter" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setActivePaperSize("letter")}
                  className="h-7 px-2 text-xs"
                >
                  Letter
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Document Rendering */}
      <div className="py-4">
        <PrintDocument
          layout={activeLayout}
          paperSize={activePaperSize}
          showPrintButton={true}
          {...props}
        />
      </div>
    </>
  );

  // In SSR / headless test environments without DOM portal mounting, render dialog container
  if (typeof document === "undefined") {
    if (!open && !trigger) return <></>;
    return (
      <div
        data-testid="print-document-dialog"
        role="dialog"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      >
        <div className="max-w-4xl max-h-[92vh] overflow-y-auto w-full bg-background border p-6 rounded-lg shadow-lg">
          {dialogInner}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        data-testid="print-document-dialog"
        className="max-w-4xl max-h-[92vh] overflow-y-auto"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Print Preview</DialogTitle>
          <DialogDescription>
            Preview and configure print-ready layout for physical printers or PDF export.
          </DialogDescription>
        </DialogHeader>
        {dialogInner}
      </DialogContent>
    </Dialog>
  );
}
