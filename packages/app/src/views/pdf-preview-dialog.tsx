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
import { Download, FileText } from "lucide-react";
import type { PdfPreviewDialogProps } from "@honocube/core";
import { downloadBlob } from "../pdf/pdf-engine.js";

export function PdfPreviewDialog({
  open,
  onOpenChange,
  pdfDataUri,
  pdfBlob,
  filename = "document.pdf",
  title = "PDF Document Preview",
  trigger,
  onDownload,
}: PdfPreviewDialogProps): React.JSX.Element {
  const handleDownload = (): void => {
    if (onDownload) {
      onDownload();
      return;
    }
    if (pdfBlob) {
      downloadBlob(pdfBlob, filename);
    } else if (pdfDataUri && typeof window !== "undefined") {
      const anchor = document.createElement("a");
      anchor.href = pdfDataUri;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
  };

  const dialogContent = (
    <>
      <div className="flex flex-wrap items-center justify-between pb-3 border-b gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground">{filename}</p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={handleDownload}
          data-testid="pdf-download-button"
          className="gap-1.5 h-8 px-3 text-xs shadow-sm"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Download PDF</span>
        </Button>
      </div>

      <div className="py-4">
        {pdfDataUri ? (
          <iframe
            src={pdfDataUri}
            title={title}
            data-testid="pdf-preview-frame"
            className="w-full h-[68vh] rounded border bg-muted/20"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-[40vh] border rounded-lg bg-muted/10 text-muted-foreground text-sm">
            <FileText className="h-10 w-10 mb-2 opacity-40" />
            <p>PDF binary rendered and ready for download.</p>
          </div>
        )}
      </div>
    </>
  );

  // SSR / headless test fallback
  if (typeof document === "undefined") {
    if (!open && !trigger) return <></>;
    return (
      <div
        data-testid="pdf-preview-dialog"
        role="dialog"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      >
        <div className="max-w-4xl max-h-[92vh] overflow-y-auto w-full bg-background border p-6 rounded-lg shadow-lg">
          {dialogContent}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        data-testid="pdf-preview-dialog"
        className="max-w-4xl max-h-[92vh] overflow-y-auto"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{filename}</DialogDescription>
        </DialogHeader>
        {dialogContent}
      </DialogContent>
    </Dialog>
  );
}
