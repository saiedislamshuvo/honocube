import type { DatabaseAdapter } from "../adapters/base.js";
import type {
  OutboxRecord,
  OutboxStatus,
  WebhookEndpointConfig,
  WebhookDeliveryRecord,
  AppWebhookConfig,
  VerifyWebhookSignatureOptions,
  VerifyWebhookSignatureResult,
} from "../types.js";

/**
 * Signs a webhook payload using HMAC-SHA256 and returns a standard signature header string:
 * `t=<timestamp>,v1=<hex_signature>`.
 */
export async function signWebhookPayload(
  payload: any,
  secret: string,
  timestamp?: number
): Promise<string> {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload);
  const signedPayload = `${ts}.${payloadString}`;

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API (crypto.subtle) is not available in the current environment.");
  }

  const encoder = new TextEncoder();
  const key = await subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload)
  );

  const signatureHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `t=${ts},v1=${signatureHex}`;
}

/**
 * Verifies an incoming webhook request's HMAC-SHA256 signature against the expected payload and secret.
 * Supports tolerance windows to prevent replay attacks.
 */
export async function verifyWebhookSignature(
  payload: any,
  signatureHeader: string | null | undefined,
  secret: string,
  options?: VerifyWebhookSignatureOptions
): Promise<VerifyWebhookSignatureResult> {
  if (!signatureHeader || typeof signatureHeader !== "string") {
    return { valid: false, reason: "MISSING_HEADER" };
  }

  const parts = signatureHeader.split(",");
  let timestampStr: string | undefined;
  const signatures: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key === "t" && val) timestampStr = val;
    if (key === "v1" && val) signatures.push(val);
  }

  if (!timestampStr) {
    return { valid: false, reason: "MISSING_TIMESTAMP" };
  }

  const timestamp = parseInt(timestampStr, 10);
  if (Number.isNaN(timestamp)) {
    return { valid: false, reason: "MALFORMED_HEADER" };
  }

  if (signatures.length === 0) {
    return { valid: false, reason: "MISSING_SIGNATURE", timestamp };
  }

  const tolerance = options?.toleranceSeconds ?? 300;
  const now = options?.now ?? Math.floor(Date.now() / 1000);

  if (tolerance > 0 && Math.abs(now - timestamp) > tolerance) {
    return { valid: false, reason: "TIMESTAMP_EXPIRED", timestamp };
  }

  const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload);
  const signedPayload = `${timestamp}.${payloadString}`;

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API (crypto.subtle) is not available in the current environment.");
  }

  const encoder = new TextEncoder();
  const key = await subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const dataBytes = encoder.encode(signedPayload);

  for (const sigHex of signatures) {
    if (sigHex.length % 2 !== 0) continue;
    const match = sigHex.match(/.{1,2}/g);
    if (!match) continue;
    const sigBytes = new Uint8Array(match.map((byte) => parseInt(byte, 16)));
    try {
      const isValid = await subtle.verify("HMAC", key, sigBytes, dataBytes);
      if (isValid) {
        return { valid: true, timestamp, signature: sigHex };
      }
    } catch {
      // Ignore format errors on individual signatures and continue
    }
  }

  return { valid: false, reason: "INVALID_SIGNATURE", timestamp };
}

/**
 * Determines whether a webhook endpoint subscription matches an event.
 */
export function isWebhookEventMatch(
  subscribedEvents: string[] | undefined,
  resource: string,
  event: string
): boolean {
  if (!subscribedEvents || subscribedEvents.length === 0 || subscribedEvents.includes("*")) {
    return true;
  }
  const qualifiedEvent = `${resource}.${event}`;
  const resourceWildcard = `${resource}.*`;
  return (
    subscribedEvents.includes(qualifiedEvent) ||
    subscribedEvents.includes(resourceWildcard) ||
    subscribedEvents.includes(event)
  );
}

/**
 * Computes exponential backoff with an upper bound limit.
 */
export function calculateRetryBackoff(
  attempt: number,
  baseBackoffMs = 1000,
  maxBackoffMs = 3600000
): number {
  const delay = baseBackoffMs * Math.pow(2, Math.max(0, attempt - 1));
  return Math.min(delay, maxBackoffMs);
}

export interface DispatchWebhookOptions {
  fetchFn?: typeof fetch;
  timestamp?: number;
}

/**
 * Dispatches a single webhook notification with HMAC-SHA256 headers.
 */
export async function dispatchSingleWebhook(
  endpoint: WebhookEndpointConfig,
  record: OutboxRecord,
  options?: DispatchWebhookOptions
): Promise<WebhookDeliveryRecord> {
  const deliveryId = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2) + Date.now().toString(36);

  const timestamp = options?.timestamp ?? Math.floor(Date.now() / 1000);
  const startTime = Date.now();
  const signature = await signWebhookPayload(record, endpoint.secret, timestamp);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Honocube-Signature": signature,
    "X-Honocube-Event": String(record.event),
    "X-Honocube-Delivery": deliveryId,
    ...(endpoint.headers ?? {}),
  };

  const fetchImpl = options?.fetchFn ?? globalThis.fetch;
  if (!fetchImpl) {
    return {
      id: deliveryId,
      outboxId: record.id,
      endpointUrl: endpoint.url,
      event: String(record.event),
      attempt: (record.attempts ?? 0) + 1,
      statusCode: null,
      durationMs: 0,
      error: "No fetch implementation available",
      requestHeaders: headers,
      requestPayload: record,
      responseBody: null,
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const res = await fetchImpl(endpoint.url, {
      method: "POST",
      headers,
      body: JSON.stringify(record),
    });

    const durationMs = Date.now() - startTime;
    let responseText: string | null = null;
    try {
      responseText = await res.text();
    } catch {
      // Ignore body read errors
    }

    const isOk = res.ok;
    return {
      id: deliveryId,
      outboxId: record.id,
      endpointUrl: endpoint.url,
      event: String(record.event),
      attempt: (record.attempts ?? 0) + 1,
      statusCode: res.status,
      durationMs,
      error: isOk ? null : `HTTP ${res.status}: ${res.statusText || responseText || "Error"}`,
      requestHeaders: headers,
      requestPayload: record,
      responseBody: responseText,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    return {
      id: deliveryId,
      outboxId: record.id,
      endpointUrl: endpoint.url,
      event: String(record.event),
      attempt: (record.attempts ?? 0) + 1,
      statusCode: null,
      durationMs,
      error: err?.message ?? String(err),
      requestHeaders: headers,
      requestPayload: record,
      responseBody: null,
      timestamp: new Date().toISOString(),
    };
  }
}

export interface ProcessOutboxOptions {
  outboxTable: any;
  endpoints?: WebhookEndpointConfig[];
  webhooks?: AppWebhookConfig;
  limit?: number;
  fetch?: typeof fetch;
  now?: number;
}

export interface ProcessOutboxResult {
  processed: number;
  delivered: number;
  failed: number;
  skipped: number;
}

/**
 * Pulls pending and due-for-retry records from an outbox table and dispatches them to configured subscribers.
 * Updates delivery statuses, attempt counts, and nextRetryAt backoffs.
 */
export async function processOutboxQueue(
  adapter: DatabaseAdapter<any, any, any>,
  options: ProcessOutboxOptions
): Promise<ProcessOutboxResult> {
  const limit = options.limit ?? 50;
  const nowMs = options.now ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const webhookConfig = options.webhooks;
  const endpoints = options.endpoints ?? (Array.isArray(webhookConfig?.endpoints) ? webhookConfig.endpoints : []);
  const maxAttempts = webhookConfig?.maxAttempts ?? 3;
  const retryBackoffMs = webhookConfig?.retryBackoffMs ?? 1000;
  const fetchFn = options.fetch ?? webhookConfig?.fetch ?? globalThis.fetch;

  const result: ProcessOutboxResult = {
    processed: 0,
    delivered: 0,
    failed: 0,
    skipped: 0,
  };

  if (!endpoints || endpoints.length === 0) {
    return result;
  }

  const columnNames = adapter.getColumnNames(options.outboxTable);
  const colRecordId = columnNames.includes("record_id") ? "record_id" : "recordId";
  const colNextRetry = columnNames.includes("next_retry_at") ? "next_retry_at" : "nextRetryAt";
  const colCreatedAt = columnNames.includes("created_at") ? "created_at" : "createdAt";
  const colTenantId = columnNames.includes("tenant_id") ? "tenant_id" : "tenantId";

  const rawRows: any[] = await adapter.findMany(options.outboxTable, {
    where: (cols: any, { and, or, eq, lt, lte, isNull }: any) => {
      const isPending = eq(cols.status, "pending");
      const nextRetryCol = cols[colNextRetry];
      const isDueRetry = and(
        eq(cols.status, "failed"),
        lt(cols.attempts, maxAttempts),
        or(isNull(nextRetryCol), lte(nextRetryCol, nowIso))
      );
      return or(isPending, isDueRetry);
    },
    limit,
  });

  if (!rawRows || rawRows.length === 0) {
    return result;
  }

  for (const raw of rawRows) {
    result.processed++;
    let payload = raw.payload;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        // Keep as string
      }
    }

    const record: OutboxRecord = {
      id: raw.id,
      resource: raw.resource,
      recordId: raw[colRecordId],
      event: raw.event,
      payload,
      tenantId: raw[colTenantId] ?? null,
      status: raw.status,
      attempts: Number(raw.attempts ?? 0),
      lastError: raw.lastError ?? raw.last_error ?? null,
      nextRetryAt: raw[colNextRetry] ?? null,
      createdAt: raw[colCreatedAt],
      updatedAt: raw.updatedAt ?? raw.updated_at ?? null,
    };

    const matching = endpoints.filter(
      (ep) => !ep.disabled && isWebhookEventMatch(ep.events, record.resource, record.event)
    );

    if (matching.length === 0) {
      result.skipped++;
      continue;
    }

    let allSuccess = true;
    let lastError: string | null = null;
    const currentAttempt = record.attempts + 1;

    for (const ep of matching) {
      if (ep.filter) {
        const allowed = await ep.filter(record);
        if (!allowed) continue;
      }

      const delivery = await dispatchSingleWebhook(ep, record, { fetchFn });

      if (delivery.error || (delivery.statusCode && (delivery.statusCode < 200 || delivery.statusCode >= 300))) {
        allSuccess = false;
        lastError = delivery.error ?? `HTTP ${delivery.statusCode}`;
      }
    }

    const newStatus: OutboxStatus = allSuccess
      ? "delivered"
      : currentAttempt >= maxAttempts
      ? "failed"
      : "pending";

    const nextRetryAt =
      !allSuccess && currentAttempt < maxAttempts
        ? new Date(nowMs + calculateRetryBackoff(currentAttempt, retryBackoffMs)).toISOString()
        : null;

    if (allSuccess) {
      result.delivered++;
    } else {
      result.failed++;
    }

    const updatePayload: Record<string, any> = {
      status: newStatus,
      attempts: currentAttempt,
      lastError,
      nextRetryAt,
      updatedAt: new Date().toISOString(),
    };

    const mappedUpdate: Record<string, any> = {};
    if (columnNames.includes("status")) mappedUpdate.status = newStatus;
    if (columnNames.includes("attempts")) mappedUpdate.attempts = currentAttempt;
    if (columnNames.includes("last_error")) mappedUpdate.last_error = lastError;
    else if (columnNames.includes("lastError")) mappedUpdate.lastError = lastError;
    if (columnNames.includes("next_retry_at")) mappedUpdate.next_retry_at = nextRetryAt;
    else if (columnNames.includes("nextRetryAt")) mappedUpdate.nextRetryAt = nextRetryAt;
    if (columnNames.includes("updated_at")) mappedUpdate.updated_at = updatePayload.updatedAt;
    else if (columnNames.includes("updatedAt")) mappedUpdate.updatedAt = updatePayload.updatedAt;

    await adapter.update(options.outboxTable, record.id, mappedUpdate);
  }

  return result;
}
