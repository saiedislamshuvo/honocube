/**
 * RFC 4180 compliant CSV Parser, Serializer, and Batch Ingestion Utilities
 */

export interface ParseCsvOptions {
  delimiter?: string;
  hasHeader?: boolean;
  trimValues?: boolean;
}

export interface ParsedCsvResult {
  headers: string[];
  rows: Record<string, string>[];
  rowsRaw: string[][];
  totalRows: number;
}

/**
 * Parses raw CSV/TSV text into structured headers and records according to RFC 4180.
 * Accurately parses escaped double quotes (""), multiline cells, and varied delimiters.
 */
export function parseCsv(text: string, options: ParseCsvOptions = {}): ParsedCsvResult {
  const delimiter = options.delimiter || (text.includes("\t") && !text.includes(",") ? "\t" : ",");
  const hasHeader = options.hasHeader ?? true;
  const trimValues = options.trimValues ?? true;

  const rawRows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentCell += '"';
          i += 2;
          continue;
        } else {
          // End of quoted section
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentCell += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      }

      if (char === delimiter) {
        currentRow.push(trimValues ? currentCell.trim() : currentCell);
        currentCell = "";
        i++;
        continue;
      }

      if (char === "\r" || char === "\n") {
        currentRow.push(trimValues ? currentCell.trim() : currentCell);
        currentCell = "";

        // Skip CRLF
        if (char === "\r" && nextChar === "\n") {
          i += 2;
        } else {
          i++;
        }

        // Only push non-empty lines
        if (currentRow.length > 0 && currentRow.some((c) => c !== "")) {
          rawRows.push(currentRow);
        }
        currentRow = [];
        continue;
      }

      currentCell += char;
      i++;
    }
  }

  // Push final cell and row
  if (currentCell !== "" || inQuotes || currentRow.length > 0) {
    currentRow.push(trimValues ? currentCell.trim() : currentCell);
    if (currentRow.some((c) => c !== "")) {
      rawRows.push(currentRow);
    }
  }

  if (rawRows.length === 0) {
    return { headers: [], rows: [], rowsRaw: [], totalRows: 0 };
  }

  let headers: string[] = [];
  let dataRows: string[][] = [];

  const firstRow = rawRows[0] || [];
  if (hasHeader) {
    headers = firstRow.map((h) => (trimValues ? h.trim() : h));
    dataRows = rawRows.slice(1);
  } else {
    headers = firstRow.map((_, idx) => `column_${idx + 1}`);
    dataRows = rawRows;
  }

  const rows: Record<string, string>[] = [];
  for (const row of dataRows) {
    const obj: Record<string, string> = {};
    for (let h = 0; h < headers.length; h++) {
      const headerKey = headers[h] ?? `column_${h + 1}`;
      obj[headerKey] = row[h] !== undefined ? (row[h] as string) : "";
    }
    rows.push(obj);
  }

  return {
    headers,
    rows,
    rowsRaw: dataRows,
    totalRows: rows.length,
  };
}

/**
 * Escapes an individual cell value according to RFC 4180 rules.
 */
export function escapeCsvCell(val: unknown, delimiter = ","): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(delimiter) || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serializes an array of records and headers into RFC 4180 CSV string.
 */
export function serializeCsv(
  headers: string[],
  rows: Record<string, unknown>[],
  options: { delimiter?: string; newline?: string } = {}
): string {
  const delimiter = options.delimiter || ",";
  const newline = options.newline || "\r\n";

  const headerLine = headers.map((h) => escapeCsvCell(h, delimiter)).join(delimiter);
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCsvCell(row[h] ?? "", delimiter)).join(delimiter)
  );

  return [headerLine, ...dataLines].join(newline) + newline;
}

/**
 * Generates sample CSV template content from field descriptors.
 */
export function generateCsvTemplate(
  fields: Array<{ key: string; label?: string; sample?: unknown }>
): string {
  const headers = fields.map((f) => f.key);
  const sampleRow: Record<string, unknown> = {};

  for (const f of fields) {
    if (f.sample !== undefined) {
      sampleRow[f.key] = f.sample;
    } else {
      const lower = f.key.toLowerCase();
      if (lower.includes("email")) sampleRow[f.key] = "user@example.com";
      else if (lower.includes("phone")) sampleRow[f.key] = "+1-555-0100";
      else if (lower.includes("price") || lower.includes("amount")) sampleRow[f.key] = 49.99;
      else if (lower.includes("qty") || lower.includes("quantity")) sampleRow[f.key] = 10;
      else if (lower.includes("date")) sampleRow[f.key] = "2026-01-01";
      else if (lower.includes("status")) sampleRow[f.key] = "active";
      else if (lower.startsWith("is") || lower.startsWith("has")) sampleRow[f.key] = "true";
      else sampleRow[f.key] = `Sample ${f.label || f.key}`;
    }
  }

  return serializeCsv(headers, [sampleRow]);
}

/**
 * Browser file download helper for CSV content.
 */
export function downloadCsvFile(filename: string, content: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Splits an array into chunks of the given size.
 */
export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export interface ImportChunkResult {
  creates?: unknown[];
  updates?: unknown[];
  unchanged?: unknown[];
  errors?: Array<{ index: number; error: unknown }>;
}

export interface ImportInChunksProgress {
  processed: number;
  total: number;
  percent: number;
  creates: number;
  updates: number;
  errors: number;
}

export interface ImportInChunksOptions<T = unknown> {
  rows: T[];
  chunkSize?: number;
  onChunk: (chunk: T[], chunkIndex: number, totalChunks: number) => Promise<ImportChunkResult>;
  onProgress?: (progress: ImportInChunksProgress) => void;
}

export interface ImportInChunksSummary {
  totalCreated: number;
  totalUpdated: number;
  totalUnchanged: number;
  errors: Array<{ index: number; error: unknown }>;
}

/**
 * Executes a large batch import by chunking records sequentially,
 * reporting incremental progress, and aggregating final statistics.
 */
export async function importInChunks<T = unknown>(
  options: ImportInChunksOptions<T>
): Promise<ImportInChunksSummary> {
  const { rows, chunkSize = 100, onChunk, onProgress } = options;
  const chunks = chunkArray(rows, chunkSize);
  const summary: ImportInChunksSummary = {
    totalCreated: 0,
    totalUpdated: 0,
    totalUnchanged: 0,
    errors: [],
  };

  let processedCount = 0;
  const totalCount = rows.length;

  for (let c = 0; c < chunks.length; c++) {
    const chunk = chunks[c];
    if (!chunk) continue;
    const startIndex = c * chunkSize;
    const res = await onChunk(chunk, c, chunks.length);

    const chunkCreates = res.creates?.length ?? 0;
    const chunkUpdates = res.updates?.length ?? 0;
    const chunkUnchanged = res.unchanged?.length ?? 0;

    summary.totalCreated += chunkCreates;
    summary.totalUpdated += chunkUpdates;
    summary.totalUnchanged += chunkUnchanged;

    if (res.errors && res.errors.length > 0) {
      for (const err of res.errors) {
        summary.errors.push({
          index: startIndex + err.index,
          error: err.error,
        });
      }
    }

    processedCount += chunk.length;
    if (onProgress) {
      onProgress({
        processed: processedCount,
        total: totalCount,
        percent: totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 100,
        creates: summary.totalCreated,
        updates: summary.totalUpdated,
        errors: summary.errors.length,
      });
    }
  }

  return summary;
}
