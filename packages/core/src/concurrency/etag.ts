import type { RevisionConflict } from "./types.js";

/**
 * Formats a semantic revision number or hash into a valid HTTP ETag string (weak ETag by default).
 */
export function generateETag(version: string | number): string {
  return `W/"${version}"`;
}

/**
 * Parses and normalizes an incoming ETag string or If-Match header to extract the raw version identifier.
 */
export function parseETag(etag?: string | null): string | null {
  if (!etag || typeof etag !== "string") return null;
  const cleaned = etag.replace(/^W\//, "").replace(/^"/, "").replace(/"$/, "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Determines whether an HTTP response status or API error code indicates an OCC or revision conflict.
 */
export function isRevisionConflict(status?: number, code?: string): boolean {
  if (status === 409 || status === 412) return true;
  if (code === "OCC_FAILED" || code === "PRECONDITION_FAILED" || code === "CONFLICT") return true;
  return false;
}

/**
 * Extracts revision conflict details from an ApiClientError or error object.
 */
export function extractConflictDetails<T = Record<string, unknown>>(
  error: unknown,
  fallbackId?: string | number,
  clientRecord?: T
): RevisionConflict<T> | null {
  if (!error || typeof error !== "object") return null;

  const anyErr = error as any;
  const status = anyErr.status;
  const code = anyErr.code;

  if (!isRevisionConflict(status, code)) {
    return null;
  }

  const details = anyErr.details || {};
  return {
    id: details.id ?? fallbackId ?? "",
    expectedVersion: details.expectedVersion,
    currentVersion: details.currentVersion,
    serverRecord: details.currentRecord ?? details.serverRecord,
    clientRecord,
  };
}
