import { Hono, Context } from "hono";
import { ResourceConfig, AppConfig, IdempotencyStorage, RateLimitStore, TenancyValue, AuditAction, AuditEntry, AuditFieldDiff, OutboxEvent, OutboxRecord, OutboxStatus, WebhookEndpointConfig } from "../types.js";
import { dispatchSingleWebhook, isWebhookEventMatch, calculateRetryBackoff } from "../utils/webhooks.js";
import { ApiError, errorBody, ValidationError } from "../utils/errors.js";
import { MemoryIdempotencyStorage, computeFingerprint } from "../utils/idempotency.js";
import { MemoryRateLimitStore, parseWindow } from "../utils/rate-limit.js";
import { generateOpenApiSpec, renderScalarDocsHtml } from "../utils/openapi.js";
import { ApiOptions, OpenApiDocsConfig } from "../types.js";
import { DatabaseAdapter, DatabaseStrategy } from "../adapters/base.js";
import {
  parseBatchDeleteBody,
  parseBatchUpdateBody,
  resolveValidators,
  validateWith,
} from "./validation.js";

/**
 * The execution strategy used when the application does not ask for one.
 *
 * This is the single source of truth for the default — `createApp` and every
 * strategy-reading call site read it from here.
 */
export const DEFAULT_STRATEGY: DatabaseStrategy = "batch";

/**
 * Whether a value is something the framework recurses into.
 *
 * `finalize` and `processUploads` both walk nested values, and both have to
 * skip the values that are not containers. A string, a number or a boolean
 * would otherwise be spread into an object — a string into its characters —
 * which is nonsense output rather than the value the caller sent.
 */
const isRecursable = (value: unknown): boolean => typeof value === "object" && value !== null;

/**
 * The body Hono's built-in not-found handler answers with.
 *
 * A response carrying exactly this body is the framework's own fallback; the
 * resource not-found handler replaces it with the error envelope. A not-found
 * handler installed by the application answers with something else and is
 * left alone.
 */
const DEFAULT_NOT_FOUND_BODY = "404 Not Found";

/**
 * Whether a response is Hono's built-in not-found answer.
 */
const isDefaultNotFound = async (res: Response): Promise<boolean> => {
  if (res.status !== 404) return false;
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/plain")) return false;
  try {
    return (await res.clone().text()) === DEFAULT_NOT_FOUND_BODY;
  } catch {
    return false;
  }
};

/**
 * Creates the resource framework with global configuration.
 */
export const RESOURCE_CONFIG = Symbol.for("honocube.resource_config");
export const API_CONFIG = Symbol.for("honocube.api_config");

export function createApp<Env extends Record<string, unknown> = Record<string, unknown>, AppContext = any>(
  globalConfig: AppConfig<Env, AppContext>
) {
  // Copy the config so the caller's object is never mutated. The defaults are
  // applied to the copy, not written back into the object the caller holds.
  const appConfig: AppConfig<Env, AppContext> = { ...globalConfig };

  if (appConfig.rateLimit && !appConfig.rateLimit.store) {
    appConfig.rateLimit = {
      ...appConfig.rateLimit,
      store: new MemoryRateLimitStore(),
    };
  }

  if (appConfig.idempotency && !appConfig.idempotency.storage) {
    appConfig.idempotency = {
      ...appConfig.idempotency,
      storage: new MemoryIdempotencyStorage(),
    };
  }

  // Set default strategy to batch if not provided
  if (!appConfig.strategy) {
    appConfig.strategy = DEFAULT_STRATEGY;
  }

  // Setup default logger if none provided
  if (!appConfig.logger) {
    appConfig.logger = {
      info: (msg, ...meta) => console.log(`[HonoCube INFO] ${msg}`, ...meta),
      warn: (msg, ...meta) => console.warn(`[HonoCube WARN] ${msg}`, ...meta),
      error: (msg, err, ...meta) => console.error(`[HonoCube ERROR] ${msg}`, err, ...meta),
      debug: (msg, ...meta) => console.debug(`[HonoCube DEBUG] ${msg}`, ...meta),
    };
  }

  return {
    defineResource: <TTable, TSelect, TInsert>(
      config: ResourceConfig<TTable, TSelect, TInsert, Env, AppContext>
    ) => defineResource<TTable, TSelect, TInsert, Env, AppContext>(config, appConfig),

    defineApi: (resources: Record<string, Hono<any>>, version?: string) => 
      defineApi<Env>(resources, version)
  };
}

/**
 * Reads the `limit` of a list request.
 *
 * A malformed limit is refused rather than repaired: a limit of 0 makes the
 * number of pages infinite, and a negative limit is read by some drivers as
 * "no limit" — the endpoint would answer with every row.
 *
 * A limit above the maximum is not an error, it is capped — that has always
 * been the behaviour, and it is what protects the database.
 */
const parseLimit = (raw: string | undefined, maxLimit: number): number | undefined => {
  if (raw === undefined) return undefined;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    const shown = Number.isFinite(value) ? value : raw;
    throw new ApiError(
      400,
      "INVALID_PAGINATION",
      `Invalid 'limit': expected an integer between 1 and ${maxLimit}, got ${shown}.`,
      { limit: shown, maxLimit }
    );
  }

  return value;
};

/**
 * Reads the `page` of a list request.
 *
 * The page decides the offset, so a page below 1 would ask the database for
 * a negative offset — which some drivers read as "from the beginning".
 */

const toBase64Url = (str: string): string => {
  const nodeBuf = (globalThis as any).Buffer;
  if (nodeBuf) {
    return nodeBuf.from(str, "utf8").toString("base64url");
  }
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]!);
  }
  return btoa(bin)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

const fromBase64Url = (base64UrlStr: string): string => {
  const nodeBuf = (globalThis as any).Buffer;
  if (nodeBuf) {
    return nodeBuf.from(base64UrlStr, "base64url").toString("utf8");
  }
  let base64 = base64UrlStr.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
};

const parsePage = (raw: string | undefined): number | undefined => {
  if (raw === undefined) return undefined;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    const shown = Number.isFinite(value) ? value : raw;
    throw new ApiError(
      400,
      "INVALID_PAGINATION",
      `Invalid 'page': expected an integer of at least 1, got ${shown}.`,
      { page: shown }
    );
  }

  return value;
};


// Audit Engine Helpers
const getClientIp = (c: Context): string | null => {
  return (
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    null
  );
};

const getUserAgent = (c: Context): string | null => {
  return c.req.header("user-agent") ?? null;
};

const computeFieldDiff = (
  oldRecord: Record<string, unknown> | null | undefined,
  newRecord: Record<string, unknown> | null | undefined,
  excludeFields: Set<string>,
  maskFields: Set<string>,
  maskString: string = "********"
): AuditFieldDiff[] => {
  const diff: AuditFieldDiff[] = [];
  if (!oldRecord && !newRecord) return diff;

  const allKeys = new Set([
    ...Object.keys(oldRecord ?? {}),
    ...Object.keys(newRecord ?? {}),
  ]);

  for (const key of allKeys) {
    if (excludeFields.has(key)) continue;

    const oldVal = oldRecord ? oldRecord[key] : undefined;
    const newVal = newRecord ? newRecord[key] : undefined;

    const isDifferent =
      oldVal !== newVal &&
      JSON.stringify(oldVal) !== JSON.stringify(newVal);

    if (isDifferent) {
      const isMasked = maskFields.has(key);
      diff.push({
        field: key,
        from: isMasked ? (oldVal !== undefined ? maskString : undefined) : oldVal,
        to: isMasked ? (newVal !== undefined ? maskString : undefined) : newVal,
      });
    }
  }

  return diff;
};

const sanitizeAuditSnapshot = (
  record: Record<string, unknown> | null | undefined,
  excludeFields: Set<string>,
  maskFields: Set<string>,
  maskString: string = "********"
): Record<string, unknown> | null => {
  if (!record) return null;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (excludeFields.has(key)) continue;
    sanitized[key] = maskFields.has(key) ? maskString : value;
  }
  return sanitized;
};

export function defineResource<
  TTable, 
  TSelect, 
  TInsert, 
  Env extends Record<string, unknown> = Record<string, unknown>,
  AppContext = any
>(
  config: ResourceConfig<TTable, TSelect, TInsert, Env, AppContext>,
  globalConfig?: AppConfig<Env, AppContext>
) {
  const app = new Hono<{ Bindings: Env }>();
  
  const getAdapter = (c: Context<{ Bindings: Env }>) => {
    const adapter = config.adapter ?? globalConfig?.adapter;
    if (!adapter) {
      throw ApiError.internal(`Adapter not found for resource: ${config.name}. Ensure it is provided in defineResource or createApp.`);
    }
    return typeof adapter === 'function' ? adapter(c) : adapter;
  };

  const methods = new Set(config.methods ?? ["list", "detail", "create", "update", "delete"]);
  // Audit Configuration Resolution
  const isAuditEnabled = Boolean(
    config.audit === true ||
    (typeof config.audit === "object" && config.audit.enabled !== false) ||
    (config.audit === undefined && Boolean(globalConfig?.audit?.table || globalConfig?.audit?.store))
  );

  const auditConfigObj = typeof config.audit === "object" ? config.audit : undefined;

  const allowedAuditActions = new Set<AuditAction>(
    auditConfigObj?.actions ?? [
      "create",
      "update",
      "delete",
      "batch-update",
      "batch-delete",
      "transition",
    ]
  );

  const shouldAuditAction = (action: AuditAction) => isAuditEnabled && allowedAuditActions.has(action);

  const auditExcludeFields = new Set<string>([
    ...(globalConfig?.audit?.excludeFields ?? []),
    ...(auditConfigObj?.excludeFields ?? []),
  ]);

  const auditMaskFields = new Set<string>([
    ...(globalConfig?.audit?.maskFields ?? []),
    ...(auditConfigObj?.maskFields ?? []),
  ]);

  const auditMaskString = auditConfigObj?.maskString ?? globalConfig?.audit?.maskString ?? "********";

  const resolveActorId = async (c: Context, appContext: any): Promise<string | number | null> => {
    if (globalConfig?.audit?.getActorId) {
      const res = await globalConfig.audit.getActorId(appContext, c as any);
      return res ?? null;
    }
    if (appContext && typeof appContext === "object") {
      return (
        appContext.userId ??
        appContext.user?.id ??
        appContext.actorId ??
        appContext.sub ??
        null
      );
    }
    return null;
  };

  const dispatchAudit = async (entry: AuditEntry<AppContext>, c: Context, appContext: AppContext) => {
    const auditPromise = (async () => {
      try {
        if (globalConfig?.audit?.store) {
          await globalConfig.audit.store(entry, c as any, appContext);
        }

        if (globalConfig?.audit?.table) {
          const adapter = getAdapter(c);
          const auditPayload: Record<string, any> = {
            resource: entry.resource,
            recordId: String(entry.recordId),
            action: entry.action,
            actorId: entry.actorId !== null && entry.actorId !== undefined ? String(entry.actorId) : null,
            tenantId: entry.tenantId !== null && entry.tenantId !== undefined ? String(entry.tenantId) : null,
            diff: entry.diff ? JSON.stringify(entry.diff) : null,
            oldData: entry.oldData ? JSON.stringify(entry.oldData) : null,
            newData: entry.newData ? JSON.stringify(entry.newData) : null,
            metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
            ip: entry.ip ?? null,
            userAgent: entry.userAgent ?? null,
            timestamp: entry.timestamp,
          };
          await adapter.insert(globalConfig.audit.table, auditPayload);
        }
      } catch (err) {
        if (globalConfig?.logger?.error) {
          globalConfig.logger.error("Audit logging failed:", err);
        } else {
          console.error("[HonoCube ERROR] Audit logging failed:", err);
        }
      }
    })();

    const mode = globalConfig?.audit?.mode ?? "async";
    if (mode === "sync") {
      await auditPromise;
    } else {
      const executionCtx = (c as any).executionCtx;
      if (executionCtx && typeof executionCtx.waitUntil === "function") {
        executionCtx.waitUntil(auditPromise);
      } else {
        auditPromise.catch(() => {});
      }
    }
  };

  // Outbox Configuration Resolution
  const isOutboxEnabled = Boolean(
    config.outbox === true ||
    (typeof config.outbox === "object" && config.outbox.enabled !== false) ||
    (config.outbox === undefined &&
      (Boolean(globalConfig?.outbox?.table || globalConfig?.outbox?.sink) ||
       Boolean(globalConfig?.webhooks?.endpoints)) &&
      globalConfig?.outbox?.enabledByDefault !== false)
  );

  const outboxConfigObj = typeof config.outbox === "object" ? config.outbox : undefined;

  const allowedOutboxEvents = new Set<string>(
    outboxConfigObj?.events ?? [
      "create",
      "update",
      "delete",
      "batch-update",
      "batch-delete",
      "transition",
    ]
  );

  const shouldRecordOutboxEvent = (event: string) => isOutboxEnabled && allowedOutboxEvents.has(event);

  const createOutboxEntry = (
    event: OutboxEvent,
    recordId: string | number,
    payload: any,
    tenancyVal?: any
  ): OutboxRecord => {
    const id = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2) + Date.now().toString(36);
    return {
      id,
      resource: config.name,
      recordId,
      event,
      payload,
      tenantId: tenancyVal !== undefined && tenancyVal !== null ? String(tenancyVal) : null,
      status: "pending",
      attempts: 0,
      createdAt: new Date().toISOString(),
    };
  };

  const persistOutboxEntry = async (
    outboxEntry: OutboxRecord,
    tx: DatabaseAdapter<any, any, any>,
    c: Context,
    appContext: AppContext,
    stmts?: any[]
  ) => {
    if (globalConfig?.outbox?.sink) {
      await globalConfig.outbox.sink(outboxEntry, tx, c as any, appContext);
    }
    if (globalConfig?.outbox?.table) {
      const outboxTable = globalConfig.outbox.table;
      const columnNames = tx.getColumnNames(outboxTable);

      let payloadVal: string;
      if (typeof outboxEntry.payload === "string") {
        payloadVal = outboxEntry.payload;
      } else {
        try {
          payloadVal = JSON.stringify(outboxEntry.payload);
        } catch {
          payloadVal = JSON.stringify(outboxEntry.payload, (_k, v) => {
            if (typeof v === "object" && v !== null && (typeof v.toQuery === "function" || v.constructor?.name?.includes("SQL") || v.constructor?.name?.includes("Table"))) {
              return undefined;
            }
            return v;
          });
        }
      }

      const row: Record<string, any> = {
        id: outboxEntry.id,
        resource: outboxEntry.resource,
        event: outboxEntry.event,
        status: outboxEntry.status,
        attempts: outboxEntry.attempts,
      };

      const recordIdVal = typeof outboxEntry.recordId === "object" && outboxEntry.recordId !== null
        ? outboxEntry.recordId
        : String(outboxEntry.recordId);

      if (columnNames.includes("record_id")) row.record_id = recordIdVal;
      else if (columnNames.includes("recordId")) row.recordId = recordIdVal;
      else row.recordId = recordIdVal;

      if (columnNames.includes("payload")) row.payload = payloadVal;

      if (outboxEntry.headers) {
        if (columnNames.includes("headers")) row.headers = JSON.stringify(outboxEntry.headers);
      }

      if (columnNames.includes("tenant_id")) row.tenant_id = outboxEntry.tenantId ?? null;
      else if (columnNames.includes("tenantId")) row.tenantId = outboxEntry.tenantId ?? null;

      if (columnNames.includes("created_at")) row.created_at = outboxEntry.createdAt;
      else if (columnNames.includes("createdAt")) row.createdAt = outboxEntry.createdAt;

      if (stmts) {
        stmts.push(tx.insertStmt(outboxTable, row));
      } else {
        await tx.insert(outboxTable, row);
      }
    }
  };

  const dispatchWebhooks = async (
    outboxEntry: OutboxRecord,
    c: Context,
    appContext: AppContext
  ) => {
    if (globalConfig?.outbox?.autoDispatch === false) {
      return;
    }

    const webhookConfig = globalConfig?.webhooks;
    if (!webhookConfig) {
      return;
    }

    const dispatchPromise = (async () => {
      try {
        let endpoints: WebhookEndpointConfig[] = [];
        if (typeof webhookConfig.endpoints === "function") {
          endpoints = await webhookConfig.endpoints(c as any, appContext);
        } else if (Array.isArray(webhookConfig.endpoints)) {
          endpoints = webhookConfig.endpoints;
        }

        if (!endpoints || endpoints.length === 0) return;

        const matchingEndpoints = endpoints.filter(
          (ep) => !ep.disabled && isWebhookEventMatch(ep.events, outboxEntry.resource, outboxEntry.event)
        );

        if (matchingEndpoints.length === 0) return;

        const adapter = getAdapter(c);
        let allSuccess = true;
        let lastError: string | null = null;
        const currentAttempt = (outboxEntry.attempts ?? 0) + 1;

        for (const ep of matchingEndpoints) {
          if (ep.filter) {
            const allowed = await ep.filter(outboxEntry);
            if (!allowed) continue;
          }

          const delivery = await dispatchSingleWebhook(ep, outboxEntry, {
            fetchFn: webhookConfig.fetch,
          });

          if (webhookConfig.deliverySink) {
            try {
              await webhookConfig.deliverySink(delivery, c as any, appContext);
            } catch (sinkErr) {
              if (globalConfig?.logger?.error) {
                globalConfig.logger.error("Webhook deliverySink error:", sinkErr);
              }
            }
          }

          if (webhookConfig.deliveryTable) {
            try {
              const deliveryTable = webhookConfig.deliveryTable;
              const colNames = adapter.getColumnNames(deliveryTable);
              const deliveryPayload: Record<string, any> = {
                id: delivery.id,
                endpointUrl: delivery.endpointUrl,
                event: delivery.event,
                attempt: delivery.attempt,
                durationMs: delivery.durationMs,
                timestamp: delivery.timestamp,
              };

              if (delivery.outboxId) {
                if (colNames.includes("outbox_id")) deliveryPayload.outbox_id = delivery.outboxId;
                else if (colNames.includes("outboxId")) deliveryPayload.outboxId = delivery.outboxId;
              }

              if (delivery.statusCode !== null && delivery.statusCode !== undefined) {
                if (colNames.includes("status_code")) deliveryPayload.status_code = delivery.statusCode;
                else if (colNames.includes("statusCode")) deliveryPayload.statusCode = delivery.statusCode;
              }

              if (delivery.error) deliveryPayload.error = delivery.error;

              if (delivery.requestHeaders) {
                const hVal = JSON.stringify(delivery.requestHeaders);
                if (colNames.includes("request_headers")) deliveryPayload.request_headers = hVal;
                else if (colNames.includes("requestHeaders")) deliveryPayload.requestHeaders = hVal;
              }

              if (delivery.requestPayload) {
                const pVal = JSON.stringify(delivery.requestPayload);
                if (colNames.includes("request_payload")) deliveryPayload.request_payload = pVal;
                else if (colNames.includes("requestPayload")) deliveryPayload.requestPayload = pVal;
              }

              if (delivery.responseBody) {
                if (colNames.includes("response_body")) deliveryPayload.response_body = delivery.responseBody;
                else if (colNames.includes("responseBody")) deliveryPayload.responseBody = delivery.responseBody;
              }

              await adapter.insert(deliveryTable, deliveryPayload);
            } catch (tableErr) {
              if (globalConfig?.logger?.error) {
                globalConfig.logger.error("Webhook deliveryTable error:", tableErr);
              }
            }
          }

          if (delivery.error || (delivery.statusCode && (delivery.statusCode < 200 || delivery.statusCode >= 300))) {
            allSuccess = false;
            lastError = delivery.error ?? ("HTTP " + delivery.statusCode);
          }
        }

        if (globalConfig?.outbox?.table) {
          try {
            const maxAttempts = webhookConfig.maxAttempts ?? 3;
            const newStatus: OutboxStatus = allSuccess
              ? "delivered"
              : currentAttempt >= maxAttempts
              ? "failed"
              : "pending";

            const nextRetryAt =
              !allSuccess && currentAttempt < maxAttempts
                ? new Date(Date.now() + calculateRetryBackoff(currentAttempt, webhookConfig.retryBackoffMs)).toISOString()
                : null;

            const columnNames = adapter.getColumnNames(globalConfig.outbox.table);
            const mappedUpdate: Record<string, any> = {};
            if (columnNames.includes("status")) mappedUpdate.status = newStatus;
            if (columnNames.includes("attempts")) mappedUpdate.attempts = currentAttempt;
            if (columnNames.includes("last_error")) mappedUpdate.last_error = lastError;
            else if (columnNames.includes("lastError")) mappedUpdate.lastError = lastError;
            if (columnNames.includes("next_retry_at")) mappedUpdate.next_retry_at = nextRetryAt;
            else if (columnNames.includes("nextRetryAt")) mappedUpdate.nextRetryAt = nextRetryAt;
            if (columnNames.includes("updated_at")) mappedUpdate.updated_at = new Date().toISOString();
            else if (columnNames.includes("updatedAt")) mappedUpdate.updatedAt = new Date().toISOString();

            await adapter.update(globalConfig.outbox.table, outboxEntry.id, mappedUpdate);
          } catch (updateErr) {
            if (globalConfig?.logger?.error) {
              globalConfig.logger.error("Webhook outbox status update error:", updateErr);
            }
          }
        }
      } catch (err) {
        if (globalConfig?.logger?.error) {
          globalConfig.logger.error("Webhook dispatch error:", err);
        } else {
          console.error("[HonoCube ERROR] Webhook dispatch error:", err);
        }
      }
    })();

    const mode = webhookConfig.mode ?? "async";
    if (mode === "sync") {
      await dispatchPromise;
    } else {
      const executionCtx = (c as any).executionCtx;
      if (executionCtx && typeof executionCtx.waitUntil === "function") {
        executionCtx.waitUntil(dispatchPromise);
      } else {
        dispatchPromise.catch(() => {});
      }
    }
  };


  // Register parent lock relations if defined
  if (config.workflow?.lockRelations && globalConfig) {
    const locks: any[] = ((globalConfig as any)._workflowLocks = (globalConfig as any)._workflowLocks ?? []);
    for (const item of config.workflow.lockRelations) {
      const relName = typeof item === "string" ? item : item.relation;
      const rel = config.relations?.many?.find(r => r.name === relName);
      if (rel) {
        const editableStates = typeof item === "object" && item.editableStates
          ? item.editableStates
          : (config.workflow.editableStates ?? [config.workflow.initial ?? "draft"]);

        locks.push({
          childTable: rel.table,
          foreignKey: rel.foreignKey,
          parentTable: config.table,
          parentReferenceKey: rel.referenceKey ?? "id",
          parentStatusField: config.workflow.field ?? "status",
          parentInitialStatus: config.workflow.initial ?? "draft",
          editableStates,
        });
      }
    }
  }

  const checkWorkflowParentLock = async (adapter: any, record: any) => {
    if (config.workflow?.parentLock) {
      const pLock = config.workflow.parentLock;
      const parentId = record[pLock.foreignKey];
      if (parentId !== undefined && parentId !== null) {
        const refKey = pLock.referenceKey ?? "id";
        const statusField = pLock.field ?? "status";
        const initialStatus = pLock.initial ?? "draft";
        const editableStates = pLock.editableStates ?? [initialStatus];

        const parentRecord: any = await adapter.findFirst(pLock.table, {
          where: (cols: any, { eq }: any) => eq(cols[refKey], parentId),
        });

        if (parentRecord) {
          const parentStatus = parentRecord[statusField] ?? initialStatus;
          if (!editableStates.includes(parentStatus)) {
            throw new ApiError(
              403,
              "WORKFLOW_LOCKED",
              `Cannot modify or delete record: parent document is in locked state '${parentStatus}'.`,
              { parentStatus, editableStates }
            );
          }
        }
      }
    }

    if (globalConfig) {
      const registeredLocks = ((globalConfig as any)._workflowLocks ?? []).filter(
        (l: any) => l.childTable === config.table
      );
      for (const pLock of registeredLocks) {
        const parentId = record[pLock.foreignKey];
        if (parentId !== undefined && parentId !== null) {
          const refKey = pLock.parentReferenceKey ?? "id";
          const statusField = pLock.parentStatusField ?? "status";
          const initialStatus = pLock.parentInitialStatus ?? "draft";
          const editableStates = pLock.editableStates ?? [initialStatus];

          const parentRecord: any = await adapter.findFirst(pLock.parentTable, {
            where: (cols: any, { eq }: any) => eq(cols[refKey], parentId),
          });

          if (parentRecord) {
            const parentStatus = parentRecord[statusField] ?? initialStatus;
            if (!editableStates.includes(parentStatus)) {
              throw new ApiError(
                403,
                "WORKFLOW_LOCKED",
                `Cannot modify or delete record: parent document is in locked state '${parentStatus}'.`,
                { parentStatus, editableStates }
              );
            }
          }
        }
      }
    }
  };

  /**
   * Resolves the execution strategy to use for a request.
   *
   * The `batch` strategy requires the underlying driver to expose
   * `db.batch()`. Only some Drizzle drivers do — `d1`, `libsql`, `neon-http`
   * and `sqlite-proxy` do; `postgres-js`, `node-postgres`, `mysql2` and
   * `better-sqlite3` do not. On those drivers `tx.batch` is undefined and
   * calling it throws "tx.batch is not a function", so a request would fail
   * with a 500.
   *
   * When the driver cannot batch, we fall back to `transaction`, which is
   * atomic on every driver that supports transactions. This keeps the
   * "all or nothing" guarantee that `batch` provides rather than silently
   * degrading to non-atomic sequential writes.
   *
   * Adapters that do not implement `supportsBatch()` are assumed to support
   * batching, because `batch()` is a required member of the adapter
   * interface.
   */
  const resolveStrategy = (
    adapter: DatabaseAdapter<TTable, TSelect, TInsert>,
    requested?: DatabaseStrategy
  ): DatabaseStrategy => {
    const strategy = requested ?? globalConfig?.strategy ?? DEFAULT_STRATEGY;
    if (strategy !== "batch") return strategy;

    if (adapter.supportsBatch && !adapter.supportsBatch()) {
      return "transaction";
    }
    return "batch";
  };

  // Apply Global App Middleware
  if (globalConfig?.middleware) {
    app.use(...globalConfig.middleware);
  }

  // Apply Local Resource Middleware
  if (config.middleware) {
    app.use(...config.middleware);
  }

  // Idempotency Engine
  const isIdempotencyEnabled =
    config.idempotency?.enabled !== undefined
      ? config.idempotency.enabled
      : globalConfig?.idempotency?.enabled !== undefined
      ? globalConfig.idempotency.enabled
      : Boolean(config.idempotency || globalConfig?.idempotency);

  const idempotencyStorage: IdempotencyStorage =
    config.idempotency?.storage ??
    globalConfig?.idempotency?.storage ??
    new MemoryIdempotencyStorage();

  const idempotencyTtlMs: number =
    config.idempotency?.ttlMs ??
    globalConfig?.idempotency?.ttlMs ??
    86400000; // 24 hours

  if (isIdempotencyEnabled) {
    app.use("*", async (c, next) => {
      const method = c.req.method.toUpperCase();
      if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        return await next();
      }

      const idempotencyKey =
        c.req.header("idempotency-key") || c.req.header("x-idempotency-key");
      if (!idempotencyKey || !idempotencyKey.trim()) {
        return await next();
      }

      const trimmedKey = idempotencyKey.trim();

      // Read raw body without consuming the request stream
      const rawBody = c.req.raw ? await c.req.raw.clone().text() : "";

      let reqPath = c.req.path;
      try {
        const url = new URL(c.req.url);
        if (url.search) reqPath += url.search;
      } catch {
        // fallback to c.req.path
      }

      const fingerprint = await computeFingerprint(method, reqPath, rawBody);

      // Check existing idempotency record
      const existing = await idempotencyStorage.get(trimmedKey);
      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new ApiError(
            422,
            "IDEMPOTENCY_KEY_MISMATCH",
            `Idempotency key '${trimmedKey}' was previously used with a different request payload.`
          );
        }

        if (existing.status === "in_flight") {
          c.header("Retry-After", "1");
          throw new ApiError(
            409,
            "IDEMPOTENCY_KEY_LOCKED",
            `A request with idempotency key '${trimmedKey}' is currently being processed.`,
            undefined,
            { "Retry-After": "1" }
          );
        }

        if (existing.status === "completed" && existing.response) {
          c.header("Idempotent-Replayed", "true");
          if (existing.response.headers) {
            for (const [k, v] of Object.entries(existing.response.headers)) {
              if (k.toLowerCase() !== "content-length") {
                c.header(k, v);
              }
            }
          }
          if (
            existing.response.body === null ||
            existing.response.body === undefined ||
            existing.response.body === ""
          ) {
            return c.body(null, existing.response.status as any);
          }
          return c.json(existing.response.body, existing.response.status as any);
        }
      }

      // Mark in_flight
      await idempotencyStorage.set(
        trimmedKey,
        {
          status: "in_flight",
          fingerprint,
          createdAt: Date.now(),
          expiresAt: Date.now() + idempotencyTtlMs,
        },
        idempotencyTtlMs
      );

      let nextThrew = false;
      try {
        await next();
      } catch (err) {
        nextThrew = true;
        await idempotencyStorage.delete?.(trimmedKey);
        throw err;
      }

      // If handler resulted in a 5xx error, release the lock so caller can retry
      if (c.res && c.res.status >= 500) {
        await idempotencyStorage.delete?.(trimmedKey);
        return;
      }

      // Cache successful or 4xx responses
      if (c.res && !nextThrew) {
        try {
          const resClone = c.res.clone();
          const resText = await resClone.text();
          let body: any;
          try {
            body = JSON.parse(resText);
          } catch {
            body = resText;
          }

          const headers: Record<string, string> = {};
          resClone.headers.forEach((val, key) => {
            if (
              !["content-length", "idempotent-replayed"].includes(
                key.toLowerCase()
              )
            ) {
              headers[key] = val;
            }
          });

          await idempotencyStorage.set(
            trimmedKey,
            {
              status: "completed",
              fingerprint,
              response: {
                status: c.res.status,
                headers,
                body,
              },
              createdAt: Date.now(),
              expiresAt: Date.now() + idempotencyTtlMs,
            },
            idempotencyTtlMs
          );
        } catch (saveErr) {
          globalConfig?.logger?.error?.(
            "Failed to cache idempotent response:",
            saveErr
          );
        }
      }
    });
  }


  const getUserRoles = async (appContext: any): Promise<string[]> => {
    if (globalConfig?.auth?.getRole) {
      const customRole = await globalConfig.auth.getRole(appContext);
      if (customRole == null) return [];
      return Array.isArray(customRole) ? customRole.map(String) : [String(customRole)];
    }

    const roles = new Set<string>();
    const candidates = [
      appContext?.role,
      appContext?.roles,
      appContext?.user?.role,
      appContext?.user?.roles,
      appContext?.member?.role,
      appContext?.member?.roles,
      appContext?.session?.user?.role,
      appContext?.session?.user?.roles,
      appContext?.session?.member?.role,
      appContext?.session?.member?.roles,
    ];

    for (const val of candidates) {
      if (val != null) {
        if (Array.isArray(val)) {
          for (const item of val) {
            if (item != null) roles.add(String(item));
          }
        } else {
          roles.add(String(val));
        }
      }
    }

    return Array.from(roles);
  };

  const evaluateFieldRule = async (
    rule: boolean | string | string[] | ((appContext: any, record?: any) => boolean | Promise<boolean>),
    appContext: any,
    record?: any
  ): Promise<boolean> => {
    if (typeof rule === "boolean") {
      return rule;
    }
    if (typeof rule === "function") {
      return await rule(appContext, record);
    }
    if (Array.isArray(rule)) {
      const userRoles = await getUserRoles(appContext);
      return userRoles.some((r) => rule.includes(r));
    }
    if (typeof rule === "string") {
      if (globalConfig?.auth?.can) {
        return await globalConfig.auth.can(appContext, rule, record);
      }
      const userRoles = await getUserRoles(appContext);
      return userRoles.includes(rule);
    }
    return true;
  };

  const sanitizeWritePayload = async (
    data: any,
    appContext: any,
    existingRecord?: any
  ) => {
    if (!config.fields || typeof data !== "object" || data === null) return data;

    const strategy = config.fieldViolationStrategy ?? "strip";

    for (const [fieldName, rule] of Object.entries(config.fields as Record<string, any>)) {
      if (rule.write !== undefined && fieldName in data) {
        const isAllowed = await evaluateFieldRule(rule.write, appContext, existingRecord);
        if (!isAllowed) {
          if (strategy === "reject") {
            throw new ApiError(
              403,
              "FIELD_FORBIDDEN",
              `Not authorized to modify field '${fieldName}' on '${config.name}'.`
            );
          } else {
            delete data[fieldName];
          }
        }
      }
    }
    return data;
  };
  const generateSeriesNumber = async (
    data: any,
    appContext: any,
    tenancy: any,
    tx: any,
    localSeriesTracker?: Map<string, number>
  ): Promise<string> => {
    if (!config.namingSeries) return "";

    const { field, pattern, counter } = config.namingSeries;

    // 1. Resolve pattern string (supports function or template string)
    const rawPattern = typeof pattern === "function"
      ? await pattern(appContext, data)
      : pattern;

    // 2. Resolve date tokens
    const now = new Date();
    const YYYY = String(now.getFullYear());
    const YY = String(now.getFullYear()).slice(-2);
    const MM = String(now.getMonth() + 1).padStart(2, "0");
    const DD = String(now.getDate()).padStart(2, "0");

    let resolved = rawPattern
      .replace(/\{YYYY\}|\.YYYY\./g, YYYY)
      .replace(/\{YY\}|\.YY\./g, YY)
      .replace(/\{MM\}|\.MM\./g, MM)
      .replace(/\{DD\}|\.DD\./g, DD);

    // 3. Resolve tenant token
    if (resolved.includes("{tenantId}") || resolved.includes(".tenantId.")) {
      const tVal = tenancy?.tenantVal;
      const tenantStr = tVal != null
        ? (Array.isArray(tVal) ? (tVal[0] != null ? String(tVal[0]) : "") : String(tVal))
        : "";
      resolved = resolved
        .replace(/\{tenantId\}/g, tenantStr)
        .replace(/\.tenantId\./g, tenantStr);
    }

    // 4. Resolve record/payload tokens: {field} (skip hash counter placeholders like {#####})
    resolved = resolved.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
      if (/^#+$/.test(key)) return match;
      return data[key] !== undefined && data[key] !== null ? String(data[key]) : "";
    });

    // 5. Match counter token: {#####} or .#####. or ##### or #+
    const counterMatch = resolved.match(/(\.?\{#+\}\.?|\.?#+\.?)/);
    let prefix: string;
    let suffix: string;
    let padLength = 5;

    if (counterMatch && counterMatch.index !== undefined) {
      prefix = resolved.slice(0, counterMatch.index);
      suffix = resolved.slice(counterMatch.index + counterMatch[0].length);
      const hashCount = counterMatch[0].replace(/[^#]/g, "").length;
      if (hashCount > 0) padLength = hashCount;
    } else {
      prefix = resolved;
      suffix = "";
    }

    // 6. Resolve next sequence number
    let nextNum: number;
    const activeCounter = counter ?? globalConfig?.namingSeries?.counter;

    if (activeCounter) {
      const tVal = tenancy?.tenantVal;
      const tenantStr = tVal != null
        ? (Array.isArray(tVal) ? (tVal[0] != null ? String(tVal[0]) : undefined) : String(tVal))
        : undefined;
      nextNum = await activeCounter.getNext(prefix, tenantStr, tx);
    } else if (localSeriesTracker && localSeriesTracker.has(prefix)) {
      nextNum = localSeriesTracker.get(prefix)! + 1;
      localSeriesTracker.set(prefix, nextNum);
    } else {
      const dbAdapter = tx;
      const ops = dbAdapter.getOperators();
      const col = dbAdapter.getColumn(config.table, field);
      const conditions: any[] = [ops.like(col, `${prefix}%`)];

      if (tenancy?.tenantCondition) {
        conditions.push(tenancy.tenantCondition);
      }

      if (config.softDelete) {
        const cols = dbAdapter.getColumns(config.table as any) as any;
        if (cols[config.softDelete]) {
          conditions.push(ops.isNull(cols[config.softDelete]));
        }
      }

      const existing = await dbAdapter.findMany(config.table, {
        where: ops.and(...conditions),
        limit: 1,
        orderBy: { field, direction: "desc" },
      });

      if (existing && existing.length > 0 && existing[0][field]) {
        const rawVal = String(existing[0][field]);
        let numPart = rawVal.startsWith(prefix) ? rawVal.slice(prefix.length) : rawVal;
        if (suffix && numPart.endsWith(suffix)) {
          numPart = numPart.slice(0, -suffix.length);
        }
        const parsedNum = parseInt(numPart, 10);
        nextNum = !isNaN(parsedNum) ? parsedNum + 1 : 1;
      } else {
        nextNum = 1;
      }

      if (localSeriesTracker) {
        localSeriesTracker.set(prefix, nextNum);
      }
    }

    const formattedNumber = String(nextNum).padStart(padLength, "0");
    return `${prefix}${formattedNumber}${suffix}`;
  };

  const finalize = async (
    row: any,
    appContext: any,
    localConfig: any = config,
    c?: Context,
    method: "list" | "detail" = "detail"
  ): Promise<any> => {
    if (!row) return row;
    
    // 1. Handle Array
    if (Array.isArray(row)) {
      return await Promise.all(row.map(r => finalize(r, appContext, localConfig, c, method)));
    }

    const currentConfig = localConfig === config ? config : localConfig;
    const hidden = new Set(currentConfig.hidden as string[] ?? []);
    let out = { ...row };

    // 1.5 Evaluate Computed / Virtual Fields
    const computedConfig = {
      ...(typeof currentConfig.virtualFields === "object" && currentConfig.virtualFields !== null ? currentConfig.virtualFields : {}),
      ...(typeof currentConfig.computed === "object" && currentConfig.computed !== null ? currentConfig.computed : {}),
    };

    if (Object.keys(computedConfig).length > 0) {
      for (const [fieldName, def] of Object.entries(computedConfig as Record<string, any>)) {
        if (!def) continue;
        if (typeof def === "object" && def.methods && Array.isArray(def.methods) && !def.methods.includes(method)) {
          continue;
        }
        try {
          if (typeof def === "function") {
            out[fieldName] = await def(out, c, appContext);
          } else if (typeof def.resolve === "function") {
            try {
              out[fieldName] = await def.resolve(out, c, appContext);
            } catch (err) {
              if ("fallback" in def) {
                out[fieldName] = def.fallback;
              } else {
                if (globalConfig?.logger?.error) {
                  globalConfig.logger.error(`Error computing virtual field '${fieldName}':`, err);
                } else {
                  console.error(`[HonoCube ERROR] Error computing virtual field '${fieldName}':`, err);
                }
                out[fieldName] = null;
              }
            }
          }
        } catch (err) {
          if (typeof def === "object" && "fallback" in def) {
            out[fieldName] = def.fallback;
          } else {
            if (globalConfig?.logger?.error) {
              globalConfig.logger.error(`Error computing virtual field '${fieldName}':`, err);
            } else {
              console.error(`[HonoCube ERROR] Error computing virtual field '${fieldName}':`, err);
            }
            out[fieldName] = null;
          }
        }
      }
    }

    // 2. Hide local fields
    for (const key of hidden) {
      delete out[key];
    }

    // 2.5 Field-Level Access Control (FLAC) on read
    if (currentConfig.fields) {
      for (const [fieldName, rule] of Object.entries(currentConfig.fields as Record<string, any>)) {
        if (rule.read !== undefined && fieldName in out) {
          const isAllowed = await evaluateFieldRule(rule.read, appContext, out);
          if (!isAllowed) {
            if (rule.mask !== undefined) {
              out[fieldName] = typeof rule.mask === "function" ? rule.mask(out[fieldName]) : rule.mask;
            } else {
              delete out[fieldName];
            }
          }
        }
      }
    }

    // 3. Resolve Media URLs
    if (globalConfig?.mediaBaseUrl && currentConfig.uploads) {
       for (const fieldName in currentConfig.uploads) {
         if (out[fieldName] && typeof out[fieldName] === 'string' && !out[fieldName].startsWith('http')) {
           out[fieldName] = `${globalConfig.mediaBaseUrl}${out[fieldName]}`;
         }
       }
    }

    // 4. Recursive check for relations
    if (localConfig.relations) {
      const allRels = [
        ...(localConfig.relations.one ?? []),
        ...(localConfig.relations.many ?? []),
        ...(localConfig.relations.pivots ?? [])
      ];

      for (const rel of allRels) {
        // Ensure we only recurse if the property is actually a relation object/array,
        // and NOT just a simple string URL from an upload field.
        if (out[rel.name] !== undefined && isRecursable(out[rel.name])) {
          out[rel.name] = await finalize(out[rel.name], appContext, rel, c, method);
        }
      }
    }

    // 5. Apply Transformation
    if (localConfig.transform) {
      out = await localConfig.transform(out, appContext);
    }

    return out;
  };

  // Helper to check both permissions and authorize
  const checkAccess = async (
    appContext: any, 
    action: "list" | "detail" | "create" | "update" | "delete" | "batch-update" | "batch-delete" | "import-preview" | "import-execute" | "aggregate", 
    record?: any
  ) => {
    // 0. Check declarative roles (RBAC)
    if (config.roles) {
      let allowedRoles: string[] | undefined = undefined;
      if (Array.isArray(config.roles)) {
        allowedRoles = config.roles;
      } else if (typeof config.roles === "object") {
        allowedRoles = (config.roles as any)[action];
      }

      if (allowedRoles) {
        const userRoles = await getUserRoles(appContext);
        const hasRole = userRoles.some((r) => allowedRoles!.includes(r));
        if (!hasRole) {
          throw new ApiError(
            403,
            "FORBIDDEN",
            `User role is not authorized to perform '${action}' on '${config.name}'.`
          );
        }
      }
    }
    // 1. Check declarative permission string
    const requiredPermission = config.permissions?.[action];
    if (requiredPermission && globalConfig?.auth?.can) {
      const hasPermission = await globalConfig.auth.can(appContext, requiredPermission, record);
      if (!hasPermission) throw ApiError.forbidden();
    } else if (requiredPermission && !globalConfig?.auth?.can) {
      throw ApiError.internal(`Resource requires permission '${requiredPermission}' but 'auth.can' is not configured in createApp.`);
    }

    // 2. Check custom authorize callback (Row-Level Security)
    if (config.authorize) {
      const isAuthorized = await config.authorize(appContext, action, record);
      if (!isAuthorized) throw ApiError.forbidden();
    }
  };

  const getTimestampFields = () => {
    if (!config.timestamps) return null;
    if (typeof config.timestamps === 'boolean') {
      return { created: 'createdAt', updated: 'updatedAt' };
    }
    return {
      created: config.timestamps.createdAt ?? 'createdAt',
      updated: config.timestamps.updatedAt ?? 'updatedAt'
    };
  };

  interface ResolvedTenancyContext {
    isTenancyActive: boolean;
    isBypassed: boolean;
    tenantVal?: TenancyValue;
    tenantField: string;
    tenantCondition?: any;
  }

  const resolveTenancyContext = async (
    c: Context,
    appContext: AppContext,
    adapter: DatabaseAdapter<any, any, any>
  ): Promise<ResolvedTenancyContext> => {
    const isSkipped =
      config.tenancy === false ||
      (typeof config.tenancy === "object" && config.tenancy?.skip === true);

    if (isSkipped || !globalConfig?.tenancy) {
      return {
        isTenancyActive: false,
        isBypassed: true,
        tenantField: "tenantId",
      };
    }

    const tenantField =
      (typeof config.tenancy === "object" && config.tenancy?.field) ||
      globalConfig.tenancy.field ||
      "tenantId";

    let isBypassed = false;
    if (globalConfig.tenancy.bypass) {
      isBypassed = await globalConfig.tenancy.bypass(c, appContext);
    }

    if (isBypassed) {
      return {
        isTenancyActive: true,
        isBypassed: true,
        tenantField,
      };
    }

    const tenantVal = await globalConfig.tenancy.resolve(c, appContext);

    let shouldEnforce = globalConfig.tenancy.enforce ?? true;
    if (typeof shouldEnforce === "function") {
      shouldEnforce = shouldEnforce(c, appContext);
    }

    const isEmpty =
      tenantVal === undefined ||
      tenantVal === null ||
      tenantVal === "" ||
      (Array.isArray(tenantVal) && tenantVal.length === 0);

    if (isEmpty && shouldEnforce) {
      throw new ApiError(
        400,
        "TENANT_REQUIRED",
        globalConfig.tenancy.errorMessage || "Tenant identifier is required."
      );
    }

    let tenantCondition: any = undefined;
    if (!isEmpty) {
      const cols = adapter.getColumns(config.table as any) as any;
      const ops = adapter.getOperators();
      const col = cols[tenantField];
      if (!col) {
        throw new ApiError(
          500,
          "CONFIG_ERROR",
          `Resource '${config.name}' table does not have tenant column '${tenantField}'. Set tenancy: false on the resource to skip tenancy.`
        );
      }
      if (Array.isArray(tenantVal)) {
        if (tenantVal.length === 1) {
          tenantCondition = ops.eq(col, tenantVal[0]);
        } else {
          tenantCondition = ops.inArray(col, tenantVal);
        }
      } else {
        tenantCondition = ops.eq(col, tenantVal);
      }
    }

    return {
      isTenancyActive: true,
      isBypassed: false,
      tenantVal,
      tenantField,
      tenantCondition,
    };
  };

  /**
   * Builds the conditions a row has to satisfy beyond its id: the soft-delete
   * filter and the row-level scope.
   *
   * The read paths apply the same two filters, so a row that does not match
   * them must not be writable either — otherwise a caller could update or
   * delete another user's row simply by guessing its id.
   *
   * The operators and the columns come from the adapter, so the predicate is
   * built with the functions the driver understands.
   */
  /**
   * Resolves the Drizzle 'with' tree for a specific query target:
   * - "list" for GET /
   * - "detail" for GET /:id and mutation reloads
   * - "slug" for GET /:slugField/:value
   *
   * Supports uniform `with: { author: true }`, or scoped `with: { list: false, detail: { ... }, slug: { ... } }`.
   */
  const resolveWith = (target: "list" | "detail" | "slug"): Record<string, any> | undefined => {
    if (!config.with) return undefined;

    const isScoped =
      typeof config.with === "object" &&
      ("list" in config.with || "detail" in config.with || "slug" in config.with);

    if (isScoped) {
      const scoped = config.with as any;
      if (target === "list") {
        return scoped.list === false ? undefined : scoped.list;
      }
      if (target === "slug") {
        if (scoped.slug === false) return undefined;
        if (scoped.slug !== undefined) return scoped.slug;
        return scoped.detail === false ? undefined : scoped.detail;
      }
      if (target === "detail") {
        return scoped.detail === false ? undefined : scoped.detail;
      }
    }

    return config.with as Record<string, any>;
  };

  const buildConstraintConditions = (
    appContext: AppContext,
    adapter: DatabaseAdapter<any, any, any>,
    tenantCondition?: any
  ) => {
    const cols = adapter.getColumns(config.table as any) as any;
    const ops = adapter.getOperators();
    const conditions: any[] = [];

    if (tenantCondition) {
      conditions.push(tenantCondition);
    }

    if (config.softDelete) {
      conditions.push(ops.isNull(cols[config.softDelete]));
    }

    if (config.scope) {
      const scoped = config.scope(cols, ops, appContext);
      if (scoped) conditions.push(scoped);
    }

    return conditions;
  };

  /**
   * Builds the predicate a single-record write has to satisfy: the row's id,
   * plus the soft-delete filter and the row-level scope.
   */
  const buildRecordPredicate = (
    id: string | number,
    appContext: AppContext,
    adapter: DatabaseAdapter<any, any, any>,
    tenantCondition?: any
  ) => {
    const cols = adapter.getColumns(config.table as any) as any;
    const ops = adapter.getOperators();
    const conditions: any[] = [
      ops.eq(cols.id, id as any),
      ...buildConstraintConditions(appContext, adapter, tenantCondition),
    ];

    return conditions.length > 1 ? ops.and(...conditions) : conditions[0];
  };

  const syncRelations = async (
    tx: any,
    relConfig: any,
    parentId: any,
    incomingChildren: any[],
    isPivot: boolean
  ) => {
    const stmts: any[] = [];
    const relStrategy = relConfig.strategy ?? "replace";
    const ops = tx.getOperators();

    if (relStrategy === "replace") {
      stmts.push(tx.getDb().delete(relConfig.table).where(ops.eq(tx.getColumn(relConfig.table, relConfig.foreignKey), parentId)));
      for (const child of incomingChildren) {
        stmts.push(tx.insertStmt(relConfig.table, { ...child, [relConfig.foreignKey]: parentId }));
      }
    } else if (relStrategy === "append") {
      for (const child of incomingChildren) {
        stmts.push(tx.insertStmt(relConfig.table, { ...child, [relConfig.foreignKey]: parentId }));
      }
    } else if (relStrategy === "upsert") {
      let lookupBy = relConfig.lookupBy;
      if (!lookupBy && isPivot) lookupBy = relConfig.referenceKey;
      if (!lookupBy) lookupBy = "id";

      const existingChildren = await tx.getDb().select().from(relConfig.table).where(ops.eq(tx.getColumn(relConfig.table, relConfig.foreignKey), parentId));

      const findExisting = (row: any) => {
        return existingChildren.find((er: any) => {
          if (typeof lookupBy === 'string') return er[lookupBy] === row[lookupBy];
          if (Array.isArray(lookupBy) && typeof lookupBy[0] === 'string') return (lookupBy as string[]).every(k => er[k] === row[k]);
          if (Array.isArray(lookupBy) && Array.isArray(lookupBy[0])) return (lookupBy as string[][]).some(keys => keys.every(k => er[k] === row[k]));
          return false;
        });
      };

      const cCols = tx.getColumns(relConfig.table) as any;

      for (const child of incomingChildren) {
        const existing = findExisting(child);
        if (existing) {
          let updateStmt: any = tx.getDb().update(relConfig.table).set(child);
          if (cCols.id) {
             updateStmt = updateStmt.where(ops.eq(cCols.id, existing.id));
          } else {
             if (typeof lookupBy === 'string') updateStmt = updateStmt.where(ops.and(ops.eq(cCols[relConfig.foreignKey], parentId), ops.eq(cCols[lookupBy], existing[lookupBy])));
             else if (Array.isArray(lookupBy) && typeof lookupBy[0] === 'string') {
                updateStmt = updateStmt.where(ops.and(ops.eq(cCols[relConfig.foreignKey], parentId), ...((lookupBy as string[]).map(k => ops.eq(cCols[k], existing[k])))));
             }
          }
          stmts.push(updateStmt);
        } else {
          stmts.push(tx.insertStmt(relConfig.table, { ...child, [relConfig.foreignKey]: parentId }));
        }
      }
    }
    return stmts;
  };

  const emitEvent = async (appContext: any, type: any, data?: any, ids?: (string | number)[]) => {
    if (globalConfig?.onEvent) {
      await globalConfig.onEvent({
        type,
        resource: config.name,
        data,
        ids,
        appContext
      });
    }
  };

  /**
   * Builds the cache key for a response, or returns `null` when the response
   * must not be cached.
   *
   * The key has to identify the caller. `scope` and `transform` both depend
   * on the app context, so two callers sending the same query can be owed
   * different rows — a key without a caller dimension hands the first
   * caller's response to the second one.
   *
   * The caller dimension comes from `cache.keyBy`. When it is missing, or
   * when it returns nothing for this caller, the response is served from the
   * database and nothing is read from or written to the cache — sharing one
   * key between callers would leak rows between them.
   */
  const getCacheKey = (
    c: Context,
    type: string,
    id: string | number | undefined,
    appContext: AppContext,
    tenantVal?: TenancyValue,
    isBypassed?: boolean
  ): string | null => {
    if (!config.cache?.enabled || !globalConfig?.cache) return null;

    const keyBy = config.cache.keyBy;
    if (!keyBy) return null;

    const caller = keyBy(appContext, c.req.query());
    if (caller === undefined || caller === null || caller === '') return null;

    const queryStr = new URL(c.req.url).search;
    let tenantSegment = '';
    const isSkipped = config.tenancy === false || (typeof config.tenancy === "object" && config.tenancy?.skip === true);
    if (globalConfig?.tenancy && !isSkipped) {
      if (isBypassed) {
        tenantSegment = ':tenant:bypass';
      } else if (tenantVal !== undefined && tenantVal !== null) {
        const valStr = Array.isArray(tenantVal) ? [...tenantVal].map(String).sort().join(',') : String(tenantVal);
        tenantSegment = `:tenant:${valStr}`;
      }
    }
    return `res:${config.name}:${type}${id ? `:${id}` : ''}${tenantSegment}:${caller}:${queryStr}`;
  };

  const invalidateCache = async () => {
    if (globalConfig?.cache && config.cache?.enabled) {
      await globalConfig.cache.clear(`res:${config.name}:`);
    }
  };

  const globalDefaultRateLimitStore = new MemoryRateLimitStore();

  const checkRateLimit = async (c: Context, appContext: any) => {
    const rateLimitConfig = config.rateLimit ?? globalConfig?.rateLimit;
    if (!rateLimitConfig) return;

    const limit = rateLimitConfig.limit;
    const windowMs = rateLimitConfig.windowMs ?? parseWindow(rateLimitConfig.window);
    const keyFn = rateLimitConfig.keyGenerator ?? rateLimitConfig.key;
    const key = keyFn
      ? await keyFn(c as any, appContext)
      : `${c.req.path}:${c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'anon'}`;

    // Legacy RateLimiter support (where user passed rateLimiter with only .check and no store):
    if (globalConfig?.rateLimiter && !rateLimitConfig.store && !("increment" in globalConfig.rateLimiter)) {
      const allowed = await globalConfig.rateLimiter.check(key, limit, rateLimitConfig.window ?? `${windowMs}ms`);
      if (!allowed) throw ApiError.tooManyRequests();
      return;
    }

    const store: RateLimitStore =
      rateLimitConfig.store ??
      (globalConfig?.rateLimiter && "increment" in globalConfig.rateLimiter ? (globalConfig.rateLimiter as any) : undefined) ??
      globalDefaultRateLimitStore;

    const cost = rateLimitConfig.cost ? rateLimitConfig.cost(c as any) : 1;
    const result = await store.increment(key, cost, limit, windowMs);

    c.header("RateLimit-Limit", String(result.limit));
    c.header("RateLimit-Remaining", String(result.remaining));
    c.header("RateLimit-Reset", String(result.reset));

    if (!result.allowed) {
      const retryAfter = result.retryAfter ?? result.reset;
      c.header("Retry-After", String(retryAfter));
      throw new ApiError(
        429,
        "TOO_MANY_REQUESTS",
        "Too Many Requests",
        undefined,
        {
          "Retry-After": String(retryAfter),
          "RateLimit-Limit": String(result.limit),
          "RateLimit-Remaining": "0",
          "RateLimit-Reset": String(result.reset),
        }
      );
    }
  };

  /**
   * Helper to process file uploads in payload
   */
  const processUploads = async (data: any, localConfig: any = config): Promise<any> => {
    if (!data) return data;

    // 1. Handle Array (for Many relations)
    if (Array.isArray(data)) {
      return await Promise.all(data.map(item => processUploads(item, localConfig)));
    }

    // Only a container can carry upload fields and relations. A string, a
    // number or a boolean is returned unchanged instead of being spread into
    // an object.
    if (!isRecursable(data)) return data;

    const out = { ...data };

    // 2. Handle Local Uploads
    if (localConfig.uploads && globalConfig?.storage) {
      for (const fieldName in localConfig.uploads) {
        const val = out[fieldName];
        const uploadConfig = localConfig.uploads[fieldName];

        // Is it a single file?
        if (val && typeof val === 'object' && (val instanceof Blob || val.constructor?.name === 'File' || (val as any).name && (val as any).type)) {
           const path = await globalConfig.storage.upload(val, { 
             folder: uploadConfig.folder,
             name: (val as any).name || `file_${Date.now()}`
           });
           out[fieldName] = path;
        } 
        // Is it an array of files?
        else if (Array.isArray(val)) {
          const uploadedPaths = [];
          for (const item of val) {
             if (item && typeof item === 'object' && (item instanceof Blob || item.constructor?.name === 'File' || (item as any).name)) {
                const path = await globalConfig.storage.upload(item, { 
                  folder: uploadConfig.folder,
                  name: (item as any).name || `file_${Date.now()}`
                });
                uploadedPaths.push(path);
             } else {
                uploadedPaths.push(item);
             }
          }
          out[fieldName] = uploadedPaths;
        }
      }
    }

    // 3. Recursive check for relations
    if (localConfig.relations) {
      const allRels = [
        ...(localConfig.relations.one ?? []),
        ...(localConfig.relations.many ?? []),
        ...(localConfig.relations.pivots ?? [])
      ];

      for (const rel of allRels) {
        // Ensure we only recurse if the property is actually a relation object/array,
        // and NOT just a simple string URL from an upload field.
        if (out[rel.name] !== undefined && isRecursable(out[rel.name])) {
          out[rel.name] = await processUploads(out[rel.name], rel);
        }
      }
    }

    return out;
  };

  if (methods.has("list")) {
    app.get("/", async (c) => {
      const adapter = getAdapter(c);
      const appContext = (globalConfig?.getContext ? await globalConfig.getContext(c) : {}) as AppContext;

      await checkRateLimit(c, appContext);
      await checkAccess(appContext, "list");

      const tenancy = await resolveTenancyContext(c, appContext, adapter);

      // 0. Cache Check
      const cacheKey = getCacheKey(c, "list", undefined, appContext, tenancy.tenantVal, tenancy.isBypassed);
      if (cacheKey) {
        const cached = await globalConfig!.cache!.get(cacheKey);
        if (cached) return c.json(cached);
      }

      if (config.hooks?.beforeFetch) {
        await config.hooks.beforeFetch(c, { list: true }, appContext);
      }

      const queryParams = c.req.query();
      const maxLimit = config.pagination?.maxLimit ?? 100;
      const requestedLimit = parseLimit(queryParams.limit, maxLimit);
      const limit = Math.min(requestedLimit ?? config.pagination?.defaultLimit ?? 20, maxLimit);

      const rawCursor = queryParams.cursor || queryParams.after || queryParams.before;
      const paginationType = config.pagination?.type ?? "both";

      if (paginationType === "cursor" && queryParams.page !== undefined && !rawCursor) {
        throw new ApiError(
          400,
          "PAGINATION_TYPE_MISMATCH",
          `Resource '${config.name}' is configured for cursor-based pagination only. Use 'cursor', 'after', or 'before' instead of 'page'.`
        );
      }

      if (paginationType === "offset" && rawCursor) {
        throw new ApiError(
          400,
          "PAGINATION_TYPE_MISMATCH",
          `Resource '${config.name}' is configured for offset-based pagination only. Use 'page' instead of 'cursor'.`
        );
      }

      const isCursorRequest = Boolean(rawCursor) || Boolean(queryParams.direction) || (paginationType === "cursor" && queryParams.page === undefined);

      let direction: "next" | "prev" = "next";
      if (queryParams.before) {
        direction = "prev";
      } else if (queryParams.after) {
        direction = "next";
      } else if (queryParams.direction?.toLowerCase() === "prev") {
        direction = "prev";
      }

      let cursorObj: Record<string, any> | undefined = undefined;
      if (rawCursor) {
        try {
          const jsonStr = fromBase64Url(rawCursor);
          const parsed = JSON.parse(jsonStr);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("Invalid format");
          }
          cursorObj = parsed;
        } catch {
          throw new ApiError(
            400,
            "INVALID_CURSOR",
            "The provided pagination cursor is invalid or malformed."
          );
        }
      }

      let page: number | undefined = undefined;
      let offset: number | undefined = undefined;

      if (!rawCursor && paginationType !== "cursor") {
        page = parsePage(queryParams.page) ?? 1;
        offset = (page - 1) * limit;
        if (!Number.isSafeInteger(offset)) {
          throw new ApiError(
            400,
            "INVALID_PAGINATION",
            `Invalid 'page': the resulting offset is not a valid number.`,
            { page: queryParams.page, limit }
          );
        }
      }

      const defaultSortConfig = config.defaultSort
        ? (Array.isArray(config.defaultSort) ? config.defaultSort[0] : config.defaultSort)
        : undefined;

      const cursorCol = config.pagination?.cursorColumn;
      const sortField: string = queryParams.sort || defaultSortConfig?.field || cursorCol || "id";
      const sortDirection: "asc" | "desc" = queryParams.order?.toLowerCase() === "asc"
        ? "asc"
        : (defaultSortConfig?.direction ?? "desc");

      const isComposite = sortField !== "id";

      let sqlOrderBy: any;
      if (isCursorRequest) {
        if (direction === "next") {
          sqlOrderBy = isComposite
            ? [{ field: sortField, direction: sortDirection }, { field: "id", direction: sortDirection }]
            : [{ field: "id", direction: sortDirection }];
        } else {
          const invDirection: "asc" | "desc" = sortDirection === "desc" ? "asc" : "desc";
          sqlOrderBy = isComposite
            ? [{ field: sortField, direction: invDirection }, { field: "id", direction: invDirection }]
            : [{ field: "id", direction: invDirection }];
        }
      } else {
        sqlOrderBy = config.defaultSort ?? { field: 'id', direction: 'desc' };
      }

      const q = queryParams.q;

      // 1. Resolve 'with' object (Explicit only)
      const withTree = resolveWith("list");

      // 2. Build Search Subqueries
      const searchSubqueries: any[] = [];

      if (q && config.search) {
        const ops = adapter.getOperators();

        // Search local fields
        if (config.search.fields) {
          const searchConds = [ops.or(...config.search.fields.map(f => ops.like(adapter.getColumn(config.table as any, f as string), `%${q}%`)))];
          if (tenancy.tenantCondition) {
            searchConds.push(tenancy.tenantCondition);
          }
          const localSubquery = adapter.getDb()
            .select({ id: adapter.getColumn(config.table as any, 'id') })
            .from(config.table)
            .where(ops.and(...searchConds));
          searchSubqueries.push(localSubquery);
        }

        // Search relations
        if (config.search.relations) {
          for (const relName of config.search.relations) {
            // Check 'one' relations
            const oneRel = config.relations?.one?.find(r => r.name === relName);
            if (oneRel && oneRel.search) {
              const relSubquery = adapter.getDb()
                .select({ parentId: adapter.getColumn(config.table as any, oneRel.foreignKey) })
                .from(config.table)
                .innerJoin(oneRel.table, ops.eq(adapter.getColumn(oneRel.table, oneRel.referenceKey), adapter.getColumn(config.table as any, oneRel.foreignKey)))
                .where(ops.or(...oneRel.search.map(f => ops.like(adapter.getColumn(oneRel.table, f as string), `%${q}%`))));
              searchSubqueries.push(relSubquery);
            }

            // Check 'many' relations
            const manyRel = config.relations?.many?.find(r => r.name === relName);
            if (manyRel && manyRel.search) {
              const relSubquery = adapter.getDb()
                .select({ parentId: adapter.getColumn(manyRel.table, manyRel.foreignKey) })
                .from(manyRel.table)
                .where(ops.or(...manyRel.search.map(f => ops.like(adapter.getColumn(manyRel.table, f as string), `%${q}%`))));
              searchSubqueries.push(relSubquery);
            }

            // Check 'pivot' relations
            const pivotRel = config.relations?.pivots?.find(r => r.name === relName);
            if (pivotRel && pivotRel.search && pivotRel.targetTable) {
              const relSubquery = adapter.getDb()
                .select({ parentId: adapter.getColumn(pivotRel.table, pivotRel.foreignKey) })
                .from(pivotRel.table)
                .innerJoin(pivotRel.targetTable, ops.eq(adapter.getColumn(pivotRel.targetTable, pivotRel.targetReferenceKey), adapter.getColumn(pivotRel.table, pivotRel.referenceKey)))
                .where(ops.or(...pivotRel.search.map(f => ops.like(adapter.getColumn(pivotRel.targetTable, f as string), `%${q}%`))));
              searchSubqueries.push(relSubquery);
            }
          }
        }
      }

      const baseWhere = (cols: any, ops: any) => {
        const { and, eq, like, gt, gte, lt, lte, isNull, or } = ops;
        const conditions: any[] = [];

        // Apply Tenancy Condition
        if (tenancy.tenantCondition) {
          conditions.push(tenancy.tenantCondition);
        }

        // Apply Soft Delete (Mandatory)
        if (config.softDelete) {
          conditions.push(isNull(cols[config.softDelete]));
        }

        // Apply Scope (Mandatory)
        if (config.scope) {
          const scoped = config.scope(cols, ops, appContext);
          if (scoped) conditions.push(scoped);
        }

        // Apply Search (via Subqueries to avoid parameter limits)
        if (searchSubqueries.length > 0) {
          const sqlTag = adapter.getSql();
          conditions.push(or(...searchSubqueries.map(sq => sqlTag`${cols.id} IN (${sq})`)));
        } else if (q && config.search) {
          conditions.push(eq(cols.id, -1));
        }

        // Direct Filters
        const allowedFilters = config.filter?.allow || [];
        for (const [key, value] of Object.entries(queryParams)) {
          if (['limit', 'page', 'q', 'sort', 'order', 'cursor', 'after', 'before', 'direction'].includes(key)) continue;
          if (value === "" || value == null) continue;

          const rangeMatch = key.match(/^(.+)__(gte|lte|gt|lt|like)$/);
          let field: string = key;
          let op = eq;

          if (rangeMatch) {
            const [, f, suffix] = rangeMatch;
            field = f!;
            if (suffix === 'gte') op = gte;
            else if (suffix === 'lte') op = lte;
            else if (suffix === 'gt') op = gt;
            else if (suffix === 'lt') op = lt;
            else if (suffix === 'like') op = like;
          }

          if (allowedFilters.length > 0 && !allowedFilters.includes(field as string)) {
             continue;
          }

          if (cols[field]) {
            const finalValue = op === like ? `%${value}%` : value;
            conditions.push(op(cols[field], finalValue));
          }
        }

        return conditions.length > 0 ? and(...conditions) : undefined;
      };

      const dataWhere = (cols: any, ops: any) => {
        const base = baseWhere(cols, ops);
        if (!cursorObj) return base;

        const isForward = direction === "next";
        const isDesc = sortDirection === "desc";
        let keysetCond: any;

        if (!isComposite) {
          const cursorId = cursorObj.id;
          if (cursorId == null) {
            throw new ApiError(400, "INVALID_CURSOR", "Cursor is missing required 'id' field.");
          }
          if (isForward) {
            keysetCond = isDesc ? ops.lt(cols.id, cursorId) : ops.gt(cols.id, cursorId);
          } else {
            keysetCond = isDesc ? ops.gt(cols.id, cursorId) : ops.lt(cols.id, cursorId);
          }
        } else {
          const cursorVal = cursorObj[sortField];
          const cursorId = cursorObj.id;
          if (cursorVal === undefined || cursorId == null) {
            throw new ApiError(400, "INVALID_CURSOR", `Cursor is missing required '${sortField}' or 'id' field.`);
          }

          if (isForward) {
            keysetCond = isDesc
              ? ops.or(
                  ops.lt(cols[sortField], cursorVal),
                  ops.and(ops.eq(cols[sortField], cursorVal), ops.lt(cols.id, cursorId))
                )
              : ops.or(
                  ops.gt(cols[sortField], cursorVal),
                  ops.and(ops.eq(cols[sortField], cursorVal), ops.gt(cols.id, cursorId))
                );
          } else {
            keysetCond = isDesc
              ? ops.or(
                  ops.gt(cols[sortField], cursorVal),
                  ops.and(ops.eq(cols[sortField], cursorVal), ops.gt(cols.id, cursorId))
                )
              : ops.or(
                  ops.lt(cols[sortField], cursorVal),
                  ops.and(ops.eq(cols[sortField], cursorVal), ops.lt(cols.id, cursorId))
                );
          }
        }

        return base ? ops.and(base, keysetCond) : keysetCond;
      };

      const queryKey = config.queryKey ?? config.name;
      const fetchLimit = isCursorRequest ? limit + 1 : limit;

      const [rawRows, total] = await Promise.all([
        adapter.findMany(config.table, {
          limit: fetchLimit,
          offset,
          orderBy: sqlOrderBy,
          where: cursorObj ? dataWhere : baseWhere,
          with: withTree,
          queryKey
        }),
        adapter.count(config.table, baseWhere)
      ]);

      let hasNext = false;
      let hasPrev = false;
      let pageRows: any[] = rawRows;

      if (isCursorRequest) {
        const hasExtra = rawRows.length > limit;
        pageRows = hasExtra ? rawRows.slice(0, limit) : rawRows;

        if (direction === "next") {
          hasNext = hasExtra;
          hasPrev = Boolean(rawCursor);
        } else {
          hasPrev = hasExtra;
          hasNext = true;
          pageRows.reverse();
        }
      } else {
        const curPage = page ?? 1;
        hasPrev = curPage > 1;
        hasNext = (curPage * limit) < total;
      }

      let resultRows = pageRows;
      if (config.hooks?.afterFetch) {
        resultRows = await config.hooks.afterFetch(pageRows as TSelect[], c, appContext);
      }

      const encodeCursor = (record: any) => {
        const payload: Record<string, any> = { id: record.id };
        if (isComposite && record[sortField] !== undefined) {
          payload[sortField] = record[sortField];
        }
        return toBase64Url(JSON.stringify(payload));
      };

      const nextCursor = (hasNext && resultRows.length > 0)
        ? encodeCursor(resultRows[resultRows.length - 1])
        : null;

      const prevCursor = (hasPrev && resultRows.length > 0)
        ? encodeCursor(resultRows[0])
        : null;

      const includeCursorMeta = Boolean(rawCursor) || Boolean(queryParams.direction) || paginationType === "cursor";
      const includeOffsetMeta = page !== undefined && paginationType !== "cursor" && !rawCursor;
      const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

      const meta: Record<string, any> = {
        total,
        ...(includeOffsetMeta ? { page, limit, totalPages } : { limit }),
        ...(includeCursorMeta ? {
          nextCursor,
          prevCursor,
          hasNext,
          hasPrev
        } : {})
      };

      const response = {
        success: true,
        data: await Promise.all(resultRows.map(r => finalize(r, appContext, config, c, "list"))),
        meta
      };

      if (cacheKey) {
        await globalConfig!.cache!.set(cacheKey, response, config.cache?.ttl);
      }

      return c.json(response);
    });
  }

  const runTransaction = async <T>(c: Context, cb: (tx: DatabaseAdapter<TTable, TSelect, TInsert>) => Promise<T>): Promise<T> => {
    const adapter = getAdapter(c) as DatabaseAdapter<TTable, TSelect, TInsert>;
    const strategy = resolveStrategy(adapter);

    if (strategy === "transaction") {
      return await adapter.transaction(cb);
    } else if (strategy === "none" || strategy === "batch") {
      // For batch, we don't wrap in a transaction here because the inner logic
      // will call tx.batch() which handles atomicity.
      return await cb(adapter);
    } else {
      return await adapter.transaction(cb);
    }
  };

  if (methods.has("batch-update")) {
    app.patch("/batch-update", async (c) => {
      // Resolve the adapter early, so a missing one is reported before any
      // work is done.
      const adapter = getAdapter(c);
      const appContext = (globalConfig?.getContext ? await globalConfig.getContext(c) : {}) as AppContext;
      await checkRateLimit(c, appContext);
      await checkAccess(appContext, "batch-update");

      const tenancy = await resolveTenancyContext(c, appContext, adapter);

      const hasParentLockConfigured = !!(
        config.workflow?.parentLock ||
        ((globalConfig as any)?._workflowLocks?.some((l: any) => l.childTable === config.table))
      );

      const body = await c.req.json();
      const parsed = parseBatchUpdateBody(body);
      let targetIds = parsed.ids;
      let updateData = parsed.data;

      if (hasParentLockConfigured && targetIds.length > 0) {
        const existingRecords: any[] = await adapter.findMany(config.table, {
          where: (cols: any, { inArray }: any) => inArray(cols.id, targetIds),
        }) as any[];
        for (const rec of existingRecords) {
          await checkWorkflowParentLock(adapter, rec);
        }
      }

      // Sanitize write payload (FLAC)
      updateData = await sanitizeWritePayload(updateData, appContext);

      // Prevent tenant-hopping
      if (!tenancy.isBypassed && tenancy.isTenancyActive && tenancy.tenantField in updateData) {
        const attemptedTenant = updateData[tenancy.tenantField];
        if (attemptedTenant !== undefined) {
          if (Array.isArray(tenancy.tenantVal)) {
            if (!tenancy.tenantVal.includes(attemptedTenant)) {
              throw new ApiError(403, "TENANT_IMMUTABLE", "Cannot change tenant identifier.");
            }
          } else if (attemptedTenant !== tenancy.tenantVal) {
            throw new ApiError(403, "TENANT_IMMUTABLE", "Cannot change tenant identifier.");
          }
        }
        delete updateData[tenancy.tenantField];
      }

      // Validate data payload
      const { update: validator } = resolveValidators(config.validator);
      const validatedData = await validateWith(validator, updateData);

      // Strip tenant field from validatedData if not bypassed
      if (!tenancy.isBypassed && tenancy.isTenancyActive && tenancy.tenantField in validatedData) {
        delete validatedData[tenancy.tenantField];
      }

      // Auto Timestamps
      const ts = getTimestampFields();
      if (ts && ts.updated) {
        validatedData[ts.updated] = new Date().toISOString();
      }

      let batchUpdateOutboxEntry: OutboxRecord | undefined;
      const record = await runTransaction(c, async (tx) => {
        const stmts: any[] = [];
        // Apply Batch Hook
        if (config.hooks?.beforeBatchUpdate) {
          const hooked = await config.hooks.beforeBatchUpdate(targetIds, validatedData, c, tx, appContext, stmts);
          if (hooked) {
            targetIds = hooked.ids;
            updateData = hooked.data;
          }
        }

        if (targetIds.length === 0) return 0; // Hook rejected all IDs
        if (Object.keys(validatedData).length === 0) return targetIds.length; // No fields to update (stripped or empty)

        // Apply mandatory scope
        let scopedWhere;
        const cols = tx.getColumns(config.table as any) as any;
        const ops = tx.getOperators();
        if (config.scope) {
          scopedWhere = config.scope(cols, ops, appContext);
        }

        // Execute bulk update
        const idCol = cols.id;
        const conditions: any[] = [ops.inArray(idCol, targetIds)];

        if (tenancy.tenantCondition) {
          conditions.push(tenancy.tenantCondition);
        }

        if (scopedWhere) {
          conditions.push(scopedWhere);
        }

        if (config.softDelete) {
           conditions.push(ops.isNull(cols[config.softDelete]));
        }

        const result: any = await tx.getDb().update(config.table).set(validatedData).where(ops.and(...conditions));
        
        // Handle different driver result formats
        const updatedCount = result.changes ?? result.rowCount ?? targetIds.length;

        if (shouldRecordOutboxEvent("batch-update")) {
          batchUpdateOutboxEntry = createOutboxEntry(
            "batch-update",
            targetIds.join(","),
            { ids: targetIds, data: validatedData, tenantId: tenancy.isTenancyActive ? tenancy.tenantVal : null },
            tenancy.isTenancyActive ? tenancy.tenantVal : null
          );
          await persistOutboxEntry(batchUpdateOutboxEntry, tx, c, appContext);
        }

        if (config.hooks?.afterBatchUpdate) {
          await config.hooks.afterBatchUpdate(targetIds, c, tx, appContext);
        }

        return updatedCount;
      });

      if (batchUpdateOutboxEntry) {
        await dispatchWebhooks(batchUpdateOutboxEntry, c, appContext);
      }

      await emitEvent(appContext, "batch-update", validatedData, targetIds);
      await invalidateCache();

      if (shouldAuditAction("batch-update")) {
        const actorId = await resolveActorId(c, appContext);
        for (const targetId of targetIds) {
          await dispatchAudit({
            resource: config.name,
            recordId: targetId,
            action: "batch-update",
            actorId,
            tenantId: tenancy.isTenancyActive ? String(tenancy.tenantVal) : null,
            diff: computeFieldDiff(null, validatedData, auditExcludeFields, auditMaskFields, auditMaskString),
            newData: auditConfigObj?.includeSnapshots ? sanitizeAuditSnapshot(validatedData, auditExcludeFields, auditMaskFields, auditMaskString) : null,
            ip: getClientIp(c),
            userAgent: getUserAgent(c),
            timestamp: new Date().toISOString(),
          }, c, appContext);
        }
      }

      return c.json({ success: true, updated: record });
    });
  }

  if (methods.has("batch-delete")) {
    app.post("/batch-delete", async (c) => {
      // Resolve the adapter early, so a missing one is reported before any
      // work is done.
      const adapter = getAdapter(c);
      const appContext = (globalConfig?.getContext ? await globalConfig.getContext(c) : {}) as AppContext;
      await checkRateLimit(c, appContext);
      await checkAccess(appContext, "batch-delete");

      const tenancy = await resolveTenancyContext(c, appContext, adapter);

      const hasParentLockForDelete = !!(
        config.workflow?.parentLock ||
        ((globalConfig as any)?._workflowLocks?.some((l: any) => l.childTable === config.table))
      );

      const body = await c.req.json();
      const parsed = parseBatchDeleteBody(body);
      let targetIds = parsed.ids;

      if (hasParentLockForDelete && targetIds.length > 0) {
        const existingRecords: any[] = await adapter.findMany(config.table, {
          where: (cols: any, { inArray }: any) => inArray(cols.id, targetIds),
        }) as any[];
        for (const rec of existingRecords) {
          await checkWorkflowParentLock(adapter, rec);
        }
      }

      let batchDeleteOutboxEntry: OutboxRecord | undefined;
      await runTransaction(c, async (tx) => {
        const stmts: any[] = [];
        // Apply Batch Hook
        if (config.hooks?.beforeBatchDelete) {
          const hookedIds = await config.hooks.beforeBatchDelete(targetIds, c, tx, appContext, stmts);
          if (hookedIds) targetIds = hookedIds;
        }

        if (targetIds.length === 0) return 0; // Hook rejected all IDs

        // Apply mandatory scope
        let scopedWhere;
        const cols = tx.getColumns(config.table as any) as any;
        const ops = tx.getOperators();
        if (config.scope) {
          scopedWhere = config.scope(cols, ops, appContext);
        }

        const idCol = cols.id;
        const conditions: any[] = [ops.inArray(idCol, targetIds)];

        if (tenancy.tenantCondition) {
          conditions.push(tenancy.tenantCondition);
        }

        if (scopedWhere) {
          conditions.push(scopedWhere);
        }

        if (shouldRecordOutboxEvent("batch-delete")) {
          batchDeleteOutboxEntry = createOutboxEntry(
            "batch-delete",
            targetIds.join(","),
            { ids: targetIds, tenantId: tenancy.isTenancyActive ? tenancy.tenantVal : null },
            tenancy.isTenancyActive ? tenancy.tenantVal : null
          );
          await persistOutboxEntry(batchDeleteOutboxEntry, tx, c, appContext);
        }

        // A row that is already soft-deleted is not deleted again.
        if (config.softDelete) {
          conditions.push(ops.isNull(cols[config.softDelete]));
          await tx.getDb().update(config.table).set({ [config.softDelete]: new Date().toISOString() }).where(ops.and(...conditions));
        } else {
          await tx.getDb().delete(config.table).where(ops.and(...conditions));
        }

        if (config.hooks?.afterBatchDelete) {
          await config.hooks.afterBatchDelete(targetIds, c, tx, appContext);
        }

        return targetIds.length;
      });

      if (batchDeleteOutboxEntry) {
        await dispatchWebhooks(batchDeleteOutboxEntry, c, appContext);
      }

      await emitEvent(appContext, "batch-delete", undefined, targetIds);
      await invalidateCache();

      if (shouldAuditAction("batch-delete")) {
        const actorId = await resolveActorId(c, appContext);
        for (const targetId of targetIds) {
          await dispatchAudit({
            resource: config.name,
            recordId: targetId,
            action: "batch-delete",
            actorId,
            tenantId: tenancy.isTenancyActive ? String(tenancy.tenantVal) : null,
            diff: [],
            ip: getClientIp(c),
            userAgent: getUserAgent(c),
            timestamp: new Date().toISOString(),
          }, c, appContext);
        }
      }

      return c.json({ success: true, deleted: targetIds.length });
    });
  }


function buildDateBucketSql(
  dialect: "postgresql" | "mysql" | "sqlite",
  sqlTag: any,
  column: any,
  interval: "year" | "month" | "day" | "week" | "hour"
) {
  if (dialect === "postgresql") {
    switch (interval) {
      case "year":
        return sqlTag`to_char(${column}, 'YYYY')`;
      case "month":
        return sqlTag`to_char(${column}, 'YYYY-MM')`;
      case "day":
        return sqlTag`to_char(${column}, 'YYYY-MM-DD')`;
      case "week":
        return sqlTag`to_char(${column}, 'IYYY-IW')`;
      case "hour":
        return sqlTag`to_char(${column}, 'YYYY-MM-DD HH24:00')`;
    }
  } else if (dialect === "mysql") {
    switch (interval) {
      case "year":
        return sqlTag`DATE_FORMAT(${column}, '%Y')`;
      case "month":
        return sqlTag`DATE_FORMAT(${column}, '%Y-%m')`;
      case "day":
        return sqlTag`DATE_FORMAT(${column}, '%Y-%m-%d')`;
      case "week":
        return sqlTag`DATE_FORMAT(${column}, '%Y-u%u')`;
      case "hour":
        return sqlTag`DATE_FORMAT(${column}, '%Y-%m-%d %H:00')`;
    }
  } else {
    // sqlite
    switch (interval) {
      case "year":
        return sqlTag`strftime('%Y', ${column})`;
      case "month":
        return sqlTag`strftime('%Y-%m', ${column})`;
      case "day":
        return sqlTag`strftime('%Y-%m-%d', ${column})`;
      case "week":
        return sqlTag`strftime('%Y-W%W', ${column})`;
      case "hour":
        return sqlTag`strftime('%Y-%m-%d %H:00', ${column})`;
    }
  }
}

  const isAggregateEnabled = methods.has("aggregate") || Boolean(config.aggregate);
  if (isAggregateEnabled) {
    const handleAggregate = async (c: Context) => {
      const adapter = getAdapter(c);
      const appContext = (globalConfig?.getContext ? await globalConfig.getContext(c) : {}) as AppContext;

      await checkRateLimit(c, appContext);
      await checkAccess(appContext, "aggregate");

      const tenancy = await resolveTenancyContext(c, appContext, adapter);

      // Cache Check
      const cacheKey = getCacheKey(c, "aggregate", undefined, appContext, tenancy.tenantVal, tenancy.isBypassed);
      if (cacheKey) {
        const cached = await globalConfig!.cache!.get(cacheKey);
        if (cached) return c.json(cached);
      }

      if (config.hooks?.beforeFetch) {
        await config.hooks.beforeFetch(c, { aggregate: true } as any, appContext);
      }

      const queryParams = c.req.query();
      const cols = adapter.getColumns(config.table) as Record<string, any>;
      const ops = adapter.getOperators();
      const sqlTag = adapter.getSql();
      const dialect: "postgresql" | "mysql" | "sqlite" = (adapter.getDialect?.() as any) ?? "sqlite";

      const aggConfig = typeof config.aggregate === "object" ? config.aggregate : undefined;

      // 1. Resolve date column for time-based features
      const resolveDateCol = (): string | undefined => {
        if (aggConfig?.dateColumn && cols[aggConfig.dateColumn]) return aggConfig.dateColumn;
        const ts = getTimestampFields();
        if (ts?.created && cols[ts.created]) return ts.created;
        if (cols.createdAt) return "createdAt";
        if (cols.created_at) return "created_at";
        if (cols.date) return "date";
        if (cols.timestamp) return "timestamp";
        return undefined;
      };

      const dateCol = resolveDateCol();

      // 2. Build Search Subqueries if q is provided
      const q = queryParams.q;
      const searchSubqueries: any[] = [];
      if (q && config.search) {
        // Search local fields
        if (config.search.fields) {
          const searchConds = [ops.or(...config.search.fields.map(f => ops.like(adapter.getColumn(config.table as any, f as string), `%${q}%`)))];
          if (tenancy.tenantCondition) {
            searchConds.push(tenancy.tenantCondition);
          }
          const localSubquery = adapter.getDb()
            .select({ id: adapter.getColumn(config.table as any, 'id') })
            .from(config.table)
            .where(ops.and(...searchConds));
          searchSubqueries.push(localSubquery);
        }
        // Search relations
        if (config.search.relations) {
          for (const relName of config.search.relations) {
            const oneRel = config.relations?.one?.find(r => r.name === relName);
            if (oneRel && oneRel.search) {
              const relSubquery = adapter.getDb()
                .select({ parentId: adapter.getColumn(config.table as any, oneRel.foreignKey) })
                .from(config.table)
                .innerJoin(oneRel.table, ops.eq(adapter.getColumn(oneRel.table, oneRel.referenceKey), adapter.getColumn(config.table as any, oneRel.foreignKey)))
                .where(ops.or(...oneRel.search.map(f => ops.like(adapter.getColumn(oneRel.table, f as string), `%${q}%`))));
              searchSubqueries.push(relSubquery);
            }
            const manyRel = config.relations?.many?.find(r => r.name === relName);
            if (manyRel && manyRel.search) {
              const relSubquery = adapter.getDb()
                .select({ parentId: adapter.getColumn(manyRel.table, manyRel.foreignKey) })
                .from(manyRel.table)
                .where(ops.or(...manyRel.search.map(f => ops.like(adapter.getColumn(manyRel.table, f as string), `%${q}%`))));
              searchSubqueries.push(relSubquery);
            }
            const pivotRel = config.relations?.pivots?.find(r => r.name === relName);
            if (pivotRel && pivotRel.search && pivotRel.targetTable) {
              const relSubquery = adapter.getDb()
                .select({ parentId: adapter.getColumn(pivotRel.table, pivotRel.foreignKey) })
                .from(pivotRel.table)
                .innerJoin(pivotRel.targetTable, ops.eq(adapter.getColumn(pivotRel.targetTable, pivotRel.targetReferenceKey), adapter.getColumn(pivotRel.table, pivotRel.referenceKey)))
                .where(ops.or(...pivotRel.search.map(f => ops.like(adapter.getColumn(pivotRel.targetTable, f as string), `%${q}%`))));
              searchSubqueries.push(relSubquery);
            }
          }
        }
      }

      // 3. Build WHERE conditions
      const conditions: any[] = [];

      // Tenancy
      if (tenancy.tenantCondition) {
        conditions.push(tenancy.tenantCondition);
      }

      // Soft delete
      if (config.softDelete && cols[config.softDelete]) {
        conditions.push(ops.isNull(cols[config.softDelete]));
      }

      // Scope
      if (config.scope) {
        const scoped = config.scope(cols, ops, appContext);
        if (scoped) conditions.push(scoped);
      }

      // Search subqueries
      if (searchSubqueries.length > 0) {
        conditions.push(ops.or(...searchSubqueries.map(sq => sqlTag`${cols.id} IN (${sq})`)));
      } else if (q && config.search) {
        conditions.push(ops.eq(cols.id, -1));
      }

      // Direct Query Filters
      const reservedParams = new Set([
        'limit', 'page', 'q', 'sort', 'order',
        'metrics', 'aggregate', 'groupBy', 'group_by',
        'timeframe', 'from', 'to', 'startDate', 'endDate'
      ]);

      const allowedFilters = config.filter?.allow || [];
      for (const [key, value] of Object.entries(queryParams)) {
        if (reservedParams.has(key)) continue;
        if (value === "" || value == null) continue;

        const rangeMatch = key.match(/^(.+)__(gte|lte|gt|lt|like)$/);
        let field = key;
        let op = ops.eq;

        if (rangeMatch) {
          const [, f, suffix] = rangeMatch;
          field = f!;
          if (suffix === 'gte') op = ops.gte;
          else if (suffix === 'lte') op = ops.lte;
          else if (suffix === 'gt') op = ops.gt;
          else if (suffix === 'lt') op = ops.lt;
          else if (suffix === 'like') op = ops.like;
        }

        if (allowedFilters.length > 0 && !allowedFilters.includes(field)) {
          continue;
        }

        if (cols[field]) {
          const finalValue = op === ops.like ? `%${value}%` : value;
          conditions.push(op(cols[field], finalValue));
        }
      }

      // Date range / timeframe filters
      const timeframe = queryParams.timeframe;
      const fromParam = queryParams.from || queryParams.startDate;
      const toParam = queryParams.to || queryParams.endDate;

      if ((timeframe || fromParam || toParam) && !dateCol) {
        throw new ApiError(
          400,
          "INVALID_TIMEFRAME",
          `Resource '${config.name}' does not have a date column configured for timeframe filtering.`
        );
      }

      if (dateCol) {
        if (fromParam) {
          conditions.push(ops.gte(cols[dateCol], fromParam));
        }
        if (toParam) {
          conditions.push(ops.lte(cols[dateCol], toParam));
        }
        if (timeframe) {
          const tfLower = timeframe.toLowerCase();
          if (tfLower === "today") {
            const start = new Date();
            start.setUTCHours(0, 0, 0, 0);
            conditions.push(ops.gte(cols[dateCol], start.toISOString()));
          } else if (tfLower === "yesterday") {
            const start = new Date();
            start.setUTCDate(start.getUTCDate() - 1);
            start.setUTCHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setUTCHours(23, 59, 59, 999);
            conditions.push(ops.gte(cols[dateCol], start.toISOString()));
            conditions.push(ops.lte(cols[dateCol], end.toISOString()));
          } else {
            const match = tfLower.match(/^(\d+)([hdmyw])$/);
            if (!match) {
              throw new ApiError(
                400,
                "INVALID_TIMEFRAME",
                `Invalid timeframe '${timeframe}'. Expected format like '30d', '7d', '24h', 'today', 'yesterday'.`
              );
            }
            const num = parseInt(match[1]!, 10);
            const unit = match[2]!;
            let ms = 0;
            switch (unit) {
              case "h": ms = num * 3600 * 1000; break;
              case "d": ms = num * 86400 * 1000; break;
              case "w": ms = num * 7 * 86400 * 1000; break;
              case "m": ms = num * 30 * 86400 * 1000; break;
              case "y": ms = num * 365 * 86400 * 1000; break;
            }
            const since = new Date(Date.now() - ms).toISOString();
            conditions.push(ops.gte(cols[dateCol], since));
          }
        }
      }

      const whereClause = conditions.length > 0 ? ops.and(...conditions) : undefined;

      // 4. Parse Metrics
      const rawMetrics = queryParams.metrics || queryParams.aggregate;
      const metricsList = rawMetrics
        ? rawMetrics.split(",").map(m => m.trim()).filter(Boolean)
        : (aggConfig?.defaultMetrics ?? ["count"]);

      if (metricsList.length === 0) {
        metricsList.push("count");
      }

      const parsedMetrics: { fn: string; col?: string; alias: string }[] = [];
      const allowedFns = new Set(["count", "sum", "avg", "min", "max"]);

      for (const item of metricsList) {
        let fn: string;
        let col: string | undefined;
        let alias: string;

        if (item.includes(" as ") || item.includes(" AS ")) {
          const [expr, asAlias] = item.split(/\s+as\s+/i);
          alias = asAlias!.trim();
          if (expr!.includes(":")) {
            const [f, cName] = expr!.split(":");
            fn = f!.trim().toLowerCase();
            col = cName!.trim();
          } else {
            fn = expr!.trim().toLowerCase();
          }
        } else if (item.includes(":")) {
          const parts = item.split(":");
          fn = parts[0]!.trim().toLowerCase();
          col = parts[1]!.trim();
          alias = parts[2] ? parts[2].trim() : `${fn}_${col}`;
        } else {
          fn = item.trim().toLowerCase();
          alias = fn;
        }

        if (!allowedFns.has(fn)) {
          throw new ApiError(
            400,
            "INVALID_METRIC",
            `Unsupported aggregation function '${fn}'. Supported functions: count, sum, avg, min, max.`
          );
        }

        if (aggConfig?.allowedMetrics && !aggConfig.allowedMetrics.includes(fn)) {
          throw new ApiError(
            400,
            "FORBIDDEN_METRIC",
            `Aggregation function '${fn}' is not allowed for resource '${config.name}'.`
          );
        }

        if (col) {
          if (!cols[col]) {
            throw new ApiError(
              400,
              "INVALID_COLUMN",
              `Column '${col}' does not exist on table '${config.name}'.`
            );
          }
          if (aggConfig?.allowedFields && !aggConfig.allowedFields.includes(col)) {
            throw new ApiError(
              400,
              "FORBIDDEN_FIELD",
              `Field '${col}' is not allowed in aggregations for resource '${config.name}'.`
            );
          }
        }

        parsedMetrics.push({ fn, col, alias });
      }

      // 5. Parse GroupBy
      const rawGroupBy = queryParams.groupBy || queryParams.group_by;
      const groupByList = rawGroupBy
        ? rawGroupBy.split(",").map(g => g.trim()).filter(Boolean)
        : [];

      const selectObj: Record<string, any> = {};
      const groupByExpressions: any[] = [];
      const parsedGroupByMeta: string[] = [];

      const intervalMap: Record<string, "year" | "month" | "day" | "week" | "hour"> = {
        year: "year",
        month: "month",
        day: "day",
        week: "week",
        hour: "hour"
      };

      for (const item of groupByList) {
        if (aggConfig?.allowedGroupBy && !aggConfig.allowedGroupBy.includes(item)) {
          throw new ApiError(
            400,
            "FORBIDDEN_GROUP_BY",
            `GroupBy expression '${item}' is not allowed for resource '${config.name}'.`
          );
        }

        if (item.includes(":")) {
          const [field, intervalRaw] = item.split(":");
          const interval = intervalMap[intervalRaw!.trim().toLowerCase()];
          if (!interval) {
            throw new ApiError(
              400,
              "INVALID_GROUP_INTERVAL",
              `Invalid time bucket interval '${intervalRaw}'. Allowed: year, month, day, week, hour.`
            );
          }
          const colName = field!.trim();
          if (!cols[colName]) {
            throw new ApiError(
              400,
              "INVALID_COLUMN",
              `Column '${colName}' does not exist on table '${config.name}'.`
            );
          }
          const bucketSql = buildDateBucketSql(dialect, sqlTag, cols[colName], interval);
          selectObj[colName] = bucketSql;
          if (colName !== "period") {
            selectObj.period = bucketSql;
          }
          groupByExpressions.push(bucketSql);
          parsedGroupByMeta.push(item);
        } else if (intervalMap[item.toLowerCase()]) {
          // shorthand: e.g. groupBy=day
          const interval = intervalMap[item.toLowerCase()]!;
          if (!dateCol) {
            throw new ApiError(
              400,
              "INVALID_GROUP_BY",
              `Cannot group by '${item}' because resource '${config.name}' does not have a configured date column.`
            );
          }
          const bucketSql = buildDateBucketSql(dialect, sqlTag, cols[dateCol], interval);
          selectObj.period = bucketSql;
          if (dateCol !== "period") {
            selectObj[dateCol] = bucketSql;
          }
          groupByExpressions.push(bucketSql);
          parsedGroupByMeta.push(item);
        } else {
          // categorical
          if (!cols[item]) {
            throw new ApiError(
              400,
              "INVALID_COLUMN",
              `Column '${item}' does not exist on table '${config.name}'.`
            );
          }
          selectObj[item] = cols[item];
          groupByExpressions.push(cols[item]);
          parsedGroupByMeta.push(item);
        }
      }

      // Add metrics to selectObj
      for (const metric of parsedMetrics) {
        const { fn, col, alias } = metric;
        if (fn === "count") {
          selectObj[alias] = col ? sqlTag`count(${cols[col]})` : sqlTag`count(*)`;
        } else if (fn === "sum") {
          selectObj[alias] = sqlTag`sum(${cols[col!]})`;
        } else if (fn === "avg") {
          selectObj[alias] = sqlTag`avg(${cols[col!]})`;
        } else if (fn === "min") {
          selectObj[alias] = sqlTag`min(${cols[col!]})`;
        } else if (fn === "max") {
          selectObj[alias] = sqlTag`max(${cols[col!]})`;
        }
      }

      // 6. Build and execute Query
      const db = adapter.getDb();
      let query = db.select(selectObj).from(config.table).$dynamic();

      if (whereClause) {
        query = query.where(whereClause);
      }

      if (groupByExpressions.length > 0) {
        query = query.groupBy(...groupByExpressions);

        // Sorting
        const sortParam = queryParams.sort;
        const orderParam = queryParams.order?.toLowerCase() === "desc" ? "desc" : "asc";

        if (sortParam && selectObj[sortParam]) {
          query = query.orderBy(sqlTag`${selectObj[sortParam]} ${orderParam === "desc" ? sqlTag`DESC` : sqlTag`ASC`}`);
        } else {
          query = query.orderBy(...groupByExpressions.map(expr => sqlTag`${expr} ASC`));
        }

        const maxLimit = aggConfig?.maxLimit ?? 500;
        const requestedLimit = parseLimit(queryParams.limit, maxLimit);
        const limit = Math.min(requestedLimit ?? 100, maxLimit);
        query = query.limit(limit);
      }

      const rows: any[] = await query;

      // 7. Format Result Rows
      const formatRow = (row: any) => {
        const out = { ...row };
        for (const metric of parsedMetrics) {
          const val = out[metric.alias];
          if (metric.fn === "count") {
            out[metric.alias] = Number(val ?? 0);
          } else if (metric.fn === "sum") {
            out[metric.alias] = val != null ? Number(val) : 0;
          } else if (metric.fn === "avg") {
            out[metric.alias] = val != null ? Number(Number(val).toFixed(4)) : null;
          } else if (metric.fn === "min" || metric.fn === "max") {
            out[metric.alias] = val != null ? (isNaN(Number(val)) ? val : Number(val)) : null;
          }
        }
        return out;
      };

      const metricAliases = parsedMetrics.map(m => m.alias);

      let responseData: any;
      let totalRecords = 0;

      if (groupByExpressions.length === 0) {
        const rawFirst = rows[0] ?? {};
        responseData = formatRow(rawFirst);
        const countMetric = parsedMetrics.find(m => m.fn === "count");
        if (countMetric) {
          totalRecords = responseData[countMetric.alias] ?? 0;
        } else {
          totalRecords = await adapter.count(config.table, whereClause);
        }
      } else {
        responseData = rows.map(formatRow);
        const countMetric = parsedMetrics.find(m => m.fn === "count");
        if (countMetric) {
          totalRecords = responseData.reduce((acc: number, r: any) => acc + (Number(r[countMetric.alias]) || 0), 0);
        } else {
          totalRecords = await adapter.count(config.table, whereClause);
        }
      }

      const response = {
        success: true,
        data: responseData,
        meta: {
          metrics: metricAliases,
          ...(parsedGroupByMeta.length > 0 ? { groupBy: parsedGroupByMeta } : {}),
          totalRecords,
          ...(timeframe ? { timeframe } : {}),
          ...(fromParam ? { from: fromParam } : {}),
          ...(toParam ? { to: toParam } : {})
        }
      };

      if (cacheKey) {
        await globalConfig!.cache!.set(cacheKey, response, config.cache?.ttl);
      }

      return c.json(response);
    };

    app.get("/aggregate", handleAggregate);
    app.get("/stats", handleAggregate);
  }


  if (methods.has("detail")) {
    app.get("/:id", async (c) => {
      const adapter = getAdapter(c);
      const appContext = (globalConfig?.getContext ? await globalConfig.getContext(c) : {}) as AppContext;
      await checkRateLimit(c, appContext);
      const id = c.req.param("id");

      const tenancy = await resolveTenancyContext(c, appContext, adapter);
      
      // 0. Cache Check
      const cacheKey = getCacheKey(c, "detail", id, appContext, tenancy.tenantVal, tenancy.isBypassed);
      if (cacheKey) {
        const cached = await globalConfig!.cache!.get(cacheKey);
        if (cached) return c.json(cached);
      }

      if (config.hooks?.beforeFetch) {
        await config.hooks.beforeFetch(c, { detailId: id }, appContext);
      }

      const withTree = resolveWith("detail");

      const queryKey = config.queryKey ?? config.name;
      const row = await adapter.findFirst(config.table, {
        where: (cols: any, ops: any) => {
          const { and, eq, isNull } = ops;
          const conditions = [eq(cols.id, id)];
          
          if (tenancy.tenantCondition) {
            conditions.push(tenancy.tenantCondition);
          }

          if (config.softDelete) {
            conditions.push(isNull(cols[config.softDelete]));
          }

          if (config.scope) {
            const scoped = config.scope(cols, ops, appContext);
            if (scoped) conditions.push(scoped);
          }

          return conditions.length > 1 ? and(...conditions) : conditions[0];
        },
        with: withTree,
        queryKey
      });

      if (!row) throw ApiError.notFound();

      await checkAccess(appContext, "detail", row);

      let resultRow: any = row;
      if (config.hooks?.afterFetch) {
        const after = await config.hooks.afterFetch([row], c, appContext);
        if (after && after.length > 0) {
          resultRow = after[0];
        }
      }

      const response = {
        success: true,
        data: await finalize(resultRow as TSelect, appContext, config, c, "detail")
      };

      if (cacheKey) {
        await globalConfig!.cache!.set(cacheKey, response, config.cache?.ttl);
      }

      return c.json(response);
    });
  }

  if (config.slugs) {
    for (const slugField of config.slugs) {
      app.get(`/${slugField}/:value`, async (c) => {
        const adapter = getAdapter(c);
        const appContext = (globalConfig?.getContext ? await globalConfig.getContext(c) : {}) as AppContext;
        await checkRateLimit(c, appContext);
        const value = c.req.param("value");
        
        const tenancy = await resolveTenancyContext(c, appContext, adapter);

        // Cache Check
        const cacheKey = getCacheKey(c, `detail:${slugField}`, value, appContext, tenancy.tenantVal, tenancy.isBypassed);
        if (cacheKey) {
          const cached = await globalConfig!.cache!.get(cacheKey);
          if (cached) return c.json(cached);
        }

        if (config.hooks?.beforeFetch) {
          await config.hooks.beforeFetch(c, { detailId: value, slug: slugField }, appContext);
        }

        const withTree = resolveWith("slug");
        const queryKey = config.queryKey ?? config.name;

        const row = await adapter.findFirst(config.table, {
          where: (cols: any, ops: any) => {
            const { and, eq, isNull } = ops;
            const conditions = [eq(cols[slugField], value)];
            
            if (tenancy.tenantCondition) {
              conditions.push(tenancy.tenantCondition);
            }

            if (config.softDelete) {
              conditions.push(isNull(cols[config.softDelete]));
            }

            if (config.scope) {
              const scoped = config.scope(cols, ops, appContext);
              if (scoped) conditions.push(scoped);
            }

            return conditions.length > 1 ? and(...conditions) : conditions[0];
          },
          with: withTree,
          queryKey
        });

        if (!row) throw ApiError.notFound();

        await checkAccess(appContext, "detail", row);

        let resultRow: any = row;
        if (config.hooks?.afterFetch) {
          const after = await config.hooks.afterFetch([row], c, appContext);
          if (after && after.length > 0) {
            resultRow = after[0];
          }
        }

        const response = {
          success: true,
          data: await finalize(resultRow as TSelect, appContext, config, c, "detail")
        };

        if (cacheKey) {
          await globalConfig!.cache!.set(cacheKey, response, config.cache?.ttl);
        }

        return c.json(response);
      });
    }
  }

  if (methods.has("create")) {
    app.post("/", async (c) => {
      const adapter = getAdapter(c);
      const strategy = resolveStrategy(adapter);
      const appContext = (globalConfig?.getContext ? await globalConfig.getContext(c) : {}) as AppContext;
      await checkRateLimit(c, appContext);
      await checkAccess(appContext, "create");

      const tenancy = await resolveTenancyContext(c, appContext, adapter);

      let body = await c.req.json();
      
      // 0. Recursive File Upload Processing
      body = await processUploads(body);

      let createdOutboxEntry: OutboxRecord | undefined;
      const record = await runTransaction(c, async (tx) => {
        let data = body;

        const stmts: any[] = [];
        
        // Sanitize write payload (FLAC)
        data = await sanitizeWritePayload(data, appContext);

        // Document Workflow: Stamp initial state
        if (config.workflow) {
          const statusField = config.workflow.field ?? "status";
          const initialStatus = config.workflow.initial ?? "draft";
          data[statusField] = initialStatus;
        }

        // Naming Series Generation
        if (config.namingSeries) {
          const sField = config.namingSeries.field;
          const allowManual = config.namingSeries.allowManual ?? false;
          if (!allowManual || data[sField] === undefined || data[sField] === null || data[sField] === "") {
            data[sField] = await generateSeriesNumber(data, appContext, tenancy, tx);
          }
        }

        if (config.hooks?.beforeCreate) {
          const hooked = await config.hooks.beforeCreate(data, c, tx, appContext, stmts);
          if (hooked) data = hooked;
        }

        // Automatic tenant stamping / validation on data
        if (!tenancy.isBypassed && tenancy.isTenancyActive) {
          if (Array.isArray(tenancy.tenantVal)) {
            if (data[tenancy.tenantField] !== undefined) {
              if (!tenancy.tenantVal.includes(data[tenancy.tenantField])) {
                throw new ApiError(403, "TENANT_ACCESS_DENIED", "You do not have access to the specified tenant.");
              }
            } else if (tenancy.tenantVal.length === 1) {
              data[tenancy.tenantField] = tenancy.tenantVal[0];
            } else {
              throw new ApiError(400, "TENANT_REQUIRED", "Tenant identifier is ambiguous; please specify tenant in payload.");
            }
          } else if (tenancy.tenantVal !== undefined && tenancy.tenantVal !== null) {
            data[tenancy.tenantField] = tenancy.tenantVal;
          }
        }

        // Resolve Create Validator
        const { create: validator } = resolveValidators(config.validator);
        const validated = await validateWith(validator, data);


        // Ensure validated has tenant stamped as well
        if (!tenancy.isBypassed && tenancy.isTenancyActive) {
          if (Array.isArray(tenancy.tenantVal)) {
            if (validated[tenancy.tenantField] !== undefined) {
              if (!tenancy.tenantVal.includes(validated[tenancy.tenantField])) {
                throw new ApiError(403, "TENANT_ACCESS_DENIED", "You do not have access to the specified tenant.");
              }
            } else if (tenancy.tenantVal.length === 1) {
              validated[tenancy.tenantField] = tenancy.tenantVal[0];
            }
          } else if (tenancy.tenantVal !== undefined && tenancy.tenantVal !== null) {
            validated[tenancy.tenantField] = tenancy.tenantVal;
          }
        }

        // Auto Timestamps
        const ts = getTimestampFields();
        if (ts) {
          const now = new Date().toISOString();
          if (ts.created && !(ts.created in validated)) validated[ts.created] = now;
          if (ts.updated) validated[ts.updated] = now; // Always update modified time
        }

        // The foreign key of a child row points at the parent, and the parent's
        // id is only known once the parent has been inserted. When the client
        // supplied the id we can use it as-is; otherwise the adapter builds a
        // dialect-appropriate expression that resolves to it when the child is
        // inserted. Without either, relations cannot be written in a batch and
        // we fall back to the imperative strategy below.
        const hasRelations = !!(config.relations?.many?.length || config.relations?.pivots?.length);
        const hasOutbox = shouldRecordOutboxEvent("create") && Boolean(globalConfig?.outbox?.table || globalConfig?.outbox?.sink);
        const needsParentId = hasRelations || hasOutbox;
        const explicitParentId = (validated as any).id;
        const batchParentId = !needsParentId
          ? undefined
          : explicitParentId != null
            ? explicitParentId
            : tx.parentIdExpression?.(config.table);
        const useBatch = strategy === "batch" && (!needsParentId || batchParentId !== undefined);

        if (useBatch) {
          // 1. Add Parent Statement
          stmts.push(tx.insertStmt(config.table, validated));

          // 2. Add Many/Pivot Relations
          if (config.relations) {
            // Many Relations
            if (config.relations.many) {
              for (const rel of config.relations.many) {
                const children = data[rel.name];
                if (Array.isArray(children)) {
                  for (const child of children) {
                    stmts.push(tx.insertStmt(rel.table, {
                      ...child,
                      [rel.foreignKey]: batchParentId
                    }));
                  }
                }
              }
            }

            // Pivot Relations
            if (config.relations.pivots) {
              for (const rel of config.relations.pivots) {
                const items = data[rel.name];
                if (Array.isArray(items)) {
                  for (const item of items) {
                    stmts.push(tx.insertStmt(rel.table, {
                      ...item,
                      [rel.foreignKey]: batchParentId
                    }));
                  }
                }
              }
            }
          }

          if (shouldRecordOutboxEvent("create")) {
            createdOutboxEntry = createOutboxEntry(
              "create",
              explicitParentId ?? batchParentId ?? "0",
              { id: explicitParentId != null ? explicitParentId : null, data: validated, tenantId: tenancy.isTenancyActive ? tenancy.tenantVal : null },
              tenancy.isTenancyActive ? tenancy.tenantVal : null
            );
            await persistOutboxEntry(createdOutboxEntry, tx, c, appContext, stmts);
          }

          const results = await tx.batch(stmts);
          const inserted = Array.isArray(results[0]) ? results[0][0] : results[0];

          if (createdOutboxEntry) {
            const finalId = (inserted as any)?.id ?? createdOutboxEntry.recordId;
            createdOutboxEntry.recordId = finalId;
            createdOutboxEntry.payload.id = finalId;
            createdOutboxEntry.payload.data = inserted;
          }

          if (config.hooks?.afterCreate) {
            await config.hooks.afterCreate(inserted as TSelect, c, tx, appContext);
          }

          return inserted;
        } else {
          // Traditional imperative strategy
          // 1. Save Parent
          const inserted: any = await tx.insert(config.table, validated);
          const parentId = inserted.id;

          // 2. Save Many/Pivot Relations
          if (config.relations) {
            // Many Relations
            if (config.relations.many) {
              for (const rel of config.relations.many) {
                const children = data[rel.name];
                if (Array.isArray(children)) {
                  for (const child of children) {
                    await tx.insert(rel.table, { ...child, [rel.foreignKey]: parentId });
                  }
                }
              }
            }

            // Pivot Relations
            if (config.relations.pivots) {
              for (const rel of config.relations.pivots) {
                const items = data[rel.name];
                if (Array.isArray(items)) {
                  for (const item of items) {
                    await tx.insert(rel.table, { ...item, [rel.foreignKey]: parentId });
                  }
                }
              }
            }
          }

          if (shouldRecordOutboxEvent("create")) {
            createdOutboxEntry = createOutboxEntry(
              "create",
              parentId,
              { id: parentId, data: inserted, tenantId: tenancy.isTenancyActive ? tenancy.tenantVal : null },
              tenancy.isTenancyActive ? tenancy.tenantVal : null
            );
            await persistOutboxEntry(createdOutboxEntry, tx, c, appContext);
          }

          if (config.hooks?.afterCreate) {
            await config.hooks.afterCreate(inserted as TSelect, c, tx, appContext);
          }

          return inserted;
        }
      });

      if (createdOutboxEntry) {
        await dispatchWebhooks(createdOutboxEntry, c, appContext);
      }

      await emitEvent(appContext, "create", record);
      await invalidateCache();

      // Reload with relations if necessary (since we just saved them)
      let finalRecord = record;
      const idCol = (adapter.getColumns(config.table as any) as any).id;
      const recordId = record[idCol.name] || record.id;
      
      const reloadWith = resolveWith("detail");
      if (reloadWith && recordId) {
        const reloaded = await adapter.findFirst(config.table, {
          where: (cols: any, { eq }: any) => eq(cols.id, recordId),
          with: reloadWith,
          queryKey: config.queryKey ?? config.name
        });
        if (reloaded) finalRecord = reloaded;
      }

      if (shouldAuditAction("create")) {
        const actorId = await resolveActorId(c, appContext);
        const diff = computeFieldDiff(null, record, auditExcludeFields, auditMaskFields, auditMaskString);
        let customMeta: Record<string, unknown> | undefined;
        if (auditConfigObj?.metadata) {
          customMeta = await auditConfigObj.metadata(c, appContext, record as any);
        }
        await dispatchAudit({
          resource: config.name,
          recordId: (record as any).id,
          action: "create",
          actorId,
          tenantId: tenancy.isTenancyActive ? String(tenancy.tenantVal) : null,
          diff,
          oldData: null,
          newData: auditConfigObj?.includeSnapshots ? sanitizeAuditSnapshot(record, auditExcludeFields, auditMaskFields, auditMaskString) : null,
          metadata: customMeta,
          ip: getClientIp(c),
          userAgent: getUserAgent(c),
          timestamp: new Date().toISOString(),
        }, c, appContext);
      }

      return c.json({
        success: true,
        data: await finalize(finalRecord as TSelect, appContext, config, c, "detail")
      }, 201);
    });
  }

  if (methods.has("update")) {
    app.patch("/:id", async (c) => {
      const adapter = getAdapter(c);
      const strategy = resolveStrategy(adapter);
      const appContext = (globalConfig?.getContext ? await globalConfig.getContext(c) : {}) as AppContext;
      await checkRateLimit(c, appContext);
      const id = c.req.param("id");

      const tenancy = await resolveTenancyContext(c, appContext, adapter);

      // The scope and soft-delete filters are part of the lookup, so a row
      // outside the caller's scope is reported as not found instead of
      // confirming that it exists.
      const recordPredicate = buildRecordPredicate(id, appContext, adapter, tenancy.tenantCondition);
      const ops = adapter.getOperators();

      // We need to fetch the existing record first for Row-Level Security
      const existingRecord = await adapter.findFirst(config.table, {
        where: recordPredicate,
      });

      if (!existingRecord) throw ApiError.notFound();

      await checkAccess(appContext, "update", existingRecord);
      await checkWorkflowParentLock(adapter, existingRecord);

      let body = await c.req.json();

      // Sanitize write payload (FLAC)
      body = await sanitizeWritePayload(body, appContext, existingRecord);

      let workflowAfterHook: (() => Promise<void>) | null = null;
      let workflowMatchingTransition: any = null;
      let workflowCurrentState: string | undefined;
      let workflowTargetState: string | undefined;
      let isWorkflowTransitionAttempted = false;

      // Document Workflow: Enforce state transitions & per-state field locks
      if (config.workflow) {
        const statusField = config.workflow.field ?? "status";
        const initialStatus = config.workflow.initial ?? "draft";
        const currentState = existingRecord[statusField] ?? initialStatus;
        const targetState = body[statusField];
        const isTransitionAttempted = targetState !== undefined && targetState !== currentState;

        workflowCurrentState = currentState;
        workflowTargetState = targetState;
        isWorkflowTransitionAttempted = isTransitionAttempted;

        const stateConfig = config.workflow.states?.[currentState];
        const defaultEditableStates = config.workflow.editableStates ?? [initialStatus];
        const isStateFullyEditable = stateConfig ? (stateConfig.editable === true) : defaultEditableStates.includes(currentState);

        // Check state-level roles if defined
        if (stateConfig?.roles) {
          const userRoles = await getUserRoles(appContext);
          const hasRole = userRoles.some(r => stateConfig.roles!.includes(r));
          if (!hasRole) {
            throw new ApiError(403, "WORKFLOW_FORBIDDEN", `Not authorized to modify documents in state '${currentState}'.`);
          }
        }

        if (!isTransitionAttempted) {
          // Document remains in current state
          if (!isStateFullyEditable) {
            const allowedFields = stateConfig?.allowFields ?? [];
            const fieldsAttempted = Object.keys(body).filter(k => k !== statusField);

            if (allowedFields.length === 0) {
              throw new ApiError(403, "WORKFLOW_LOCKED", `Document in state '${currentState}' is locked and cannot be modified.`);
            }

            for (const f of fieldsAttempted) {
              if (!allowedFields.includes(f)) {
                if (config.fieldViolationStrategy === "reject") {
                  throw new ApiError(403, "FIELD_FORBIDDEN", `Field '${f}' cannot be modified while document is in state '${currentState}'.`);
                } else {
                  delete body[f];
                }
              }
            }
          }
        } else {
          // State transition is attempted: currentState -> targetState
          const matchingTransition = config.workflow.transitions.find(t => {
            if (t.to !== targetState) return false;
            if (t.from === "*") return true;
            if (Array.isArray(t.from)) return t.from.includes(currentState);
            return t.from === currentState;
          });

          if (!matchingTransition) {
            throw new ApiError(400, "INVALID_TRANSITION", `Cannot transition document from '${currentState}' to '${targetState}'.`);
          }

          workflowMatchingTransition = matchingTransition;

          if (matchingTransition.roles) {
            const userRoles = await getUserRoles(appContext);
            const hasRole = userRoles.some(r => matchingTransition.roles!.includes(r));
            if (!hasRole) {
              throw new ApiError(403, "FORBIDDEN", `Not authorized to execute transition to '${targetState}'.`);
            }
          }

          if (matchingTransition.permission && globalConfig?.auth?.can) {
            const hasPerm = await globalConfig.auth.can(appContext, matchingTransition.permission, existingRecord);
            if (!hasPerm) {
              throw new ApiError(403, "FORBIDDEN", `Permission '${matchingTransition.permission}' required to transition to '${targetState}'.`);
            }
          }

          if (matchingTransition.guard) {
            const isAllowed = await matchingTransition.guard(appContext, existingRecord);
            if (!isAllowed) {
              throw new ApiError(403, "TRANSITION_GUARD_FAILED", `Transition to '${targetState}' is not permitted by guard condition.`);
            }
          }

          // Check declarative child requirements (requireChildren)
          if (matchingTransition.requireChildren && matchingTransition.requireChildren.length > 0) {
            for (const req of matchingTransition.requireChildren) {
              const rel = config.relations?.many?.find(r => r.name === req.relation);
              if (!rel) {
                throw new ApiError(500, "CONFIG_ERROR", `Relation '${req.relation}' not found in resource '${config.name}' relations.many.`);
              }

              const children: any[] = await adapter.findMany(rel.table, {
                where: (cols: any, { eq }: any) => eq(cols[rel.foreignKey], id),
              }) as any[];

              if (req.minCount !== undefined && children.length < req.minCount) {
                throw new ApiError(
                  400,
                  "WORKFLOW_REQUIREMENT_FAILED",
                  `Transition to '${targetState}' requires at least ${req.minCount} '${req.relation}' (found ${children.length}).`,
                  { relation: req.relation, requiredMin: req.minCount, actual: children.length }
                );
              }

              if (req.maxCount !== undefined && children.length > req.maxCount) {
                throw new ApiError(
                  400,
                  "WORKFLOW_REQUIREMENT_FAILED",
                  `Transition to '${targetState}' allows at most ${req.maxCount} '${req.relation}' (found ${children.length}).`,
                  { relation: req.relation, requiredMax: req.maxCount, actual: children.length }
                );
              }

              if (req.match) {
                for (const child of children) {
                  for (const [matchKey, expectedVal] of Object.entries(req.match)) {
                    if (child[matchKey] !== expectedVal) {
                      throw new ApiError(
                        400,
                        "WORKFLOW_REQUIREMENT_FAILED",
                        `Child '${req.relation}' item with id '${child.id}' does not match required ${matchKey}='${expectedVal}' (current: '${child[matchKey]}').`,
                        { relation: req.relation, childId: child.id, field: matchKey, expected: expectedVal, actual: child[matchKey] }
                      );
                    }
                  }
                }
              }

              if (req.validate) {
                const valResult = await req.validate(children, appContext, existingRecord);
                if (valResult === false || typeof valResult === "string") {
                  const errorMsg = typeof valResult === "string" ? valResult : `Child validation failed for '${req.relation}'.`;
                  throw new ApiError(400, "WORKFLOW_REQUIREMENT_FAILED", errorMsg, { relation: req.relation });
                }
              }
            }
          }

          // Check if other fields in payload are allowed in currentState
          if (!isStateFullyEditable) {
            const allowedFields = stateConfig?.allowFields ?? [];
            const otherFields = Object.keys(body).filter(k => k !== statusField);
            for (const f of otherFields) {
              if (!allowedFields.includes(f)) {
                if (config.fieldViolationStrategy === "reject") {
                  throw new ApiError(403, "FIELD_FORBIDDEN", `Field '${f}' cannot be modified while document is in state '${currentState}'.`);
                } else {
                  delete body[f];
                }
              }
            }
          }

          // Automatically merge transition fields (e.g. approvedBy, approvedAt)
          if (matchingTransition.fields) {
            const extraFields = typeof matchingTransition.fields === "function"
              ? await matchingTransition.fields(appContext, existingRecord)
              : matchingTransition.fields;
            if (extraFields && typeof extraFields === "object") {
              Object.assign(body, extraFields);
            }
          }

          if (config.workflow.hooks?.beforeTransition) {
            const hookRes = await config.workflow.hooks.beforeTransition(
              { from: currentState, to: targetState, action: matchingTransition.action },
              existingRecord,
              c,
              adapter,
              appContext
            );
            if (hookRes && typeof hookRes === "object") {
              Object.assign(body, hookRes);
            }
          }

          if (config.workflow.hooks?.afterTransition) {
            workflowAfterHook = async () => {
              await config.workflow!.hooks!.afterTransition!(
                { from: currentState, to: targetState, action: matchingTransition.action },
                record,
                c,
                adapter,
                appContext
              );
            };
          }
        }
      }

      // Prevent tenant-hopping
      if (!tenancy.isBypassed && tenancy.isTenancyActive && tenancy.tenantField in body) {
        const attemptedTenant = body[tenancy.tenantField];
        if (attemptedTenant !== undefined) {
          if (Array.isArray(tenancy.tenantVal)) {
            if (!tenancy.tenantVal.includes(attemptedTenant)) {
              throw new ApiError(403, "TENANT_IMMUTABLE", "Cannot change tenant identifier.");
            }
          } else if (attemptedTenant !== tenancy.tenantVal) {
            throw new ApiError(403, "TENANT_IMMUTABLE", "Cannot change tenant identifier.");
          }
        }
        delete body[tenancy.tenantField];
      }

      // 0. Recursive File Upload Processing
      body = await processUploads(body);

      let updatedOutboxEntry: OutboxRecord | undefined;
      const record = await runTransaction(c, async (tx) => {
        let data = body;
        const stmts: any[] = [];

        if (config.hooks?.beforeUpdate) {
          const hooked = await config.hooks.beforeUpdate(id, data, c, tx, appContext, stmts);
          if (hooked) data = hooked;
        }

        // Resolve Update Validator
        const { update: validator } = resolveValidators(config.validator);
        const validated = await validateWith(validator, data);

        // Strip tenantField from validated if not bypassed
        if (!tenancy.isBypassed && tenancy.isTenancyActive && tenancy.tenantField in validated) {
          delete validated[tenancy.tenantField];
        }

        // Auto Timestamps
        const ts = getTimestampFields();
        if (ts && ts.updated) {
          validated[ts.updated] = new Date().toISOString();
        }

        if (strategy === "batch") {
          // 1. Add Parent Statement (if there are fields to update)
          const hasParentFields = Object.keys(validated).length > 0;
          if (hasParentFields) {
            let expectedVersion: any;
            if (config.versionControl) {
              const vField = config.versionControl.field;
              expectedVersion = data[vField];
              if (expectedVersion === undefined) throw new ApiError(400, "MISSING_VERSION", `Version control field '${vField}' is required for update.`);
              validated[vField] = expectedVersion + 1;
            }

            let parentStmt: any = tx.updateStmt(config.table, id, validated);

            // The scope and soft-delete filters are part of the write itself,
            // so a row that stopped matching them after the lookup is not
            // written either.
            if (config.versionControl) {
               const vField = config.versionControl.field;
               const updateCondition = ops.and(recordPredicate, ops.eq(adapter.getColumn(config.table as any, vField), expectedVersion));
               parentStmt = parentStmt.where(updateCondition);
            } else {
               parentStmt = parentStmt.where(recordPredicate);
            }

            stmts.push(parentStmt);
          }

          // 2. Sync Relations (if provided)
          if (config.relations) {
            // Sync Many
            if (config.relations.many) {
              for (const rel of config.relations.many) {
                if (Array.isArray(data[rel.name])) {
                  const relStrategy = rel.strategy ?? "replace";
                  if (relStrategy === "replace") {
                    stmts.push(tx.getDb().delete(rel.table).where(ops.eq(adapter.getColumn(rel.table, rel.foreignKey), id)));
                  }
                  
                  for (const child of data[rel.name]) {
                    stmts.push(tx.insertStmt(rel.table, { ...child, [rel.foreignKey]: id }));
                  }
                }
              }
            }

            // Sync Pivots
            if (config.relations.pivots) {
              for (const rel of config.relations.pivots) {
                if (Array.isArray(data[rel.name])) {
                  const relStrategy = rel.strategy ?? "replace";
                  if (relStrategy === "replace") {
                    stmts.push(tx.getDb().delete(rel.table).where(ops.eq(adapter.getColumn(rel.table, rel.foreignKey), id)));
                  }
                  
                  for (const item of data[rel.name]) {
                    stmts.push(tx.insertStmt(rel.table, { ...item, [rel.foreignKey]: id }));
                  }
                }
              }
            }
          }

          // 3. Workflow Cascade (if defined on transition)
          if (workflowMatchingTransition?.cascade?.length) {
            for (const cas of workflowMatchingTransition.cascade) {
              const rel = config.relations?.many?.find(r => r.name === cas.relation);
              if (!rel) {
                throw new ApiError(500, "CONFIG_ERROR", `Relation '${cas.relation}' not found in resource '${config.name}' relations.many.`);
              }

              const setValues = typeof cas.set === "function"
                ? await cas.set(appContext, existingRecord)
                : cas.set;

              if (setValues && Object.keys(setValues).length > 0) {
                stmts.push(
                  tx.getDb()
                    .update(rel.table)
                    .set(setValues)
                    .where(ops.eq(adapter.getColumn(rel.table, rel.foreignKey), id))
                );
              }
            }
          }

          const isTransition = isWorkflowTransitionAttempted && Boolean(workflowMatchingTransition);
          const outboxEvent: OutboxEvent = isTransition ? "transition" : "update";
          if (shouldRecordOutboxEvent(outboxEvent) || (isTransition && shouldRecordOutboxEvent("update"))) {
            const diff = computeFieldDiff(existingRecord, validated, auditExcludeFields, auditMaskFields, auditMaskString);
            const payloadData: Record<string, any> = {
              id,
              data: validated,
              previous: existingRecord,
              diff,
              tenantId: tenancy.isTenancyActive ? tenancy.tenantVal : null,
            };
            if (isTransition) {
              payloadData.workflow = {
                from: workflowCurrentState,
                to: workflowTargetState,
                action: workflowMatchingTransition?.action,
              };
            }
            updatedOutboxEntry = createOutboxEntry(outboxEvent, id, payloadData, tenancy.isTenancyActive ? tenancy.tenantVal : null);
            await persistOutboxEntry(updatedOutboxEntry, tx, c, appContext, stmts);
          }

          let updated: any;
          if (stmts.length > 0) {
            const results = await tx.batch(stmts);
            updated = hasParentFields
              ? (Array.isArray(results[0]) ? results[0][0] : results[0])
              : existingRecord;
          } else {
            updated = existingRecord;
          }

          if (config.versionControl && !updated) {
            throw new ApiError(409, "OCC_FAILED", "Optimistic concurrency control failed. The record was modified by another transaction.");
          }

          if (config.hooks?.afterUpdate) {
            await config.hooks.afterUpdate(updated as TSelect, c, tx, appContext);
          }

          return updated;
        } else {
          // Traditional imperative strategy
          // 1. Update Parent
          let updated: any;
          if (Object.keys(validated).length > 0) {
            let expectedVersion: any;
            if (config.versionControl) {
              const vField = config.versionControl.field;
              expectedVersion = data[vField];
              if (expectedVersion === undefined) throw new ApiError(400, "MISSING_VERSION", `Version control field '${vField}' is required for update.`);
              validated[vField] = expectedVersion + 1;
            }

            let updateQuery: any = tx.updateStmt(config.table, id, validated);

            // The scope and soft-delete filters are part of the write itself,
            // so a row that stopped matching them after the lookup is not
            // written either.
            if (config.versionControl) {
               const vField = config.versionControl.field;
               const updateCondition = ops.and(recordPredicate, ops.eq(adapter.getColumn(config.table as any, vField), expectedVersion));
               updateQuery = updateQuery.where(updateCondition);
            } else {
               updateQuery = updateQuery.where(recordPredicate);
            }

            const results = await updateQuery;
            updated = Array.isArray(results) ? results[0] : results;
            
            if (config.versionControl && !updated) {
              throw new ApiError(409, "OCC_FAILED", "Optimistic concurrency control failed. The record was modified by another transaction.");
            } else if (!updated) {
              throw ApiError.notFound();
            }
          } else {
            updated = existingRecord;
          }

          // 2. Sync Relations (if provided)
          if (config.relations) {
            if (config.relations.many) {
              for (const rel of config.relations.many) {
                if (Array.isArray(data[rel.name])) {
                  const relStmts = await syncRelations(tx, rel, id, data[rel.name], false);
                  for (const stmt of relStmts) await stmt;
                }
              }
            }

            // Sync Pivots
            if (config.relations.pivots) {
              for (const rel of config.relations.pivots) {
                if (Array.isArray(data[rel.name])) {
                  const relStmts = await syncRelations(tx, rel, id, data[rel.name], true);
                  for (const stmt of relStmts) await stmt;
                }
              }
            }
          }

          // 3. Workflow Cascade (if defined on transition)
          if (workflowMatchingTransition?.cascade?.length) {
            for (const cas of workflowMatchingTransition.cascade) {
              const rel = config.relations?.many?.find(r => r.name === cas.relation);
              if (!rel) {
                throw new ApiError(500, "CONFIG_ERROR", `Relation '${cas.relation}' not found in resource '${config.name}' relations.many.`);
              }

              const setValues = typeof cas.set === "function"
                ? await cas.set(appContext, existingRecord)
                : cas.set;

              if (setValues && Object.keys(setValues).length > 0) {
                await tx.getDb()
                  .update(rel.table)
                  .set(setValues)
                  .where(ops.eq(adapter.getColumn(rel.table, rel.foreignKey), id));
              }
            }
          }

          const isTransitionImperative = isWorkflowTransitionAttempted && Boolean(workflowMatchingTransition);
          const outboxEventImperative: OutboxEvent = isTransitionImperative ? "transition" : "update";
          if (shouldRecordOutboxEvent(outboxEventImperative) || (isTransitionImperative && shouldRecordOutboxEvent("update"))) {
            const diff = computeFieldDiff(existingRecord, updated, auditExcludeFields, auditMaskFields, auditMaskString);
            const payloadData: Record<string, any> = {
              id,
              data: updated,
              previous: existingRecord,
              diff,
              tenantId: tenancy.isTenancyActive ? tenancy.tenantVal : null,
            };
            if (isTransitionImperative) {
              payloadData.workflow = {
                from: workflowCurrentState,
                to: workflowTargetState,
                action: workflowMatchingTransition?.action,
              };
            }
            updatedOutboxEntry = createOutboxEntry(outboxEventImperative, id, payloadData, tenancy.isTenancyActive ? tenancy.tenantVal : null);
            await persistOutboxEntry(updatedOutboxEntry, tx, c, appContext);
          }

          if (config.hooks?.afterUpdate) {
            await config.hooks.afterUpdate(updated as TSelect, c, tx, appContext);
          }

          return updated;
        }
      });

      if (workflowAfterHook) {
        await workflowAfterHook();
      }

      if (updatedOutboxEntry) {
        await dispatchWebhooks(updatedOutboxEntry, c, appContext);
      }

      await emitEvent(appContext, "update", record);
      await invalidateCache();

      // Reload if necessary
      let finalRecord = record;
      const reloadWith = resolveWith("detail");
      if (reloadWith) {
        const reloaded = await adapter.findFirst(config.table, {
          where: (cols: any, { eq }: any) => eq(cols.id, id),
          with: reloadWith,
          queryKey: config.queryKey ?? config.name
        });
        if (reloaded) finalRecord = reloaded;
      }

      const isTransition = isWorkflowTransitionAttempted && Boolean(workflowMatchingTransition);
      const auditAction: AuditAction = isTransition ? "transition" : "update";

      if (shouldAuditAction(auditAction) || (isTransition && shouldAuditAction("update"))) {
        const actorId = await resolveActorId(c, appContext);
        const diff = computeFieldDiff(existingRecord, record, auditExcludeFields, auditMaskFields, auditMaskString);
        let customMeta: Record<string, unknown> | undefined;
        if (auditConfigObj?.metadata) {
          customMeta = await auditConfigObj.metadata(c, appContext, record as any);
        }
        if (isTransition) {
          customMeta = {
            ...customMeta,
            workflow: {
              from: workflowCurrentState,
              to: workflowTargetState,
              action: workflowMatchingTransition?.action,
            },
          };
        }
        await dispatchAudit({
          resource: config.name,
          recordId: id,
          action: auditAction,
          actorId,
          tenantId: tenancy.isTenancyActive ? String(tenancy.tenantVal) : null,
          diff,
          oldData: auditConfigObj?.includeSnapshots ? sanitizeAuditSnapshot(existingRecord, auditExcludeFields, auditMaskFields, auditMaskString) : null,
          newData: auditConfigObj?.includeSnapshots ? sanitizeAuditSnapshot(record, auditExcludeFields, auditMaskFields, auditMaskString) : null,
          metadata: customMeta,
          ip: getClientIp(c),
          userAgent: getUserAgent(c),
          timestamp: new Date().toISOString(),
        }, c, appContext);
      }

      return c.json({
        success: true,
        data: await finalize(finalRecord as TSelect, appContext, config, c, "detail")
      });
    });
  }

  if (methods.has("delete")) {
    app.delete("/:id", async (c) => {
      const adapter = getAdapter(c);
      const appContext = (globalConfig?.getContext ? await globalConfig.getContext(c) : {}) as AppContext;
      await checkRateLimit(c, appContext);
      const id = c.req.param("id");

      const tenancy = await resolveTenancyContext(c, appContext, adapter);

      // The scope and soft-delete filters are part of the lookup, so a row
      // outside the caller's scope is reported as not found instead of
      // confirming that it exists.
      const recordPredicate = buildRecordPredicate(id, appContext, adapter, tenancy.tenantCondition);

      const existingRecord = await adapter.findFirst(config.table, {
        where: recordPredicate,
      });

      if (!existingRecord) throw ApiError.notFound();

      await checkAccess(appContext, "delete", existingRecord);
      await checkWorkflowParentLock(adapter, existingRecord);

      // Document Workflow: Lock against delete in non-editable states
      if (config.workflow) {
        const statusField = config.workflow.field ?? "status";
        const initialStatus = config.workflow.initial ?? "draft";
        const currentState = existingRecord[statusField] ?? initialStatus;
        const stateConfig = config.workflow.states?.[currentState];
        const defaultEditableStates = config.workflow.editableStates ?? [initialStatus];
        const isEditable = stateConfig ? (stateConfig.editable === true) : defaultEditableStates.includes(currentState);

        if (!isEditable) {
          throw new ApiError(403, "WORKFLOW_LOCKED", `Document in state '${currentState}' is locked and cannot be deleted.`);
        }
      }

      let deletedOutboxEntry: OutboxRecord | undefined;
      await runTransaction(c, async (tx) => {
        const stmts: any[] = [];
        if (config.hooks?.beforeDelete) {
          await config.hooks.beforeDelete(id, c, tx, appContext, stmts);
        }

        if (shouldRecordOutboxEvent("delete")) {
          deletedOutboxEntry = createOutboxEntry(
            "delete",
            id,
            {
              id,
              previous: existingRecord,
              tenantId: tenancy.isTenancyActive ? tenancy.tenantVal : null,
            },
            tenancy.isTenancyActive ? tenancy.tenantVal : null
          );
          await persistOutboxEntry(deletedOutboxEntry, tx, c, appContext);
        }

        if (config.softDelete) {
          await tx.update(config.table, id, { [config.softDelete]: new Date().toISOString() } as any, recordPredicate);
        } else {
          await tx.delete(config.table, id, true, recordPredicate);
        }

        if (config.hooks?.afterDelete) {
          await config.hooks.afterDelete(id, c, tx, appContext);
        }
      });

      if (deletedOutboxEntry) {
        await dispatchWebhooks(deletedOutboxEntry, c, appContext);
      }

      await emitEvent(appContext, "delete", undefined, [id]);
      await invalidateCache();

      if (shouldAuditAction("delete")) {
        const actorId = await resolveActorId(c, appContext);
        let customMeta: Record<string, unknown> | undefined;
        if (auditConfigObj?.metadata) {
          customMeta = await auditConfigObj.metadata(c, appContext, existingRecord as any);
        }
        await dispatchAudit({
          resource: config.name,
          recordId: id,
          action: "delete",
          actorId,
          tenantId: tenancy.isTenancyActive ? String(tenancy.tenantVal) : null,
          diff: [],
          oldData: auditConfigObj?.includeSnapshots ? sanitizeAuditSnapshot(existingRecord, auditExcludeFields, auditMaskFields, auditMaskString) : null,
          newData: null,
          metadata: customMeta,
          ip: getClientIp(c),
          userAgent: getUserAgent(c),
          timestamp: new Date().toISOString(),
        }, c, appContext);
      }

      return c.json({ success: true });
    });
  }

  // Import Engine
  if (config.import && (methods.has("import-preview") || methods.has("import-execute"))) {
    const handleImport = async (c: any, isPreview: boolean) => {
      const adapter = getAdapter(c);
      const appContext = (globalConfig?.getContext ? await globalConfig.getContext(c) : {}) as AppContext;
      await checkRateLimit(c, appContext);
      await checkAccess(appContext, isPreview ? "import-preview" : "import-execute");

      const tenancy = await resolveTenancyContext(c, appContext, adapter);

      let body = await c.req.json();
      if (!Array.isArray(body)) throw new ApiError(400, "INVALID_PAYLOAD", "Import payload must be an array of objects.");

      // The payload is not truncated: a partial import that looks like a
      // complete one is worse than a refused request. The caller is told
      // how many rows it sent and the limit it has to chunk them by.
      const maxRows = config.import?.maxRowsPerRequest ?? 100;
      if (body.length > maxRows) {
        throw new ApiError(
          400,
          "INVALID_PAYLOAD",
          `Import payload has ${body.length} rows, but the limit for '${config.name}' is ${maxRows}. Send the rows in chunks of ${maxRows} or fewer.`,
          { rows: body.length, limit: maxRows }
        );
      }

      const results = {
        creates: [] as any[],
        updates: [] as any[],
        unchanged: [] as any[],
        errors: [] as any[]
      };

      await runTransaction(c, async (tx) => {
        // 1. Hook
        if (config.hooks?.beforeImport) {
          const hooked = await config.hooks.beforeImport(body, c, tx, appContext, { isPreview });
          if (hooked) body = hooked;
        }

        if (body.length === 0) return;

        // 2. Fetch Existing (The Batch Lookup)
        const cols = adapter.getColumns(config.table as any) as any;
        const ops = adapter.getOperators();
        let existingRecords: any[] = [];
        let visibleRecords: any[] = [];
        
        // We do a pre-check to see if ANY rows have valid lookup keys.
        // If not, we skip the DB query entirely to prevent full table scans.
        const hasValidKeys = body.some((row: any) => {
           const lookupConfig = config.import!.lookupBy;
           if (typeof lookupConfig === 'string') return row[lookupConfig] !== undefined;
           if (Array.isArray(lookupConfig) && typeof lookupConfig[0] === 'string') return !(lookupConfig as string[]).some(k => row[k] === undefined);
           if (Array.isArray(lookupConfig) && Array.isArray(lookupConfig[0])) return (lookupConfig as string[][]).some(keys => !keys.some(k => row[k] === undefined));
           return false;
        });

        // The soft-delete filter and the row-level scope — the same two
        // filters the read paths apply. A row that does not match them is not
        // the caller's to write.
        const constraintConditions = buildConstraintConditions(appContext, adapter, tenancy.tenantCondition);

        // The conditions that match the lookup keys of the payload.
        const buildLookupConditions = (cCols: any, ops: any) => {
           return body.map((row: any) => {
              const lookupConfig = config.import!.lookupBy;
              if (typeof lookupConfig === 'string') {
                 if (row[lookupConfig] === undefined) return null;
                 return ops.eq(cCols[lookupConfig], row[lookupConfig]);
              } else if (Array.isArray(lookupConfig) && typeof lookupConfig[0] === 'string') {
                 if ((lookupConfig as string[]).some(k => row[k] === undefined)) return null;
                 return ops.and(...(lookupConfig as string[]).map(k => ops.eq(cCols[k], row[k])));
              } else if (Array.isArray(lookupConfig) && Array.isArray(lookupConfig[0])) {
                 const orConds = (lookupConfig as string[][]).map(keys => {
                     if (keys.some(k => row[k] === undefined)) return null;
                     return ops.and(...keys.map(k => ops.eq(cCols[k], row[k])));
                 }).filter(Boolean);
                 if (orConds.length === 0) return null;
                 return ops.or(...orConds);
              }
              return null;
           }).filter(Boolean);
        };

        if (hasValidKeys) {
           existingRecords = await adapter.findMany(config.table, {
             where: (cCols: any, ops: any) => {
                const rowConditions = buildLookupConditions(cCols, ops);

                return rowConditions.length > 1 ? ops.or(...rowConditions) : rowConditions[0];
             }
           });

           // The same lookup with the soft-delete filter and the row-level
           // scope applied: the rows this caller may write. A row that is in
           // the lookup but not in here matched a key the caller may not
           // touch.
           if (constraintConditions.length > 0) {
              visibleRecords = await adapter.findMany(config.table, {
                where: (cCols: any, ops: any) => {
                   const rowConditions = buildLookupConditions(cCols, ops);
                   const lookup = rowConditions.length > 1 ? ops.or(...rowConditions) : rowConditions[0];

                   return ops.and(lookup, ops.and(...constraintConditions));
                }
              });
           } else {
              visibleRecords = existingRecords;
           }
        }

        const matchesLookup = (er: any, row: any) => {
           const lookupConfig = config.import!.lookupBy;
           if (typeof lookupConfig === 'string') {
              return er[lookupConfig] === row[lookupConfig];
           } else if (Array.isArray(lookupConfig) && typeof lookupConfig[0] === 'string') {
              return (lookupConfig as string[]).every(k => er[k] === row[k]);
           } else if (Array.isArray(lookupConfig) && Array.isArray(lookupConfig[0])) {
              return (lookupConfig as string[][]).some(keys => keys.every(k => er[k] === row[k]));
           }
           return false;
        };

        // The record the import row updates: one the caller may write.
        const findExisting = (row: any) => {
           return visibleRecords.find(er => matchesLookup(er, row));
        };

        // A record the import row matched but may not write — it belongs to
        // somebody else, or it has been soft-deleted.
        const visibleIds = new Set(visibleRecords.map((v: any) => v.id));
        const findForbidden = (row: any) => {
           return existingRecords.find(er => !visibleIds.has(er.id) && matchesLookup(er, row));
        };

        const { create: createValidator, update: updateValidator } = resolveValidators(config.validator);

        const ts = getTimestampFields();
        const stmts: any[] = [];
        const strategy = resolveStrategy(tx);
        const importSeriesTracker = new Map<string, number>();

        for (let i = 0; i < body.length; i++) {
           const rawRow = body[i];
           const existing = findExisting(rawRow);

           // The row matched a record the caller may not write — it belongs
           // to somebody else, or it has been soft-deleted. Updating it would
           // cross the row-level scope, so it is refused instead.
           if (!existing) {
              const forbidden = findForbidden(rawRow);
              if (forbidden) {
                 const reason = config.softDelete && forbidden[config.softDelete] != null
                    ? `Row matches a soft-deleted record.`
                    : `Row matches a record that is outside the caller's scope.`;
                 results.errors.push({ index: i, error: reason });
                 continue;
              }
           }

           const isUpdate = !!existing;

           if (!isUpdate && config.namingSeries) {
              const sField = config.namingSeries.field;
              const allowManual = config.namingSeries.allowManual ?? false;
              if (!allowManual || rawRow[sField] === undefined || rawRow[sField] === null || rawRow[sField] === "") {
                 rawRow[sField] = await generateSeriesNumber(rawRow, appContext, tenancy, tx, importSeriesTracker);
              }
           }

           let validatedRow: any;
           try {
              validatedRow = isUpdate
                 ? await validateWith(updateValidator, rawRow)
                 : await validateWith(createValidator, rawRow);
              await sanitizeWritePayload(validatedRow, appContext, existing);
           } catch (e: any) {
              results.errors.push({ index: i, error: e.issues || e.errors || e.message });
              continue;
           }
           
           if (!isUpdate) {
              // Create
              if (!tenancy.isBypassed && tenancy.isTenancyActive) {
                 if (Array.isArray(tenancy.tenantVal)) {
                    if (validatedRow[tenancy.tenantField] !== undefined) {
                       if (!tenancy.tenantVal.includes(validatedRow[tenancy.tenantField])) {
                          results.errors.push({ index: i, error: `Invalid tenant identifier: ${validatedRow[tenancy.tenantField]}` });
                          continue;
                       }
                    } else if (tenancy.tenantVal.length === 1) {
                       validatedRow[tenancy.tenantField] = tenancy.tenantVal[0];
                    } else {
                       results.errors.push({ index: i, error: `Tenant identifier is ambiguous for row ${i}.` });
                       continue;
                    }
                 } else if (tenancy.tenantVal !== undefined && tenancy.tenantVal !== null) {
                    validatedRow[tenancy.tenantField] = tenancy.tenantVal;
                 }
              }

              if (ts?.created && !validatedRow[ts.created]) validatedRow[ts.created] = new Date().toISOString();
              if (ts?.updated) validatedRow[ts.updated] = new Date().toISOString();
              
              results.creates.push(validatedRow);
              if (!isPreview) {
                 const rowHasRelations = !!config.relations && [
                    ...(config.relations.many || []),
                    ...(config.relations.pivots || [])
                 ].some(r => Array.isArray(rawRow[r.name]));

                 // The foreign key of a child row points at the parent, and the
                 // parent's id is only known once the parent has been inserted.
                 // An id supplied by the client is used as-is; otherwise the
                 // adapter builds a dialect-appropriate expression that
                 // resolves to it when the child is inserted.
                 const batchParentId = rowHasRelations
                    ? (validatedRow.id != null ? validatedRow.id : tx.parentIdExpression?.(config.table))
                    : undefined;

                 if (strategy === "batch" && (!rowHasRelations || batchParentId !== undefined)) {
                    stmts.push(tx.insertStmt(config.table, validatedRow));

                    if (config.relations) {
                      const parentId = batchParentId;
                      if (config.relations.many) {
                        for (const rel of config.relations.many) {
                          if (Array.isArray(rawRow[rel.name])) {
                            for (const child of rawRow[rel.name]) {
                              stmts.push(tx.insertStmt(rel.table, { ...child, [rel.foreignKey]: parentId }));
                            }
                          }
                        }
                      }
                      if (config.relations.pivots) {
                        for (const rel of config.relations.pivots) {
                          if (Array.isArray(rawRow[rel.name])) {
                            for (const item of rawRow[rel.name]) {
                              stmts.push(tx.insertStmt(rel.table, { ...item, [rel.foreignKey]: parentId }));
                            }
                          }
                        }
                      }
                    }
                 } else {
                    const inserted: any = await tx.insert(config.table, validatedRow);
                    if (config.relations) {
                       if (config.relations.many) {
                         for (const rel of config.relations.many) {
                           if (Array.isArray(rawRow[rel.name])) {
                             for (const child of rawRow[rel.name]) {
                               await tx.insert(rel.table, { ...child, [rel.foreignKey]: inserted.id });
                             }
                           }
                         }
                       }
                       if (config.relations.pivots) {
                         for (const rel of config.relations.pivots) {
                           if (Array.isArray(rawRow[rel.name])) {
                             for (const item of rawRow[rel.name]) {
                               await tx.insert(rel.table, { ...item, [rel.foreignKey]: inserted.id });
                             }
                           }
                         }
                       }
                    }
                 }
              }
           } else {
              // Update
              if (!tenancy.isBypassed && tenancy.isTenancyActive && tenancy.tenantField in validatedRow) {
                 const attemptedTenant = validatedRow[tenancy.tenantField];
                 if (attemptedTenant !== undefined) {
                    if (Array.isArray(tenancy.tenantVal)) {
                       if (!tenancy.tenantVal.includes(attemptedTenant)) {
                          results.errors.push({ index: i, error: `Cannot change tenant identifier on row ${i}.` });
                          continue;
                       }
                    } else if (attemptedTenant !== tenancy.tenantVal) {
                       results.errors.push({ index: i, error: `Cannot change tenant identifier on row ${i}.` });
                       continue;
                    }
                 }
                 delete validatedRow[tenancy.tenantField];
              }

              const isUnchanged = Object.keys(validatedRow).every(k => existing[k] === validatedRow[k]);
              if (isUnchanged) {
                 const hasRelations = config.relations && [
                    ...(config.relations.many || []),
                    ...(config.relations.pivots || [])
                 ].some(r => rawRow[r.name] !== undefined);
                 
                 if (!hasRelations) {
                    results.unchanged.push(validatedRow);
                    continue;
                 }
              }

              let expectedVersion: any;
              if (config.versionControl) {
                 const vField = config.versionControl.field;
                 expectedVersion = rawRow[vField];
                 if (expectedVersion === undefined) {
                    results.errors.push({ index: i, error: `Version control field '${vField}' is required for update.` });
                    continue;
                 }
                 validatedRow[vField] = expectedVersion + 1;
              }
              
              if (ts?.updated) validatedRow[ts.updated] = new Date().toISOString();
              
              results.updates.push(validatedRow);
              if (!isPreview) {
                 const idCol = (cols as any).id;

                 // The row's id, the version it is expected to be at, and the
                 // soft-delete filter and the row-level scope — so that a row
                 // that stops matching between the lookup and the write is
                 // not written.
                 const updateConditions: any[] = [ops.eq(idCol, existing.id as any)];
                 if (config.versionControl) {
                    const vField = config.versionControl.field;
                    updateConditions.push(ops.eq(tx.getColumn(config.table as any, vField), expectedVersion));
                 }
                 if (constraintConditions.length > 0) {
                    updateConditions.push(ops.and(...constraintConditions));
                 }

                 // The statement builder already filters on the row's id; the
                 // version and the constraints are added on top.
                 const buildUpdateStatement = () => {
                    const statement = tx.updateStmt(config.table, existing.id, validatedRow);
                    return updateConditions.length > 1 ? statement.where(ops.and(...updateConditions)) : statement;
                 };

                 if (strategy === "batch") {
                    const updateStmt: any = buildUpdateStatement();
                    stmts.push(updateStmt);
                    
                    if (config.relations) {
                       if (config.relations.many) {
                          for (const rel of config.relations.many) {
                             if (Array.isArray(rawRow[rel.name])) {
                                const relStmts = await syncRelations(tx, rel, existing.id, rawRow[rel.name], false);
                                stmts.push(...relStmts);
                             }
                          }
                       }
                       if (config.relations.pivots) {
                          for (const rel of config.relations.pivots) {
                             if (Array.isArray(rawRow[rel.name])) {
                                const relStmts = await syncRelations(tx, rel, existing.id, rawRow[rel.name], true);
                                stmts.push(...relStmts);
                             }
                          }
                       }
                    }
                 } else {
                    const updateQuery: any = buildUpdateStatement();
                    const res = await updateQuery;
                    const updatedRec = Array.isArray(res) ? res[0] : res;
                    if (config.versionControl && !updatedRec) throw new ApiError(409, "OCC_FAILED", `OCC failed at row ${i}.`);
                    
                    if (config.relations) {
                       if (config.relations.many) {
                          for (const rel of config.relations.many) {
                             if (Array.isArray(rawRow[rel.name])) {
                                const relStmts = await syncRelations(tx, rel, existing.id, rawRow[rel.name], false);
                                for (const stmt of relStmts) await stmt;
                             }
                          }
                       }
                       if (config.relations.pivots) {
                          for (const rel of config.relations.pivots) {
                             if (Array.isArray(rawRow[rel.name])) {
                                const relStmts = await syncRelations(tx, rel, existing.id, rawRow[rel.name], true);
                                for (const stmt of relStmts) await stmt;
                             }
                          }
                       }
                    }
                 }
              }
           }
        }

        if (!isPreview && stmts.length > 0 && strategy === "batch") {
           await tx.batch(stmts);
        }

        if (config.hooks?.afterImport) {
           await config.hooks.afterImport(results, c, tx, appContext, { isPreview });
        }
      });

      if (!isPreview && (results.creates.length > 0 || results.updates.length > 0)) {
         await emitEvent(appContext, "import", results);
         await invalidateCache();
      }

      return c.json({ success: true, results });
    };

    if (methods.has("import-preview")) {
       app.post("/import/preview", (c) => handleImport(c, true));
    }
    if (methods.has("import-execute")) {
       app.post("/import/execute", (c) => handleImport(c, false));
    }
  }

  // Custom Actions
  if (config.actions) {
    for (const action of config.actions) {
      app[action.method](action.path, async (c) => {
        // Resolve the adapter early, so a missing one is reported before any
        // work is done.
        getAdapter(c);
      const appContext = (globalConfig?.getContext ? await globalConfig.getContext(c) : {}) as AppContext;
        await checkRateLimit(c, appContext);
        let validatedData = undefined;

        if (action.validator) {
          const body = await c.req.json();
          validatedData = await validateWith(action.validator, body);
        }

        const result = await action.handler(c, appContext, validatedData);
        return c.json({ success: true, data: result });
      });
    }
  }

  /**
   * Answers a request that no route of this resource handled.
   *
   * A path that is not registered under the resource — `/posts/1/2`, or a
   * collection whose `list` method is switched off — used to fall through to
   * Hono's default not-found handler, which answers with a bare
   * `404 Not Found` text body. The very same failure on a registered path
   * (a record that does not exist) answered with the error envelope, so a
   * client parsing that envelope got a parse error instead of a structured
   * error.
   *
   * The handler calls `next()` first, so a route the application registered
   * under the resource's path still wins, and a not-found handler the
   * application installed itself is left alone.
   */
  app.all("*", async (c, next) => {
    await next();

    // Something answered the request — keep that response.
    if (c.finalized && !(await isDefaultNotFound(c.res))) {
      return c.res;
    }

    const response = c.json(
      errorBody(
        new ApiError(404, "NOT_FOUND", "Not Found", {
          path: c.req.path,
          method: c.req.method,
        })
      ),
      404
    );

    // Assigning the response to `c.res` as well keeps it in place when the
    // handler chain already produced a response of its own.
    c.res = response;

    return c.res;
  });

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      if (err.headers) {
        for (const [k, v] of Object.entries(err.headers)) {
          c.header(k, v);
        }
      }
      return c.json(errorBody(err), err.status);
    }
    if (err instanceof ValidationError) {
       return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: err.message, details: err.issues } }, 400);
    }
    if (err.name === "ZodError") {
       return c.json(errorBody({ code: "VALIDATION_ERROR", message: "Validation failed", details: (err as any).issues }), 400);
    }

    // Use the framework logger for unexpected errors
    globalConfig?.logger?.error("Internal Error:", err);

    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Internal Server Error", debug: err.message } }, 500);
  });

  (app as any)[RESOURCE_CONFIG] = config;
  return app;
}

export function defineApi<Env extends Record<string, unknown> = Record<string, unknown>>(
  resources: Record<string, Hono<any>>,
  versionOrOptions?: string | ApiOptions
) {
  let version: string | undefined;
  let docsConfig: OpenApiDocsConfig | undefined;

  if (typeof versionOrOptions === "string") {
    version = versionOrOptions;
  } else if (versionOrOptions && typeof versionOrOptions === "object") {
    version = versionOrOptions.version;
    if (typeof versionOrOptions.docs === "object") {
      docsConfig = { enabled: true, ...versionOrOptions.docs };
    } else if (versionOrOptions.docs === true) {
      docsConfig = { enabled: true };
    }
  }

  const api = new Hono<{ Bindings: Env }>();
  
  for (const [path, resourceApp] of Object.entries(resources)) {
    api.route(`/${path}`, resourceApp);
  }

  // OpenAPI & Scalar Documentation Engine (Lazy Evaluation)
  if (docsConfig && docsConfig.enabled !== false) {
    const docsPath = (docsConfig.path || "/docs").replace(/\/+$/, "");
    const specPath = (docsConfig.specPath || "/openapi.json").replace(/\/+$/, "");

    let cachedSpec: Record<string, any> | null = null;
    const getSpec = () => {
      if (!cachedSpec) {
        cachedSpec = generateOpenApiSpec(resources, {
          title: docsConfig?.title || "HonoCube API",
          version: docsConfig?.version || version || "2.0.2",
          description: docsConfig?.description,
          include: docsConfig?.include,
        });
      }
      return cachedSpec;
    };

    // Serve raw OpenAPI 3.1 JSON spec
    api.get(specPath, (c) => {
      return c.json(getSpec());
    });

    // Serve interactive Scalar Documentation UI
    api.get(docsPath, (c) => {
      const fullSpecUrl = docsConfig?.specUrl || (version ? `/${version}${specPath}` : specPath);
      return c.html(renderScalarDocsHtml(fullSpecUrl, docsConfig?.title || "HonoCube API Documentation"));
    });
  }

  const apiConfig = { resources, version };

  if (version) {
    const versionedApi = new Hono<{ Bindings: Env }>();
    versionedApi.route(`/${version}`, api);
    (versionedApi as any)[API_CONFIG] = apiConfig;
    return versionedApi;
  }
  
  (api as any)[API_CONFIG] = apiConfig;
  return api;
}
