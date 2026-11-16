import type {
  PdfPaperSize,
  PdfOrientation,
  PdfFont,
  PdfRgbColor,
  PdfTableColumn,
  PdfTableOptions,
  PdfDocumentOptions,
  PrintDocumentProps,
} from "@honocube/core";

// ---------------------------------------------------------------------------
// Standard Dimensions (in PDF points, 72 pt = 1 inch)
// ---------------------------------------------------------------------------

export const PAGE_SIZES: Record<PdfPaperSize, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612.0, 792.0],
  legal: [612.0, 1008.0],
  receipt80mm: [226.77, 841.89],
};

export const STANDARD_FONTS: Record<PdfFont, string> = {
  Helvetica: "/Helvetica",
  "Helvetica-Bold": "/Helvetica-Bold",
  "Helvetica-Oblique": "/Helvetica-Oblique",
  Courier: "/Courier",
  "Courier-Bold": "/Courier-Bold",
  "Times-Roman": "/Times-Roman",
  "Times-Bold": "/Times-Bold",
};

// ---------------------------------------------------------------------------
// Helpers: Text Measurement & Typography
// ---------------------------------------------------------------------------

const HELVETICA_CHAR_WIDTHS: Record<string, number> = {
  " ": 278,
  "!": 278,
  '"': 355,
  "#": 556,
  $: 556,
  "%": 889,
  "&": 667,
  "'": 191,
  "(": 333,
  ")": 333,
  "*": 389,
  "+": 584,
  ",": 278,
  "-": 333,
  ".": 278,
  "/": 278,
  ":": 278,
  ";": 278,
  "<": 584,
  "=": 584,
  ">": 584,
  "?": 556,
  "@": 1015,
  A: 667,
  B: 667,
  C: 722,
  D: 722,
  E: 667,
  F: 611,
  G: 778,
  H: 722,
  I: 278,
  J: 500,
  K: 667,
  L: 556,
  M: 833,
  N: 722,
  O: 778,
  P: 667,
  Q: 778,
  R: 722,
  S: 667,
  T: 611,
  U: 722,
  V: 667,
  W: 944,
  X: 667,
  Y: 667,
  Z: 611,
  a: 556,
  b: 556,
  c: 500,
  d: 556,
  e: 556,
  f: 278,
  g: 556,
  h: 556,
  i: 222,
  j: 222,
  k: 500,
  l: 222,
  m: 833,
  n: 556,
  o: 556,
  p: 556,
  q: 556,
  r: 333,
  s: 500,
  t: 278,
  u: 556,
  v: 500,
  w: 722,
  x: 500,
  y: 500,
  z: 500,
};

export function measureTextWidth(
  text: string,
  fontSize: number,
  font: PdfFont = "Helvetica"
): number {
  if (!text) return 0;
  if (font.startsWith("Courier")) {
    return text.length * fontSize * 0.6;
  }
  let totalWidthUnits = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    // Digits are tabular: 556 units
    if (char >= "0" && char <= "9") {
      totalWidthUnits += 556;
    } else {
      totalWidthUnits += HELVETICA_CHAR_WIDTHS[char] ?? 556;
    }
  }
  const boldFactor = font.includes("Bold") ? 1.05 : 1.0;
  return (totalWidthUnits / 1000) * fontSize * boldFactor;
}

export function escapePdfString(text: string): string {
  if (!text) return "";
  // Normalize smart quotes and unicode dashes to standard ascii equivalents
  const normalized = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E]/g, (char) => {
      // Map currency symbols or safe fallback
      if (char === "€") return "EUR ";
      if (char === "£") return "GBP ";
      if (char === "¥") return "JPY ";
      return "?";
    });

  return normalized
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n]/g, " ");
}

export function truncateText(
  text: string,
  maxWidth: number,
  fontSize: number,
  font: PdfFont = "Helvetica"
): string {
  if (measureTextWidth(text, fontSize, font) <= maxWidth) {
    return text;
  }
  const ellipsis = "...";
  const ellipsisWidth = measureTextWidth(ellipsis, fontSize, font);
  let truncated = text;
  while (
    truncated.length > 0 &&
    measureTextWidth(truncated, fontSize, font) + ellipsisWidth > maxWidth
  ) {
    truncated = truncated.slice(0, -1);
  }
  return truncated ? `${truncated}${ellipsis}` : "";
}

export function hexToRgb(hex: string): PdfRgbColor {
  const cleanHex = hex.replace("#", "");
  const num = parseInt(cleanHex, 16);
  if (cleanHex.length === 3) {
    const r = ((num >> 8) & 0xf) * 17;
    const g = ((num >> 4) & 0xf) * 17;
    const b = (num & 0xf) * 17;
    return [r / 255, g / 255, b / 255];
  }
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return [r / 255, g / 255, b / 255];
}

// ---------------------------------------------------------------------------
// Binary & Base64 Utilities
// ---------------------------------------------------------------------------

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  downloadBlob(blob, filename);
}

// ---------------------------------------------------------------------------
// PdfPage Class
// ---------------------------------------------------------------------------

export class PdfPage {
  readonly width: number;
  readonly height: number;
  readonly operations: string[] = [];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * Convert top-down Y (0 at top of page) to PDF standard Y (0 at bottom)
   */
  yFromTop(topY: number): number {
    return this.height - topY;
  }

  drawText(
    text: string,
    options: {
      x: number;
      topY: number;
      size?: number;
      font?: PdfFont;
      color?: PdfRgbColor;
      align?: "left" | "center" | "right";
      maxWidth?: number;
    }
  ): number {
    const size = options.size ?? 10;
    const font = options.font ?? "Helvetica";
    const color = options.color ?? [0, 0, 0];
    const align = options.align ?? "left";

    const textToDraw = options.maxWidth
      ? truncateText(text, options.maxWidth, size, font)
      : text;

    const textWidth = measureTextWidth(textToDraw, size, font);
    let drawX = options.x;
    if (align === "right") {
      drawX = options.x - textWidth;
    } else if (align === "center") {
      drawX = options.x - textWidth / 2;
    }

    // PDF text baseline is positioned at baseline Y
    const pdfY = this.yFromTop(options.topY + size * 0.85);

    const fontRef = font === "Helvetica-Bold" ? "/F2" :
                    font === "Courier" ? "/F3" :
                    font === "Courier-Bold" ? "/F4" :
                    font === "Times-Roman" ? "/F5" :
                    font === "Times-Bold" ? "/F6" :
                    font === "Helvetica-Oblique" ? "/F7" : "/F1";

    const escaped = escapePdfString(textToDraw);
    const r = color[0].toFixed(3);
    const g = color[1].toFixed(3);
    const b = color[2].toFixed(3);

    this.operations.push(
      `BT ${fontRef} ${size} Tf ${r} ${g} ${b} rg 1 0 0 1 ${drawX.toFixed(2)} ${pdfY.toFixed(2)} Tm (${escaped}) Tj ET`
    );

    return textWidth;
  }

  drawRect(
    x: number,
    topY: number,
    width: number,
    height: number,
    options?: {
      strokeColor?: PdfRgbColor;
      fillColor?: PdfRgbColor;
      lineWidth?: number;
    }
  ): void {
    const pdfY = this.yFromTop(topY + height);
    const lineWidth = options?.lineWidth ?? 1;

    let op = `q ${lineWidth} w `;
    if (options?.fillColor) {
      const [r, g, b] = options.fillColor;
      op += `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg `;
    }
    if (options?.strokeColor) {
      const [r, g, b] = options.strokeColor;
      op += `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG `;
    }

    op += `${x.toFixed(2)} ${pdfY.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re `;

    if (options?.fillColor && options?.strokeColor) {
      op += "B Q";
    } else if (options?.fillColor) {
      op += "f Q";
    } else {
      op += "S Q";
    }

    this.operations.push(op);
  }

  drawLine(
    x1: number,
    topY1: number,
    x2: number,
    topY2: number,
    options?: {
      color?: PdfRgbColor;
      lineWidth?: number;
      dash?: number[];
    }
  ): void {
    const pdfY1 = this.yFromTop(topY1);
    const pdfY2 = this.yFromTop(topY2);
    const color = options?.color ?? [0, 0, 0];
    const lineWidth = options?.lineWidth ?? 1;

    let op = `q ${lineWidth} w `;
    if (options?.dash && options.dash.length > 0) {
      op += `[${options.dash.join(" ")}] 0 d `;
    }
    op += `${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} RG `;
    op += `${x1.toFixed(2)} ${pdfY1.toFixed(2)} m ${x2.toFixed(2)} ${pdfY2.toFixed(2)} l S Q`;

    this.operations.push(op);
  }

  compileContentStream(): string {
    return this.operations.join("\n");
  }
}

// ---------------------------------------------------------------------------
// PdfDocument Builder Class
// ---------------------------------------------------------------------------

export class PdfDocument {
  readonly pages: PdfPage[] = [];
  readonly defaultPaperSize: PdfPaperSize;
  readonly defaultOrientation: PdfOrientation;
  readonly metadata: PdfDocumentOptions["metadata"];

  constructor(options?: PdfDocumentOptions) {
    this.defaultPaperSize = options?.paperSize ?? "a4";
    this.defaultOrientation = options?.orientation ?? "portrait";
    this.metadata = options?.metadata;
  }

  addPage(paperSize?: PdfPaperSize, orientation?: PdfOrientation): PdfPage {
    const size = paperSize ?? this.defaultPaperSize;
    const orient = orientation ?? this.defaultOrientation;
    const dimensions = PAGE_SIZES[size] ?? PAGE_SIZES.a4;
    let [w, h] = dimensions;
    if (orient === "landscape") {
      const temp = w;
      w = h;
      h = temp;
    }
    const page = new PdfPage(w, h);
    this.pages.push(page);
    return page;
  }

  getPage(index: number): PdfPage | undefined {
    return this.pages[index];
  }

  getCurrentPage(): PdfPage {
    if (this.pages.length === 0) {
      return this.addPage();
    }
    return this.pages[this.pages.length - 1]!;
  }

  compile(): Uint8Array {
    // If no pages were created, add a blank default page
    if (this.pages.length === 0) {
      this.addPage();
    }

    const fontObjects = [
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>",
    ];

    const pageIndices: number[] = [];
    let nextObjIndex = 3 + fontObjects.length; // Obj 10

    for (let p = 0; p < this.pages.length; p++) {
      const pageObjIndex = nextObjIndex++;
      nextObjIndex++; // contentObjIndex
      pageIndices.push(pageObjIndex);
    }

    let infoIndex = 0;
    if (this.metadata?.title || this.metadata?.author) {
      infoIndex = nextObjIndex++;
    }

    const kidsStr = pageIndices.map((idx) => `${idx} 0 R`).join(" ");
    const pagesObjContent = `2 0 obj\n<<\n  /Type /Pages\n  /Kids [${kidsStr}]\n  /Count ${this.pages.length}\n>>\nendobj\n`;

    let output = "%PDF-1.4\n";
    const realOffsets: number[] = [0]; // 0th object is free

    // Obj 1: Catalog
    realOffsets.push(output.length);
    output += "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";

    // Obj 2: Pages
    realOffsets.push(output.length);
    output += pagesObjContent;

    // Font Objs 3-9
    for (let f = 0; f < fontObjects.length; f++) {
      realOffsets.push(output.length);
      output += `${3 + f} 0 obj\n${fontObjects[f]}\nendobj\n`;
    }

    // Pages & Streams
    for (let p = 0; p < this.pages.length; p++) {
      const page = this.pages[p]!;
      const pageObjIndex = pageIndices[p]!;
      const contentObjIndex = pageObjIndex + 1;

      const contentStream = page.compileContentStream();
      const streamBytesLength = new TextEncoder().encode(contentStream).length;

      realOffsets.push(output.length);
      output += `${pageObjIndex} 0 obj\n<<\n  /Type /Page\n  /Parent 2 0 R\n  /MediaBox [0 0 ${page.width.toFixed(2)} ${page.height.toFixed(2)}]\n  /Resources <<\n    /Font <<\n      /F1 3 0 R\n      /F2 4 0 R\n      /F3 5 0 R\n      /F4 6 0 R\n      /F5 7 0 R\n      /F6 8 0 R\n      /F7 9 0 R\n    >>\n  >>\n  /Contents ${contentObjIndex} 0 R\n>>\nendobj\n`;

      realOffsets.push(output.length);
      output += `${contentObjIndex} 0 obj\n<< /Length ${streamBytesLength} >>\nstream\n${contentStream}\nendstream\nendobj\n`;
    }

    if (infoIndex > 0) {
      realOffsets.push(output.length);
      const title = escapePdfString(this.metadata?.title ?? "HonoCube Export");
      const author = escapePdfString(this.metadata?.author ?? "HonoCube");
      output += `${infoIndex} 0 obj\n<< /Title (${title}) /Author (${author}) /Producer (HonoCube PDF Engine) >>\nendobj\n`;
    }

    // Cross-Reference Table
    const startXref = output.length;
    const totalObjs = infoIndex > 0 ? infoIndex + 1 : nextObjIndex;
    output += `xref\n0 ${totalObjs}\n`;
    output += "0000000000 65535 f \n";

    for (let i = 1; i < totalObjs; i++) {
      const offset = realOffsets[i] ?? 0;
      output += `${String(offset).padStart(10, "0")} 00000 n \n`;
    }

    // Trailer
    output += `trailer\n<<\n  /Size ${totalObjs}\n  /Root 1 0 R\n`;
    if (infoIndex > 0) {
      output += `  /Info ${infoIndex} 0 R\n`;
    }
    output += ">>\n";
    output += `startxref\n${startXref}\n%%EOF\n`;

    return new TextEncoder().encode(output);
  }

  toBlob(): Blob {
    const bytes = this.compile();
    return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  }

  toDataUri(): string {
    const bytes = this.compile();
    const base64 = uint8ArrayToBase64(bytes);
    return `data:application/pdf;base64,${base64}`;
  }

  download(filename: string): void {
    const bytes = this.compile();
    downloadPdf(bytes, filename);
  }
}

// ---------------------------------------------------------------------------
// Standalone Programmatic Export: Data Tables to PDF (Issue #133)
// ---------------------------------------------------------------------------

export function exportTableToPdf(options: PdfTableOptions): Uint8Array {
  const paperSize = options.paperSize ?? "a4";
  const orientation = options.orientation ?? "portrait";
  const doc = new PdfDocument({
    paperSize,
    orientation,
    metadata: {
      title: options.title ?? "Table Report",
      author: "HonoCube",
    },
  });

  const margins = typeof options.margins === "number"
    ? { top: options.margins, bottom: options.margins, left: options.margins, right: options.margins }
    : {
        top: options.margins?.top ?? 36,
        bottom: options.margins?.bottom ?? 36,
        left: options.margins?.left ?? 36,
        right: options.margins?.right ?? 36,
      };

  let page = doc.addPage(paperSize, orientation);
  const printableWidth = page.width - margins.left - margins.right;

  // Calculate Column Widths
  const explicitWidthCols = options.columns.filter((c: PdfTableColumn) => c.width && c.width > 0);
  const autoWidthCols = options.columns.filter((c: PdfTableColumn) => !c.width || c.width <= 0);

  const usedWidth = explicitWidthCols.reduce((sum: number, c: PdfTableColumn) => sum + (c.width ?? 0), 0);
  const remainingWidth = Math.max(0, printableWidth - usedWidth);
  const autoWidth = autoWidthCols.length > 0 ? remainingWidth / autoWidthCols.length : 0;

  const resolvedColumns: Array<PdfTableColumn & { resolvedWidth: number }> = options.columns.map((col: PdfTableColumn) => ({
    ...col,
    resolvedWidth: col.width && col.width > 0 ? col.width : autoWidth,
  }));

  const headerBgColor = options.headerBgColor ?? [0.08, 0.13, 0.24]; // Slate Navy
  const headerTextColor = options.headerTextColor ?? [1, 1, 1]; // White
  const alternateRowColor = options.alternateRowColor ?? [0.97, 0.98, 0.99]; // Light Gray
  const borderColor = options.borderColor ?? [0.88, 0.90, 0.92];

  let currentTopY = margins.top;

  // 1. Draw Document Header (Title, Subtitle, Timestamp)
  if (options.title) {
    page.drawText(options.title, {
      x: margins.left,
      topY: currentTopY,
      size: 16,
      font: "Helvetica-Bold",
      color: [0.1, 0.1, 0.1],
    });
    currentTopY += 20;
  }

  if (options.subtitle) {
    page.drawText(options.subtitle, {
      x: margins.left,
      topY: currentTopY,
      size: 9,
      font: "Helvetica",
      color: [0.4, 0.45, 0.5],
    });
    currentTopY += 14;
  }

  if (options.showTimestamp !== false) {
    const timestampStr = `Generated: ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`;
    page.drawText(timestampStr, {
      x: margins.left,
      topY: currentTopY,
      size: 8,
      font: "Courier",
      color: [0.5, 0.5, 0.5],
    });
    currentTopY += 16;
  }

  currentTopY += 4;

  const rowHeight = 20;
  const headerHeight = 22;

  // Helper: Draw Table Header on Page
  const renderTableHeader = (activePage: PdfPage, startY: number): number => {
    activePage.drawRect(margins.left, startY, printableWidth, headerHeight, {
      fillColor: headerBgColor,
      strokeColor: borderColor,
      lineWidth: 0.5,
    });

    let currentX = margins.left;
    for (const col of resolvedColumns) {
      const textX = col.align === "right"
        ? currentX + col.resolvedWidth - 6
        : col.align === "center"
        ? currentX + col.resolvedWidth / 2
        : currentX + 6;

      activePage.drawText(col.header, {
        x: textX,
        topY: startY + 5,
        size: 9,
        font: "Helvetica-Bold",
        color: headerTextColor,
        align: col.align ?? "left",
        maxWidth: col.resolvedWidth - 12,
      });

      currentX += col.resolvedWidth;
    }

    return startY + headerHeight;
  };

  currentTopY = renderTableHeader(page, currentTopY);

  // Helper: Draw Page Footer with Page Number
  const renderPageFooter = (activePage: PdfPage, pageNum: number): void => {
    const footerY = activePage.height - margins.bottom + 12;
    activePage.drawLine(margins.left, footerY - 4, activePage.width - margins.right, footerY - 4, {
      color: borderColor,
      lineWidth: 0.5,
    });

    activePage.drawText("HonoCube Enterprise Report", {
      x: margins.left,
      topY: footerY,
      size: 7,
      font: "Helvetica",
      color: [0.55, 0.6, 0.65],
    });

    if (options.showPageNumbers !== false) {
      activePage.drawText(`Page ${pageNum}`, {
        x: activePage.width - margins.right,
        topY: footerY,
        size: 7,
        font: "Helvetica",
        color: [0.55, 0.6, 0.65],
        align: "right",
      });
    }
  };

  let pageNumber = 1;

  // 2. Render Data Rows
  for (let r = 0; r < options.data.length; r++) {
    const row = options.data[r]!;

    // Check pagination threshold
    if (currentTopY + rowHeight > page.height - margins.bottom - 20) {
      renderPageFooter(page, pageNumber);
      pageNumber++;
      page = doc.addPage(paperSize, orientation);
      currentTopY = margins.top;
      currentTopY = renderTableHeader(page, currentTopY);
    }

    // Row Background (Alternating)
    const isAlt = r % 2 === 1;
    if (isAlt) {
      page.drawRect(margins.left, currentTopY, printableWidth, rowHeight, {
        fillColor: alternateRowColor,
      });
    }

    // Row Bottom Border
    page.drawLine(margins.left, currentTopY + rowHeight, margins.left + printableWidth, currentTopY + rowHeight, {
      color: borderColor,
      lineWidth: 0.5,
    });

    // Cell Texts
    let currentX = margins.left;
    for (const col of resolvedColumns) {
      const rawVal = row[col.key];
      const cellText = rawVal == null ? "" : String(rawVal);

      const textX = col.align === "right"
        ? currentX + col.resolvedWidth - 6
        : col.align === "center"
        ? currentX + col.resolvedWidth / 2
        : currentX + 6;

      page.drawText(cellText, {
        x: textX,
        topY: currentTopY + 5,
        size: 8.5,
        font: "Helvetica",
        color: [0.15, 0.18, 0.22],
        align: col.align ?? "left",
        maxWidth: col.resolvedWidth - 12,
      });

      currentX += col.resolvedWidth;
    }

    currentTopY += rowHeight;
  }

  // Draw footer on last page
  renderPageFooter(page, pageNumber);

  return doc.compile();
}

// ---------------------------------------------------------------------------
// Standalone Programmatic Export: Invoices, Receipts & Packing Slips (Issue #133)
// ---------------------------------------------------------------------------

export function exportDocumentToPdf(
  docProps: PrintDocumentProps,
  options?: Partial<PdfDocumentOptions>
): Uint8Array {
  const paperSize = options?.paperSize ?? (docProps.paperSize === "letter" ? "letter" : "a4");
  const orientation = options?.orientation ?? "portrait";

  const doc = new PdfDocument({
    paperSize,
    orientation,
    metadata: {
      title: `${docProps.title ?? "Invoice"} ${docProps.documentNumber ?? ""}`.trim(),
      author: docProps.company?.name ?? "HonoCube",
    },
  });

  const margins = { top: 36, bottom: 36, left: 36, right: 36 };
  let page = doc.addPage(paperSize, orientation);
  const printableWidth = page.width - margins.left - margins.right;

  const isReceipt = docProps.layout === "receipt" || docProps.paperSize === "receipt80mm";
  const isPackingSlip = docProps.layout === "packing-slip";
  const documentTitle = (
    docProps.title ||
    (isReceipt ? "RECEIPT" : isPackingSlip ? "PACKING SLIP" : "TAX INVOICE")
  ).toUpperCase();

  let currentY = margins.top;

  // 1. Corporate Header
  const companyName = docProps.company?.name || "HonoCube Enterprise";
  page.drawText(companyName, {
    x: margins.left,
    topY: currentY,
    size: 15,
    font: "Helvetica-Bold",
    color: [0.08, 0.12, 0.2],
  });

  // Document Title & Number (Top-Right)
  page.drawText(documentTitle, {
    x: page.width - margins.right,
    topY: currentY,
    size: 14,
    font: "Helvetica-Bold",
    color: [0.08, 0.12, 0.2],
    align: "right",
  });

  if (docProps.documentNumber) {
    page.drawText(`#${docProps.documentNumber}`, {
      x: page.width - margins.right,
      topY: currentY + 16,
      size: 10,
      font: "Helvetica-Bold",
      color: [0.3, 0.35, 0.4],
      align: "right",
    });
  }

  currentY += 18;

  // Company Address Lines
  if (docProps.company?.address) {
    const addresses = Array.isArray(docProps.company.address)
      ? docProps.company.address
      : [docProps.company.address];
    for (const line of addresses) {
      page.drawText(line, {
        x: margins.left,
        topY: currentY,
        size: 8,
        font: "Helvetica",
        color: [0.4, 0.45, 0.5],
      });
      currentY += 11;
    }
  }

  if (docProps.company?.taxId) {
    page.drawText(`Tax ID: ${docProps.company.taxId}`, {
      x: margins.left,
      topY: currentY,
      size: 8,
      font: "Helvetica",
      color: [0.4, 0.45, 0.5],
    });
    currentY += 11;
  }

  // Metadata: Date, Due Date, Status
  const metaStartX = page.width - margins.right;
  let metaY = currentY - 5;
  if (docProps.date) {
    const dateStr = typeof docProps.date === "string" ? docProps.date : docProps.date.toISOString().slice(0, 10);
    page.drawText(`Date: ${dateStr}`, {
      x: metaStartX,
      topY: metaY,
      size: 8.5,
      font: "Helvetica",
      color: [0.3, 0.35, 0.4],
      align: "right",
    });
    metaY += 12;
  }

  if (docProps.dueDate && !isPackingSlip) {
    const dueStr = typeof docProps.dueDate === "string" ? docProps.dueDate : docProps.dueDate.toISOString().slice(0, 10);
    page.drawText(`Due Date: ${dueStr}`, {
      x: metaStartX,
      topY: metaY,
      size: 8.5,
      font: "Helvetica-Bold",
      color: [0.2, 0.25, 0.3],
      align: "right",
    });
    metaY += 12;
  }

  if (docProps.status) {
    page.drawText(`Status: ${docProps.status}`, {
      x: metaStartX,
      topY: metaY,
      size: 8.5,
      font: "Helvetica-Bold",
      color: [0.1, 0.5, 0.2],
      align: "right",
    });
  }

  currentY = Math.max(currentY + 12, metaY + 16);

  // Horizontal Accent Divider
  page.drawLine(margins.left, currentY, page.width - margins.right, currentY, {
    color: [0.85, 0.88, 0.9],
    lineWidth: 1,
  });
  currentY += 14;

  // 2. Bill To & Ship To Blocks
  const halfWidth = printableWidth / 2 - 10;
  if (docProps.customer || docProps.shippingAddress) {
    // Bill To
    if (docProps.customer) {
      page.drawText("BILL TO", {
        x: margins.left,
        topY: currentY,
        size: 8,
        font: "Helvetica-Bold",
        color: [0.5, 0.55, 0.6],
      });

      let custY = currentY + 12;
      if (docProps.customer.name) {
        page.drawText(docProps.customer.name, {
          x: margins.left,
          topY: custY,
          size: 9.5,
          font: "Helvetica-Bold",
          color: [0.1, 0.12, 0.15],
        });
        custY += 12;
      }
      if (docProps.customer.company) {
        page.drawText(docProps.customer.company, {
          x: margins.left,
          topY: custY,
          size: 8.5,
          font: "Helvetica",
          color: [0.3, 0.35, 0.4],
        });
        custY += 11;
      }
      if (docProps.customer.address) {
        const cAddrs = Array.isArray(docProps.customer.address)
          ? docProps.customer.address
          : [docProps.customer.address];
        for (const line of cAddrs) {
          page.drawText(line, {
            x: margins.left,
            topY: custY,
            size: 8,
            font: "Helvetica",
            color: [0.4, 0.45, 0.5],
          });
          custY += 10;
        }
      }
    }

    // Ship To
    const shipTo = docProps.shippingAddress || (isPackingSlip ? docProps.customer : undefined);
    if (shipTo) {
      const shipX = margins.left + halfWidth + 20;
      page.drawText("SHIP TO / DESTINATION", {
        x: shipX,
        topY: currentY,
        size: 8,
        font: "Helvetica-Bold",
        color: [0.5, 0.55, 0.6],
      });

      let shipY = currentY + 12;
      if (shipTo.name) {
        page.drawText(shipTo.name, {
          x: shipX,
          topY: shipY,
          size: 9.5,
          font: "Helvetica-Bold",
          color: [0.1, 0.12, 0.15],
        });
        shipY += 12;
      }
      if (shipTo.company) {
        page.drawText(shipTo.company, {
          x: shipX,
          topY: shipY,
          size: 8.5,
          font: "Helvetica",
          color: [0.3, 0.35, 0.4],
        });
        shipY += 11;
      }
      if (shipTo.address) {
        const sAddrs = Array.isArray(shipTo.address) ? shipTo.address : [shipTo.address];
        for (const line of sAddrs) {
          page.drawText(line, {
            x: shipX,
            topY: shipY,
            size: 8,
            font: "Helvetica",
            color: [0.4, 0.45, 0.5],
          });
          shipY += 10;
        }
      }
    }

    currentY += 56;
  }

  // 3. Line Items Table
  const tableHeaderBg = [0.08, 0.13, 0.24] as PdfRgbColor;
  const tableBorderColor = [0.88, 0.9, 0.92] as PdfRgbColor;
  const headerHeight = 20;
  const rowHeight = 22;

  // Determine item columns
  const hasSku = docProps.items.some((i) => i.sku);
  const skuWidth = hasSku ? 75 : 0;
  const qtyWidth = 45;
  const priceWidth = isPackingSlip ? 0 : 65;
  const amountWidth = isPackingSlip ? 0 : 75;
  const verifyWidth = isPackingSlip ? 50 : 0;
  const descWidth = printableWidth - skuWidth - qtyWidth - priceWidth - amountWidth - verifyWidth;

  const renderDocTableHeader = (activePage: PdfPage, startY: number): number => {
    activePage.drawRect(margins.left, startY, printableWidth, headerHeight, {
      fillColor: tableHeaderBg,
      strokeColor: tableBorderColor,
      lineWidth: 0.5,
    });

    let colX = margins.left + 6;
    if (hasSku) {
      activePage.drawText("SKU", { x: colX, topY: startY + 5, size: 8, font: "Helvetica-Bold", color: [1, 1, 1] });
      colX += skuWidth;
    }

    activePage.drawText("DESCRIPTION", { x: colX, topY: startY + 5, size: 8, font: "Helvetica-Bold", color: [1, 1, 1] });
    colX += descWidth;

    activePage.drawText("QTY", { x: colX + qtyWidth / 2, topY: startY + 5, size: 8, font: "Helvetica-Bold", color: [1, 1, 1], align: "center" });
    colX += qtyWidth;

    if (!isPackingSlip) {
      activePage.drawText("UNIT PRICE", { x: colX + priceWidth - 6, topY: startY + 5, size: 8, font: "Helvetica-Bold", color: [1, 1, 1], align: "right" });
      colX += priceWidth;

      activePage.drawText("AMOUNT", { x: colX + amountWidth - 6, topY: startY + 5, size: 8, font: "Helvetica-Bold", color: [1, 1, 1], align: "right" });
      colX += amountWidth;
    } else {
      activePage.drawText("VERIFIED", { x: colX + verifyWidth / 2, topY: startY + 5, size: 8, font: "Helvetica-Bold", color: [1, 1, 1], align: "center" });
    }

    return startY + headerHeight;
  };

  currentY = renderDocTableHeader(page, currentY);

  // Render items
  for (let i = 0; i < docProps.items.length; i++) {
    const item = docProps.items[i]!;

    if (currentY + rowHeight > page.height - margins.bottom - 40) {
      page = doc.addPage(paperSize, orientation);
      currentY = margins.top;
      currentY = renderDocTableHeader(page, currentY);
    }

    // Alternating row
    if (i % 2 === 1) {
      page.drawRect(margins.left, currentY, printableWidth, rowHeight, {
        fillColor: [0.98, 0.98, 0.99],
      });
    }

    // Bottom border
    page.drawLine(margins.left, currentY + rowHeight, margins.left + printableWidth, currentY + rowHeight, {
      color: tableBorderColor,
      lineWidth: 0.5,
    });

    let itemX = margins.left + 6;
    if (hasSku) {
      page.drawText(item.sku || "—", {
        x: itemX,
        topY: currentY + 6,
        size: 8,
        font: "Courier",
        color: [0.25, 0.3, 0.35],
        maxWidth: skuWidth - 8,
      });
      itemX += skuWidth;
    }

    page.drawText(item.description, {
      x: itemX,
      topY: currentY + 6,
      size: 8.5,
      font: "Helvetica-Bold",
      color: [0.1, 0.12, 0.15],
      maxWidth: descWidth - 8,
    });
    itemX += descWidth;

    page.drawText(String(item.quantity), {
      x: itemX + qtyWidth / 2,
      topY: currentY + 6,
      size: 8.5,
      font: "Helvetica-Bold",
      color: [0.1, 0.12, 0.15],
      align: "center",
    });
    itemX += qtyWidth;

    if (!isPackingSlip) {
      const unitPriceStr = `$${(item.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      page.drawText(unitPriceStr, {
        x: itemX + priceWidth - 6,
        topY: currentY + 6,
        size: 8.5,
        font: "Helvetica",
        color: [0.25, 0.3, 0.35],
        align: "right",
      });
      itemX += priceWidth;

      const rowAmount = item.amount ?? (item.unitPrice || 0) * item.quantity;
      const amountStr = `$${rowAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      page.drawText(amountStr, {
        x: itemX + amountWidth - 6,
        topY: currentY + 6,
        size: 8.5,
        font: "Helvetica-Bold",
        color: [0.1, 0.12, 0.15],
        align: "right",
      });
    } else {
      // Checkbox placeholder for warehouse packing verification
      page.drawRect(itemX + verifyWidth / 2 - 5, currentY + 5, 10, 10, {
        strokeColor: [0.6, 0.65, 0.7],
        lineWidth: 0.8,
      });
    }

    currentY += rowHeight;
  }

  currentY += 12;

  // 4. Financial Totals Ledger & Notes
  if (docProps.totals && docProps.totals.length > 0 && !isPackingSlip) {
    const totalsWidth = 180;
    const totalsX = page.width - margins.right - totalsWidth;

    for (const total of docProps.totals) {
      page.drawText(total.label, {
        x: totalsX,
        topY: currentY,
        size: total.isGrandTotal ? 10 : 8.5,
        font: total.isGrandTotal ? "Helvetica-Bold" : "Helvetica",
        color: total.isGrandTotal ? [0.08, 0.12, 0.2] : [0.4, 0.45, 0.5],
      });

      const valStr = typeof total.value === "number"
        ? `$${total.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
        : String(total.value);

      page.drawText(valStr, {
        x: page.width - margins.right,
        topY: currentY,
        size: total.isGrandTotal ? 10 : 8.5,
        font: "Helvetica-Bold",
        color: total.isGrandTotal ? [0.08, 0.12, 0.2] : [0.2, 0.25, 0.3],
        align: "right",
      });

      if (total.isGrandTotal) {
        page.drawLine(totalsX, currentY - 4, page.width - margins.right, currentY - 4, {
          color: [0.8, 0.83, 0.86],
          lineWidth: 1,
        });
      }

      currentY += 16;
    }
  }

  // Terms & Notes (Bottom Left)
  if (docProps.terms || docProps.notes) {
    let noteY = currentY + 10;
    if (docProps.notes) {
      page.drawText("Notes:", { x: margins.left, topY: noteY, size: 8, font: "Helvetica-Bold", color: [0.3, 0.35, 0.4] });
      noteY += 11;
      page.drawText(docProps.notes, { x: margins.left, topY: noteY, size: 7.5, font: "Helvetica", color: [0.45, 0.5, 0.55], maxWidth: 300 });
      noteY += 14;
    }
    if (docProps.terms) {
      page.drawText("Terms & Conditions:", { x: margins.left, topY: noteY, size: 8, font: "Helvetica-Bold", color: [0.3, 0.35, 0.4] });
      noteY += 11;
      page.drawText(docProps.terms, { x: margins.left, topY: noteY, size: 7.5, font: "Helvetica", color: [0.45, 0.5, 0.55], maxWidth: 300 });
    }
  }

  // Signature Block
  if (docProps.signature?.signerName) {
    const sigX = page.width - margins.right - 140;
    const sigY = page.height - margins.bottom - 40;

    page.drawLine(sigX, sigY + 16, sigX + 140, sigY + 16, {
      color: [0.6, 0.65, 0.7],
      lineWidth: 0.8,
      dash: [2, 2],
    });

    page.drawText(docProps.signature.signerName, {
      x: sigX,
      topY: sigY + 22,
      size: 8.5,
      font: "Helvetica-Bold",
      color: [0.1, 0.15, 0.2],
    });

    if (docProps.signature.date) {
      const sigDateStr = typeof docProps.signature.date === "string"
        ? docProps.signature.date
        : docProps.signature.date.toISOString().slice(0, 10);
      page.drawText(`Date: ${sigDateStr}`, {
        x: sigX,
        topY: sigY + 32,
        size: 7.5,
        font: "Courier",
        color: [0.45, 0.5, 0.55],
      });
    }
  }

  return doc.compile();
}
