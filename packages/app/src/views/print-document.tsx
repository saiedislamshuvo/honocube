import React, { useRef } from "react";
import {
  Printer,
  FileDown,
  Building2,
  FileText,
  Package,
  Receipt,
  Truck,
} from "lucide-react";
import { Button, Badge, Barcode, QRCode, cn } from "@honocube/ui";
import type {
  PaperSize,
  PrintDocumentProps,
} from "@honocube/core";
import { exportDocumentToPdf, downloadPdf } from "../pdf/pdf-engine.js";

// ---------------------------------------------------------------------------
// Helpers: Print Styles Generator
// ---------------------------------------------------------------------------

function getPaperSizeStyles(size: PaperSize = "a4"): string {
  switch (size) {
    case "receipt80mm":
      return `
        @page {
          size: 80mm auto;
          margin: 3mm;
        }
        .honocube-print-container {
          width: 74mm !important;
          max-width: 74mm !important;
          padding: 2mm !important;
          font-size: 11px !important;
          margin: 0 auto;
        }
      `;
    case "letter":
      return `
        @page {
          size: letter portrait;
          margin: 12mm;
        }
        .honocube-print-container {
          width: 100% !important;
          max-width: 216mm;
          margin: 0 auto;
        }
      `;
    case "legal":
      return `
        @page {
          size: legal portrait;
          margin: 12mm;
        }
        .honocube-print-container {
          width: 100% !important;
          max-width: 216mm;
          margin: 0 auto;
        }
      `;
    case "a4":
    default:
      return `
        @page {
          size: A4 portrait;
          margin: 12mm;
        }
        .honocube-print-container {
          width: 100% !important;
          max-width: 210mm;
          margin: 0 auto;
        }
      `;
  }
}

// ---------------------------------------------------------------------------
// Component: PrintDocument
// ---------------------------------------------------------------------------

export function PrintDocument(props: PrintDocumentProps): React.JSX.Element {
  const {
    layout = "invoice",
    paperSize = "a4",
    title,
    documentNumber,
    date,
    dueDate,
    status = "PAID",
    company,
    customer,
    shippingAddress,
    items = [],
    totals = [],
    notes,
    terms,
    barcodeOrQrValue,
    signature,
    className = "",
    showPrintButton = true,
    onPrint,
    showPdfExport = true,
    onExportPdf,
  } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);

  const formattedDate = date
    ? date instanceof Date
      ? date.toLocaleDateString()
      : String(date)
    : new Date().toLocaleDateString();

  const formattedDueDate = dueDate
    ? dueDate instanceof Date
      ? dueDate.toLocaleDateString()
      : String(dueDate)
    : undefined;

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleExportPdf = () => {
    if (onExportPdf) {
      onExportPdf();
    } else {
      const pdfBytes = exportDocumentToPdf(props);
      const fname = `${(documentTitle || "document").toLowerCase().replace(/\s+/g, "-")}-${documentNumber || "export"}.pdf`;
      downloadPdf(pdfBytes, fname);
    }
  };

  const isReceipt = layout === "receipt" || paperSize === "receipt80mm";
  const isPackingSlip = layout === "packing-slip";
  const documentTitle =
    title ||
    (isReceipt
      ? "RECEIPT"
      : isPackingSlip
      ? "PACKING SLIP"
      : "TAX INVOICE");

  return (
    <div className={cn("relative bg-background text-foreground", className)}>
      {/* 1. Global Print Styles for Media Print */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            ${getPaperSizeStyles(paperSize)}

            @media print {
              html, body {
                background: #ffffff !important;
                color: #000000 !important;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
                margin: 0 !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              /* Hide all web application chrome */
              nav, aside, header, footer,
              [data-sidebar], [data-topbar],
              .no-print, [data-no-print],
              .print-hide {
                display: none !important;
              }

              .honocube-print-container {
                box-shadow: none !important;
                border: none !important;
                background: transparent !important;
                padding: 0 !important;
              }

              /* Table pagination & breaks */
              table {
                page-break-inside: auto;
              }
              tr {
                page-break-inside: avoid;
                break-inside: avoid;
              }
              thead {
                display: table-header-group !important;
              }
              tfoot {
                display: table-footer-group !important;
              }
              .print-avoid-break {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
            }
          `,
        }}
      />

      {/* 2. On-Screen Preview Toolbar (Hidden when printing) */}
      {showPrintButton && (
        <div
          data-testid="print-toolbar"
          className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              {isReceipt ? (
                <Receipt className="h-4 w-4" />
              ) : isPackingSlip ? (
                <Package className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
            </span>
            <div>
              <span className="text-sm font-semibold">{documentTitle}</span>
              {documentNumber && (
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {`#${documentNumber}`}
                </span>
              )}
            </div>
            <Badge variant="outline" className="ml-2 uppercase text-[10px]">
              {paperSize}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {showPdfExport && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportPdf}
                data-testid="export-pdf-button"
                className="gap-1.5 h-8 px-3 text-xs shadow-sm"
              >
                <FileDown className="h-3.5 w-3.5" />
                <span>Export PDF</span>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              data-testid="print-button"
              className="gap-1.5 h-8 px-3 text-xs shadow-sm"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Document</span>
            </Button>
          </div>
        </div>
      )}

      {/* 3. Document Body */}
      <div
        ref={containerRef}
        data-testid="printable-document"
        className={cn(
          "honocube-print-container bg-card rounded-lg border shadow-sm p-8 text-card-foreground",
          isReceipt && "p-4 max-w-[320px] font-mono text-xs"
        )}
      >
        {isReceipt ? (
          /* =========================================================================
           * 80mm THERMAL RECEIPT LAYOUT
           * ========================================================================= */
          <div className="space-y-3 text-center">
            {company?.logo && (
              <div className="flex justify-center mb-1">
                <img
                  src={company.logo}
                  alt={company.name || "Company"}
                  className="max-h-10 object-contain"
                />
              </div>
            )}
            <div>
              <h2 className="text-sm font-bold tracking-tight">{company?.name || "Company"}</h2>
              {company?.address && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {Array.isArray(company.address)
                    ? company.address.join(", ")
                    : company.address}
                </p>
              )}
              {company?.taxId && (
                <p className="text-[10px] text-muted-foreground">
                  Tax ID: {company.taxId}
                </p>
              )}
              {company?.phone && (
                <p className="text-[10px] text-muted-foreground">
                  Tel: {company.phone}
                </p>
              )}
            </div>

            <div className="border-t border-dashed my-2 pt-2 text-left text-[11px]">
              <div className="flex justify-between">
                <span>Receipt #:</span>
                <span className="font-bold">{documentNumber || "REC-001"}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{formattedDate}</span>
              </div>
              {customer?.name && (
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span>{customer.name}</span>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="border-t border-b border-dashed py-2 text-left">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-dashed text-[10px] font-bold">
                    <th className="text-left pb-1">Item</th>
                    <th className="text-center pb-1">Qty</th>
                    <th className="text-right pb-1">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b border-dashed/50">
                      <td className="py-1">
                        <div className="font-medium">{item.description}</div>
                        {item.sku && (
                          <div className="text-[9px] text-muted-foreground">
                            {item.sku}
                          </div>
                        )}
                      </td>
                      <td className="text-center py-1 align-top">{item.quantity}</td>
                      <td className="text-right py-1 align-top font-bold">
                        {`$${((item.amount ?? (item.unitPrice || 0) * item.quantity)).toFixed(2)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="space-y-1 text-right text-[11px]">
              {totals.map((t, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex justify-between",
                    t.isGrandTotal && "font-bold text-sm border-t border-dashed pt-1"
                  )}
                >
                  <span>{t.label}:</span>
                  <span>
                    {typeof t.value === "number" ? `$${t.value.toFixed(2)}` : t.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Receipt Barcode */}
            {barcodeOrQrValue && (
              <div className="flex flex-col items-center justify-center pt-2">
                <Barcode value={barcodeOrQrValue} width={1} height={32} fontSize={9} />
              </div>
            )}

            {/* Footer */}
            <div className="pt-2 text-[10px] text-muted-foreground border-t border-dashed">
              <p>{notes || "Thank you for your business!"}</p>
              {terms && <p className="mt-1">{terms}</p>}
            </div>
          </div>
        ) : (
          /* =========================================================================
           * INVOICE & PACKING SLIP LAYOUTS
           * ========================================================================= */
          <div className="space-y-6">
            {/* 1. Header: Company Info (Left) & Document Meta (Right) */}
            <div className="flex flex-wrap items-start justify-between gap-6 pb-6 border-b">
              {/* Company Profile */}
              <div className="space-y-2 max-w-sm">
                {company?.logo ? (
                  <img
                    src={company.logo}
                    alt={company.name || "Company"}
                    className="max-h-12 object-contain"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-6 w-6 text-primary" />
                    <span className="text-xl font-bold tracking-tight">
                      {company?.name || "Company"}
                    </span>
                  </div>
                )}

                {company?.logo && company.name && (
                  <div className="text-lg font-bold">{company.name}</div>
                )}

                <div className="text-xs text-muted-foreground space-y-0.5 leading-relaxed">
                  {company?.address && (
                    <div>
                      {Array.isArray(company.address)
                        ? company.address.map((line, idx) => (
                            <div key={idx}>{line}</div>
                          ))
                        : company.address}
                    </div>
                  )}
                  {company?.taxId && <div>Tax ID / VAT: {company.taxId}</div>}
                  {company?.email && <div>Email: {company.email}</div>}
                  {company?.phone && <div>Tel: {company.phone}</div>}
                  {company?.website && <div>Web: {company.website}</div>}
                </div>
              </div>

              {/* Document Identity */}
              <div className="text-right space-y-2">
                <h1 className="text-2xl font-extrabold tracking-tight uppercase">
                  {documentTitle}
                </h1>

                {documentNumber && (
                  <div className="font-mono text-base font-semibold text-foreground">
                    {`#${documentNumber}`}
                  </div>
                )}

                <div className="text-xs space-y-1 text-muted-foreground">
                  <div className="flex justify-end gap-3">
                    <span className="font-medium text-foreground">Date:</span>
                    <span>{formattedDate}</span>
                  </div>
                  {formattedDueDate && !isPackingSlip && (
                    <div className="flex justify-end gap-3">
                      <span className="font-medium text-foreground">Due Date:</span>
                      <span>{formattedDueDate}</span>
                    </div>
                  )}
                  {status && (
                    <div className="pt-1">
                      <Badge
                        variant={status === "PAID" ? "default" : "outline"}
                        className="font-bold uppercase tracking-wider text-[10px]"
                      >
                        {status}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Customer & Shipping Addresses (2-column grid) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs print-avoid-break">
              {/* Bill To / Customer */}
              {customer && (
                <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                  <div className="font-semibold text-foreground uppercase tracking-wider text-[11px] text-muted-foreground mb-1">
                    {isPackingSlip ? "Recipient / Customer" : "Bill To"}
                  </div>
                  <div className="font-bold text-sm text-foreground">
                    {customer.name}
                  </div>
                  {customer.company && (
                    <div className="font-medium">{customer.company}</div>
                  )}
                  {customer.address && (
                    <div className="text-muted-foreground leading-relaxed">
                      {Array.isArray(customer.address)
                        ? customer.address.map((line, idx) => (
                            <div key={idx}>{line}</div>
                          ))
                        : customer.address}
                    </div>
                  )}
                  {customer.email && (
                    <div className="text-muted-foreground">{customer.email}</div>
                  )}
                  {customer.phone && (
                    <div className="text-muted-foreground">{customer.phone}</div>
                  )}
                  {customer.taxId && (
                    <div className="text-muted-foreground">Tax ID: {customer.taxId}</div>
                  )}
                </div>
              )}

              {/* Ship To / Delivery Address */}
              {shippingAddress ? (
                <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                  <div className="font-semibold text-foreground uppercase tracking-wider text-[11px] text-muted-foreground mb-1 flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Ship To / Delivery Destination</span>
                  </div>
                  <div className="font-bold text-sm text-foreground">
                    {shippingAddress.name}
                  </div>
                  {shippingAddress.company && (
                    <div className="font-medium">{shippingAddress.company}</div>
                  )}
                  {shippingAddress.address && (
                    <div className="text-muted-foreground leading-relaxed">
                      {Array.isArray(shippingAddress.address)
                        ? shippingAddress.address.map((line, idx) => (
                            <div key={idx}>{line}</div>
                          ))
                        : shippingAddress.address}
                    </div>
                  )}
                  {shippingAddress.phone && (
                    <div className="text-muted-foreground">{shippingAddress.phone}</div>
                  )}
                </div>
              ) : isPackingSlip && customer ? (
                <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                  <div className="font-semibold text-foreground uppercase tracking-wider text-[11px] text-muted-foreground mb-1">
                    Shipping Details
                  </div>
                  <div className="text-muted-foreground">
                    Shipment matching customer address above.
                  </div>
                </div>
              ) : null}
            </div>

            {/* 3. Itemized Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b-2 border-border bg-muted/50 font-semibold text-foreground text-[11px]">
                    <th className="py-2.5 px-3 text-left w-10">#</th>
                    {items.some((i) => i.sku) && (
                      <th className="py-2.5 px-3 text-left w-28">SKU</th>
                    )}
                    <th className="py-2.5 px-3 text-left">Description</th>
                    <th className="py-2.5 px-3 text-center w-20">Quantity</th>
                    {!isPackingSlip && (
                      <>
                        <th className="py-2.5 px-3 text-right w-24">Unit Price</th>
                        {items.some((i) => i.discount) && (
                          <th className="py-2.5 px-3 text-right w-20">Discount</th>
                        )}
                        <th className="py-2.5 px-3 text-right w-28">Total</th>
                      </>
                    )}
                    {isPackingSlip && (
                      <th className="py-2.5 px-3 text-center w-28">Verified</th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {items.map((item, idx) => {
                    const rowAmount =
                      item.amount ?? (item.unitPrice || 0) * item.quantity;

                    return (
                      <tr
                        key={item.id ?? idx}
                        className="border-b border-border/80 transition-colors"
                      >
                        <td className="py-2.5 px-3 text-muted-foreground font-mono">
                          {idx + 1}
                        </td>
                        {items.some((i) => i.sku) && (
                          <td className="py-2.5 px-3 font-mono font-medium text-foreground">
                            {item.sku || "—"}
                          </td>
                        )}
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-foreground">
                            {item.description}
                          </div>
                          {item.notes && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {item.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold font-mono">
                          {item.quantity}
                        </td>
                        {!isPackingSlip && (
                          <>
                            <td className="py-2.5 px-3 text-right font-mono">
                              {`$${(item.unitPrice || 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })}`}
                            </td>
                            {items.some((i) => i.discount) && (
                              <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                                {item.discount || "—"}
                              </td>
                            )}
                            <td className="py-2.5 px-3 text-right font-mono font-bold">
                              {`$${rowAmount.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })}`}
                            </td>
                          </>
                        )}
                        {isPackingSlip && (
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-block h-4 w-4 rounded border border-muted-foreground/60" />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 4. Footer Section: Notes & Totals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t print-avoid-break">
              {/* Left Column: Notes, Terms & Barcode/QR */}
              <div className="space-y-4 text-xs">
                {notes && (
                  <div>
                    <span className="font-bold text-foreground">Notes:</span>
                    <p className="text-muted-foreground mt-0.5 whitespace-pre-line leading-relaxed">
                      {notes}
                    </p>
                  </div>
                )}

                {terms && (
                  <div>
                    <span className="font-bold text-foreground">
                      Terms & Payment Remittance:
                    </span>
                    <p className="text-muted-foreground mt-0.5 whitespace-pre-line leading-relaxed">
                      {terms}
                    </p>
                  </div>
                )}

                {barcodeOrQrValue && (
                  <div className="pt-2 flex items-center gap-4">
                    <Barcode
                      value={barcodeOrQrValue}
                      width={1.2}
                      height={40}
                      fontSize={10}
                    />
                    <QRCode value={barcodeOrQrValue} size={64} />
                  </div>
                )}
              </div>

              {/* Right Column: Totals & Signature */}
              <div className="space-y-4">
                {totals.length > 0 && !isPackingSlip && (
                  <div className="rounded-lg border bg-muted/20 p-4 space-y-2 text-xs">
                    {totals.map((t, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex justify-between items-center text-muted-foreground",
                          t.isGrandTotal &&
                            "text-sm font-extrabold text-foreground border-t-2 border-border pt-2 mt-2"
                        )}
                      >
                        <span>{t.label}</span>
                        <span className="font-mono">
                          {typeof t.value === "number"
                            ? `$${t.value.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })}`
                            : t.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Signature Block */}
                {signature && (
                  <div className="pt-6 border-t space-y-1">
                    <div className="font-semibold text-xs text-muted-foreground">
                      {signature.label || "Authorized Signature"}
                    </div>
                    {signature.signatureUrl ? (
                      <img
                        src={signature.signatureUrl}
                        alt="Signature"
                        className="max-h-16 object-contain"
                      />
                    ) : (
                      <div className="h-12 border-b border-dashed border-muted-foreground/60 w-48" />
                    )}
                    {signature.signerName && (
                      <div className="text-xs font-bold text-foreground">
                        {signature.signerName}
                      </div>
                    )}
                    {signature.date && (
                      <div className="text-[11px] text-muted-foreground font-mono">
                        Date:{" "}
                        {signature.date instanceof Date
                          ? signature.date.toLocaleDateString()
                          : String(signature.date)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
