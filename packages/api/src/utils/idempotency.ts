import type { IdempotencyRecord, IdempotencyStorage } from "../types.js";

/**
 * Canonicalizes an object or array by sorting object keys recursively.
 * Ensures consistent serialization for payload fingerprinting regardless
 * of object property order.
 */
function canonicalize(val: any): any {
  if (val === null || typeof val !== "object") {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(canonicalize);
  }
  const sorted: Record<string, any> = {};
  for (const key of Object.keys(val).sort()) {
    sorted[key] = canonicalize(val[key]);
  }
  return sorted;
}

/**
 * Computes a deterministic SHA-256 fingerprint for a mutation request:
 * method + path + canonicalized body.
 */
export async function computeFingerprint(
  method: string,
  path: string,
  bodyText: string
): Promise<string> {
  let normalizedBody = bodyText;
  if (bodyText && bodyText.trim().length > 0) {
    try {
      const parsed = JSON.parse(bodyText);
      if (parsed && typeof parsed === "object") {
        normalizedBody = JSON.stringify(canonicalize(parsed));
      }
    } catch {
      // Non-JSON or malformed body: use raw body text directly
    }
  }

  const payload = `${method.toUpperCase()}:${path}:${normalizedBody}`;
  const cryptoObj = (globalThis as any).crypto;
  if (!cryptoObj?.subtle) {
    throw new Error(
      "Web Crypto API (crypto.subtle) is not available in the current environment."
    );
  }

  const encoded = new TextEncoder().encode(payload);
  const hashBuffer = await cryptoObj.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Default in-memory implementation of IdempotencyStorage.
 * Automatically clears expired keys upon lookup.
 */
export class MemoryIdempotencyStorage implements IdempotencyStorage {
  private store = new Map<string, IdempotencyRecord>();

  async get(key: string): Promise<IdempotencyRecord | null> {
    const record = this.store.get(key);
    if (!record) return null;
    if (Date.now() > record.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return record;
  }

  async set(key: string, record: IdempotencyRecord, ttlMs: number): Promise<void> {
    const expiresAt = record.expiresAt || Date.now() + ttlMs;
    this.store.set(key, { ...record, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}
