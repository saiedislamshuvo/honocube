import type { Context, MiddlewareHandler } from "hono";
import type { DatabaseAdapter, DatabaseStrategy } from "./adapters/base.js";

export type ApiErrorStatus = 400 | 401 | 403 | 404 | 409 | 429 | 500;

/**
 * The Standard Schema interface (version 1).
 *
 * Zod 3.25+, Zod 4, Valibot and ArkType all implement it, so a validator
 * written with any of them can be handed to the framework. The framework
 * checks the protocol instead of the constructor: an `instanceof` check
 * breaks as soon as two copies of the same library end up in the dependency
 * tree, and it would tie the framework to a single validation library.
 *
 * The interface is declared here rather than imported from
 * `@standard-schema/spec` so that the published package keeps no dependency
 * on a validation library.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}

export declare namespace StandardSchemaV1 {
  interface Props<Input = unknown, Output = Input> {
    /** The version number of the standard. */
    readonly version: 1;
    /** The vendor name of the schema library. */
    readonly vendor: string;
    /** Inferred types associated with the schema. */
    readonly types?: Types<Input, Output> | undefined;
    /** Validates an unknown input value. */
    readonly validate: (
      value: unknown,
      options?: { libraryOptions?: Record<string, unknown> | undefined } | undefined
    ) => Result<Output> | Promise<Result<Output>>;
  }

  interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }

  type Result<Output> = SuccessResult<Output> | FailureResult;

  interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }

  interface FailureResult {
    readonly issues: ReadonlyArray<Issue>;
  }

  interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }

  interface PathSegment {
    readonly key: PropertyKey;
  }

  type InferInput<Schema extends StandardSchemaV1> = NonNullable<Schema["~standard"]["types"]>["input"];
  type InferOutput<Schema extends StandardSchemaV1> = NonNullable<Schema["~standard"]["types"]>["output"];
}

/**
 * Helper to infer the select type from a table (Drizzle compatible)
 */
export type InferSelect<T> = T extends { $inferSelect: infer S } ? S : unknown;

/**
 * Helper to infer the insert type from a table (Drizzle compatible)
 */
export type InferInsert<T> = T extends { $inferInsert: infer I } ? I : unknown;

export interface ResourceHooks<
  TSelect = unknown,
  TInsert = unknown,
  Env extends Record<string, unknown> = Record<string, unknown>,
  AppContext = any
> {
  beforeFetch?: (c: Context<{ Bindings: Env }>, params: { list?: boolean; detailId?: string | number; slug?: string }, appContext: AppContext) => Promise<void> | void;
  afterFetch?: (rows: TSelect[], c: Context<{ Bindings: Env }>, appContext: AppContext) => Promise<TSelect[]> | TSelect[];
  beforeCreate?: (data: TInsert, c: Context<{ Bindings: Env }>, tx: DatabaseAdapter<any, any, any>, appContext: AppContext, batchStmts?: any[]) => Promise<TInsert | void> | TInsert | void;
  afterCreate?: (record: TSelect, c: Context<{ Bindings: Env }>, tx: DatabaseAdapter<any, any, any>, appContext: AppContext) => Promise<void> | void;
  beforeUpdate?: (id: string | number, data: Partial<TInsert>, c: Context<{ Bindings: Env }>, tx: DatabaseAdapter<any, any, any>, appContext: AppContext, batchStmts?: any[]) => Promise<Partial<TInsert> | void> | Partial<TInsert> | void;
  afterUpdate?: (record: TSelect, c: Context<{ Bindings: Env }>, tx: DatabaseAdapter<any, any, any>, appContext: AppContext) => Promise<void> | void;
  beforeDelete?: (id: string | number, c: Context<{ Bindings: Env }>, tx: DatabaseAdapter<any, any, any>, appContext: AppContext, batchStmts?: any[]) => Promise<void> | void;
  afterDelete?: (id: string | number, c: Context<{ Bindings: Env }>, tx: DatabaseAdapter<any, any, any>, appContext: AppContext) => Promise<void> | void;
  
  // Batch Hooks
  beforeBatchUpdate?: (ids: (string | number)[], data: Partial<TInsert>, c: Context<{ Bindings: Env }>, tx: DatabaseAdapter<any, any, any>, appContext: AppContext, batchStmts?: any[]) => Promise<{ ids: (string | number)[], data: Partial<TInsert> } | void> | { ids: (string | number)[], data: Partial<TInsert> } | void;
  afterBatchUpdate?: (ids: (string | number)[], c: Context<{ Bindings: Env }>, tx: DatabaseAdapter<any, any, any>, appContext: AppContext) => Promise<void> | void;
  beforeBatchDelete?: (ids: (string | number)[], c: Context<{ Bindings: Env }>, tx: DatabaseAdapter<any, any, any>, appContext: AppContext, batchStmts?: any[]) => Promise<(string | number)[] | void> | (string | number)[] | void;
  afterBatchDelete?: (ids: (string | number)[], c: Context<{ Bindings: Env }>, tx: DatabaseAdapter<any, any, any>, appContext: AppContext) => Promise<void> | void;

  // Import Hooks
  beforeImport?: (rows: any[], c: Context<{ Bindings: Env }>, tx: DatabaseAdapter<any, any, any>, appContext: AppContext, params: { isPreview: boolean }) => Promise<any[]> | any[];
  afterImport?: (results: { creates: any[]; updates: any[]; unchanged: any[]; errors: any[] }, c: Context<{ Bindings: Env }>, tx: DatabaseAdapter<any, any, any>, appContext: AppContext, params: { isPreview: boolean }) => Promise<void> | void;
}

export interface AppLogger {
  info: (message: string, ...meta: any[]) => void;
  warn: (message: string, ...meta: any[]) => void;
  error: (message: string, error?: any, ...meta: any[]) => void;
  debug: (message: string, ...meta: any[]) => void;
}

export interface AppCache {
  get: (key: string) => any | Promise<any>;
  set: (key: string, value: any, ttl?: number) => void | Promise<void>;
  delete: (key: string) => void | Promise<void>;
  clear: (prefix: string) => void | Promise<void>;
}

export interface RateLimiter {
  check: (key: string, limit: number, window: string) => boolean | Promise<boolean>;
}

export interface AppStorage {
  upload: (file: any, options: { folder?: string; name: string }) => Promise<string>;
  delete: (path: string) => Promise<void>;
}

export interface ResourceEvent<AppContext = any> {
  type: "create" | "update" | "delete" | "batch-update" | "batch-delete" | "import";
  resource: string;
  data?: any;
  ids?: (string | number)[];
  appContext: AppContext;
}

export type TenantId = string | number;
export type TenancyValue = TenantId | TenantId[] | null | undefined;

export interface TenancyConfig<
  Env extends Record<string, unknown> = Record<string, unknown>,
  AppContext = any
> {
  /**
   * Column name on database tables holding the tenant/organization identifier.
   * Default: "tenantId"
   */
  field?: string;

  /**
   * Resolves the active tenant ID from request context.
   * Can return:
   * - A single string/number (single tenant)
   * - An array of strings/numbers (holding company / multiple orgs)
   * - `null` / `undefined` (unauthenticated / missing tenant)
   */
  resolve: (
    c: Context<{ Bindings: Env }>,
    appContext: AppContext
  ) => Promise<TenancyValue> | TenancyValue;

  /**
   * Whether to enforce tenancy. When true (default), any request where tenant
   * resolution returns null/undefined is rejected with 400 TENANT_REQUIRED (unless bypassed).
   * Default: true
   */
  enforce?: boolean | ((c: Context<{ Bindings: Env }>, appContext: AppContext) => boolean);

  /**
   * Custom predicate to determine whether the current request is allowed to bypass
   * tenant isolation (e.g. for superadmin global views).
   */
  bypass?: (
    c: Context<{ Bindings: Env }>,
    appContext: AppContext
  ) => Promise<boolean> | boolean;

  /**
   * Custom error message when tenant resolution fails.
   */
  errorMessage?: string;
}

export interface ResourceTenancyConfig {
  /**
   * Column name on this resource's table for tenant identification (overrides global default).
   */
  field?: string;
  /**
   * When true, skips tenancy enforcement and filtering for this resource (shared/global table).
   */
  skip?: boolean;
}


export interface ScopedWithConfig {
  /**
   * Relations to load on list queries (`GET /`).
   * Set to `false` to disable relation joins on list queries.
   */
  list?: Record<string, any> | false;

  /**
   * Relations to load on detail queries (`GET /:id`).
   * Also serves as the default fallback for `slug` queries and mutation reloads unless overridden.
   */
  detail?: Record<string, any> | false;

  /**
   * Relations to load on slug queries (`GET /:slugField/:value`).
   * Defaults to `detail` if omitted. Set to `false` to disable relation joins on slug queries.
   */
  slug?: Record<string, any> | false;
}

export type ResourceWithConfig = Record<string, any> | ScopedWithConfig;


export type FieldRule<AppContext = any, TRecord = any> = {
  /**
   * Controls read access for this field.
   * - `true`: anyone authorized to access the resource can read the field.
   * - `false`: field is hidden/stripped from all read responses.
   * - `string[]`: allowed roles (matched against `auth.getRole` or context role).
   * - `string`: required permission name (evaluated via `auth.can`).
   * - `(appContext: AppContext, record: TRecord) => boolean | Promise<boolean>`: dynamic ownership/predicate function.
   */
  read?: boolean | string | string[] | ((appContext: AppContext, record: TRecord) => boolean | Promise<boolean>);

  /**
   * Optional masking replacement when read access is denied.
   * If omitted, the field is stripped completely from the response.
   * - `string`: static replacement string (e.g. `"***"`).
   * - `(val: any) => any`: dynamic masking function (e.g. `(v) => \`***\${v.slice(-4)}\``).
   */
  mask?: string | ((value: any) => any);

  /**
   * Controls write access for this field on `create`, `update`, `batch-update`, and `import`.
   * - `true`: anyone authorized to access the resource can write the field.
   * - `false`: field cannot be written by clients.
   * - `string[]`: allowed roles.
   * - `string`: required permission name.
   * - `(appContext: AppContext, record?: TRecord) => boolean | Promise<boolean>`: dynamic predicate function.
   */
  write?: boolean | string | string[] | ((appContext: AppContext, record?: TRecord) => boolean | Promise<boolean>);
};

export type FieldViolationStrategy = "strip" | "reject";

export type ComputedFieldResolver<TRecord = any, AppContext = any, TResult = any> = (
  record: TRecord,
  c?: Context,
  appContext?: AppContext
) => TResult | Promise<TResult>;

export interface ComputedFieldConfig<TRecord = any, AppContext = any, TResult = any> {
  /**
   * The calculation function to produce the virtual field value.
   * Can be synchronous or asynchronous.
   */
  resolve: ComputedFieldResolver<TRecord, AppContext, TResult>;

  /**
   * Optional restriction on which methods evaluate this computed field.
   * - `["detail"]`: only evaluated on single-record lookups (detail, slug, update response).
   * - `["list"]`: only evaluated on list queries.
   * Defaults to evaluating on all read methods (`["list", "detail"]`).
   */
  methods?: ("list" | "detail")[];

  /**
   * Fallback value returned if the resolver throws an error.
   * If omitted, errors are logged and the field value falls back to null.
   */
  fallback?: any;

  /**
   * Optional description for documentation or schema introspection.
   */
  description?: string;
}

export type ComputedFieldDefinition<TRecord = any, AppContext = any, TResult = any> =
  | ComputedFieldResolver<TRecord, AppContext, TResult>
  | ComputedFieldConfig<TRecord, AppContext, TResult>;

export type MethodRoles = {
  list?: string[];
  detail?: string[];
  create?: string[];
  update?: string[];
  delete?: string[];
  "batch-update"?: string[];
  "batch-delete"?: string[];
  "import-preview"?: string[];
  "import-execute"?: string[];
};

export interface NamingSeriesCounter {
  getNext: (prefix: string, tenantId?: string, tx?: any) => Promise<number> | number;
}

export interface NamingSeriesConfig<AppContext = any, _TRecord = any> {
  /**
   * The column name where the generated sequence is saved.
   * e.g. "code", "invoiceNumber", "orderNumber"
   */
  field: string;

  /**
   * Pattern template or dynamic pattern selector function.
   * Examples:
   * - "INV-{YYYY}-{#####}" -> "INV-2026-00001"
   * - "PO-{YY}-{MM}-{####}" -> "PO-26-11-0001"
   * - "DOC-{#####}" -> "DOC-00001"
   * - (ctx, data) => data.isExport ? "EXP-{YYYY}-{#####}" : "INV-{YYYY}-{#####}"
   */
  pattern: string | ((appContext: AppContext, data: any) => string | Promise<string>);

  /**
   * Whether to allow the client to manually supply a value.
   * - `false` (default): Any client-provided value is overridden with the generated sequence.
   * - `true`: Generates sequence only if the client omitted the field.
   */
  allowManual?: boolean;

  /**
   * Optional custom sequence provider or counter store.
   * If omitted, Honocube manages the sequence automatically.
   */
  counter?: NamingSeriesCounter;
}

export interface WorkflowStateConfig {
  /**
   * Whether all fields can be edited in this state.
   * If true, regular updates are permitted.
   * If false or omitted, only fields in `allowFields` can be updated.
   */
  editable?: boolean;

  /**
   * Whitelist of fields permitted to be modified in this state.
   * If empty and editable is not true, document is locked against field modifications.
   */
  allowFields?: string[];

  /**
   * Roles authorized to perform updates when the document is in this state.
   */
  roles?: string[];
}

export interface WorkflowParentLockConfig<TTable = unknown> {
  /**
   * Parent database table.
   */
  table: TTable;

  /**
   * Foreign key column on the child table pointing to the parent document.
   */
  foreignKey: string;

  /**
   * Primary or unique reference key column on the parent table.
   * Defaults to "id".
   */
  referenceKey?: string;

  /**
   * Column storing the workflow status on the parent table.
   * Defaults to "status".
   */
  field?: string;

  /**
   * Initial status on the parent table if undefined.
   * Defaults to "draft".
   */
  initial?: string;

  /**
   * States of the parent document where child modifications and deletions are permitted.
   * Defaults to ["draft"].
   */
  editableStates?: string[];
}

export interface WorkflowRelationLockConfig {
  /**
   * Name of the relation (from relations.many) to lock.
   */
  relation: string;

  /**
   * Parent states in which the child records are allowed to be modified or deleted.
   * Defaults to the parent workflow's editableStates.
   */
  editableStates?: string[];
}

export interface WorkflowCascadeConfig<AppContext = any, TRecord = any> {
  /**
   * Name of the relation (from relations.many) to cascade updates to.
   */
  relation: string;

  /**
   * Fields to update on the related child records.
   * Can be an object or a function returning fields.
   */
  set:
    | Record<string, unknown>
    | ((appContext: AppContext, record: TRecord) => Record<string, unknown> | Promise<Record<string, unknown>>);
}

export interface WorkflowChildRequirement<AppContext = any, TRecord = any> {
  /**
   * Name of the relation (from relations.many) to validate.
   */
  relation: string;

  /**
   * Minimum count of child records required for the transition.
   */
  minCount?: number;

  /**
   * Maximum count of child records allowed for the transition.
   */
  maxCount?: number;

  /**
   * Field criteria that every child record must match (e.g. { status: "ready" }).
   */
  match?: Record<string, unknown>;

  /**
   * Custom validator callback for child records.
   */
  validate?: (children: any[], appContext: AppContext, parentRecord: TRecord) => boolean | string | Promise<boolean | string>;
}

export interface WorkflowTransition<AppContext = any, TRecord = any> {
  /**
   * Source state(s) allowed for this transition.
   * Can be a single state string, an array of states, or "*" for any state.
   */
  from: string | string[];

  /**
   * Target state for this transition.
   */
  to: string;

  /**
   * Optional action name/identifier for the transition (e.g. "submit", "approve", "reject").
   */
  action?: string;

  /**
   * Roles authorized to execute this transition.
   */
  roles?: string[];

  /**
   * Permission name evaluated via auth.can.
   */
  permission?: string;

  /**
   * Dynamic business rule callback (e.g. preventing self-approval).
   */
  guard?: (appContext: AppContext, record: TRecord) => boolean | Promise<boolean>;

  /**
   * Fields automatically assigned on transition.
   * Can be an object or a function returning fields.
   * e.g. (ctx) => ({ approvedBy: ctx.userId, approvedAt: new Date().toISOString() })
   */
  fields?: Record<string, any> | ((appContext: AppContext, record: TRecord) => Record<string, any> | Promise<Record<string, any>>);

  /**
   * Declarative child record validations before executing this transition.
   */
  requireChildren?: WorkflowChildRequirement<AppContext, TRecord>[];

  /**
   * Declarative cascades to update related child records upon transition.
   */
  cascade?: WorkflowCascadeConfig<AppContext, TRecord>[];
}

export interface WorkflowConfig<AppContext = any, TRecord = any> {
  /**
   * Column storing the document state.
   * Defaults to "status".
   */
  field?: string;

  /**
   * Initial state assigned when a record is created.
   * Defaults to "draft".
   */
  initial?: string;

  /**
   * States where all regular field updates and deletes are permitted.
   * Defaults to [initial] (e.g. ["draft"]).
   */
  editableStates?: string[];

  /**
   * Fine-grained per-state field editing rules.
   */
  states?: Record<string, WorkflowStateConfig>;

  /**
   * Allowed state transitions.
   */
  transitions: WorkflowTransition<AppContext, TRecord>[];

  /**
   * Relations that inherit the parent document's lock status.
   * When the parent document is in a non-editable state, child records belonging
   * to this parent cannot be modified or deleted.
   */
  lockRelations?: Array<string | WorkflowRelationLockConfig>;

  /**
   * Direct parent lock configuration for child resources.
   * Locks this resource against updates and deletions when the referenced parent document is in a non-editable state.
   */
  parentLock?: WorkflowParentLockConfig;

  /**
   * Optional lifecycle hooks.
   */
  hooks?: {
    beforeTransition?: (
      transition: { from: string; to: string; action?: string },
      record: TRecord,
      c: Context,
      tx: any,
      appContext: AppContext
    ) => Promise<boolean | void | Record<string, any>>;

    afterTransition?: (
      transition: { from: string; to: string; action?: string },
      record: TRecord,
      c: Context,
      tx: any,
      appContext: AppContext
    ) => Promise<void>;
  };
}

export interface AuditFieldDiff {
  field: string;
  from: unknown;
  to: unknown;
}

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "batch-update"
  | "batch-delete"
  | "transition";

export interface AuditEntry<_AppContext = any> {
  id?: string | number;
  resource: string;
  recordId: string | number;
  action: AuditAction;
  actorId?: string | number | null;
  tenantId?: string | number | null;
  diff?: AuditFieldDiff[];
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
  timestamp: string;
}

export interface AuditConfig<AppContext = any, TRecord = any> {
  /**
   * Whether auditing is enabled for this resource. Defaults to true if audit config is defined.
   */
  enabled?: boolean;

  /**
   * Actions to audit. Defaults to all actions ("create", "update", "delete", "batch-update", "batch-delete", "transition").
   */
  actions?: AuditAction[];

  /**
   * Fields to exclude entirely from diffs and snapshots (e.g. "password", "token").
   */
  excludeFields?: string[];

  /**
   * Fields whose values should be masked in diffs (e.g. "creditCard").
   */
  maskFields?: string[];

  /**
   * Mask replacement string. Defaults to "********".
   */
  maskString?: string;

  /**
   * Whether to include full oldData and newData snapshots in the audit entry.
   * Defaults to false (diff-only).
   */
  includeSnapshots?: boolean;

  /**
   * Custom metadata callback to enrich the audit entry.
   */
  metadata?: (
    c: Context,
    appContext: AppContext,
    record?: TRecord
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;
}

export interface AppAuditConfig<
  Env extends Record<string, unknown> = Record<string, unknown>,
  AppContext = any
> {
  /**
   * Database table used to store audit log entries.
   */
  table?: any;

  /**
   * Custom sink / handler to persist or dispatch audit entries.
   */
  store?: (
    entry: AuditEntry<AppContext>,
    c: Context<{ Bindings: Env }>,
    appContext: AppContext
  ) => Promise<void> | void;

  /**
   * Resolves the actor identifier from the application context.
   * Defaults to checking appContext.userId ?? appContext.user?.id ?? appContext.actorId.
   */
  getActorId?: (
    appContext: AppContext,
    c: Context<{ Bindings: Env }>
  ) => string | number | null | undefined | Promise<string | number | null | undefined>;

  /**
   * Global fields to exclude from audit diffs across all resources.
   */
  excludeFields?: string[];

  /**
   * Global fields to mask in audit diffs across all resources.
   */
  maskFields?: string[];

  /**
   * Mask replacement string. Defaults to "********".
   */
  maskString?: string;

  /**
   * Execution mode: "async" (non-blocking via c.executionCtx.waitUntil or background promise)
   * or "sync" (awaited before sending HTTP response).
   * Defaults to "async".
   */
  mode?: "async" | "sync";
}

export type OutboxEvent =
  | "create"
  | "update"
  | "delete"
  | "batch-update"
  | "batch-delete"
  | "transition"
  | string;

export type OutboxStatus = "pending" | "processing" | "delivered" | "failed";

export interface OutboxRecord<TPayload = any> {
  id: string;
  resource: string;
  recordId: string | number;
  event: OutboxEvent;
  payload: TPayload;
  headers?: Record<string, string>;
  tenantId?: string | number | null;
  status: OutboxStatus;
  attempts: number;
  lastError?: string | null;
  nextRetryAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface ResourceOutboxConfig {
  /**
   * Whether outbox recording is enabled for this resource. Defaults to true if outbox config is defined.
   */
  enabled?: boolean;

  /**
   * Actions / events to record in the outbox. Defaults to all mutation events ("create", "update", "delete", "batch-update", "batch-delete", "transition").
   */
  events?: OutboxEvent[];
}

export interface AppOutboxConfig<
  Env extends Record<string, unknown> = Record<string, unknown>,
  AppContext = any
> {
  /**
   * Database table used to store outbox event entries.
   */
  table?: any;

  /**
   * Custom transactional sink / handler to persist or handle outbox records.
   * Invoked within the active transaction adapter.
   */
  sink?: (
    record: OutboxRecord,
    tx: DatabaseAdapter<any, any, any>,
    c: Context<{ Bindings: Env }>,
    appContext: AppContext
  ) => Promise<void> | void;

  /**
   * Whether to automatically dispatch webhooks immediately after transaction commit.
   * Defaults to true if webhook endpoints are configured.
   */
  autoDispatch?: boolean;

  /**
   * Whether outbox recording is enabled by default for all resources when outbox table/sink is configured.
   * Defaults to true.
   */
  enabledByDefault?: boolean;
}

export interface WebhookEndpointConfig {
  /**
   * Webhook subscriber destination URL.
   */
  url: string;

  /**
   * Cryptographic secret key used to compute the HMAC-SHA256 signature.
   */
  secret: string;

  /**
   * Events to subscribe to. Supports exact matches ("orders.create", "orders.transition"),
   * wildcards ("orders.*", "*"), or bare action names ("create", "update").
   * Defaults to ["*"] (all events).
   */
  events?: string[];

  /**
   * Optional custom HTTP headers to include with the webhook POST request.
   */
  headers?: Record<string, string>;

  /**
   * Optional synchronous or asynchronous predicate filter. If returns false, delivery is skipped.
   */
  filter?: (record: OutboxRecord) => boolean | Promise<boolean>;

  /**
   * Whether this endpoint is temporarily disabled.
   */
  disabled?: boolean;
}

export interface WebhookDeliveryRecord {
  id: string;
  outboxId?: string;
  endpointUrl: string;
  event: string;
  attempt: number;
  statusCode?: number | null;
  durationMs: number;
  error?: string | null;
  requestHeaders?: Record<string, string>;
  requestPayload?: any;
  responseBody?: string | null;
  timestamp: string;
}

export interface AppWebhookConfig<
  Env extends Record<string, unknown> = Record<string, unknown>,
  AppContext = any
> {
  /**
   * Registered webhook subscriber endpoints, or a function resolving them from context.
   */
  endpoints?:
    | WebhookEndpointConfig[]
    | ((c: Context<{ Bindings: Env }>, appContext: AppContext) => WebhookEndpointConfig[] | Promise<WebhookEndpointConfig[]>);

  /**
   * Maximum timestamp drift tolerance in seconds for signature verification.
   * Defaults to 300 (5 minutes).
   */
  toleranceSeconds?: number;

  /**
   * Maximum delivery retry attempts for failed requests. Defaults to 3.
   */
  maxAttempts?: number;

  /**
   * Base retry backoff in milliseconds. Defaults to 1000ms.
   */
  retryBackoffMs?: number;

  /**
   * Custom fetch function (useful for testing or custom proxies/transports).
   */
  fetch?: typeof fetch;

  /**
   * Optional database table used to log webhook delivery attempts and responses.
   */
  deliveryTable?: any;

  /**
   * Optional custom sink / callback to store or report webhook delivery attempts.
   */
  deliverySink?: (
    delivery: WebhookDeliveryRecord,
    c: Context<{ Bindings: Env }>,
    appContext: AppContext
  ) => Promise<void> | void;

  /**
   * Dispatch mode: "async" (non-blocking via c.executionCtx.waitUntil or background promise)
   * or "sync" (awaited before sending HTTP response).
   * Defaults to "async".
   */
  mode?: "async" | "sync";
}

export interface VerifyWebhookSignatureOptions {
  /**
   * Maximum allowed timestamp drift in seconds. Defaults to 300.
   * Set to 0 or Infinity to disable timestamp check.
   */
  toleranceSeconds?: number;

  /**
   * Current timestamp in seconds (defaults to Math.floor(Date.now() / 1000)).
   */
  now?: number;
}

export interface VerifyWebhookSignatureResult {
  valid: boolean;
  reason?:
    | "MISSING_HEADER"
    | "MALFORMED_HEADER"
    | "MISSING_SIGNATURE"
    | "MISSING_TIMESTAMP"
    | "TIMESTAMP_EXPIRED"
    | "INVALID_SIGNATURE";
  timestamp?: number;
  signature?: string;
}

export interface AppConfig<Env extends Record<string, unknown> = Record<string, unknown>, AppContext = any> {
  adapter: DatabaseAdapter<any, any, any> | ((c: Context<{ Bindings: Env }>) => DatabaseAdapter<any, any, any>);
  strategy?: DatabaseStrategy; // "batch" | "transaction" | "none"
  middleware?: MiddlewareHandler<{ Bindings: Env }>[];
  schema?: Record<string, any>; // Global schema for convenience
  logger?: AppLogger; // Global framework logger
  cache?: AppCache; // Global cache provider
  rateLimiter?: RateLimiter; // Global rate limiter
  storage?: AppStorage; // Global storage provider
  mediaBaseUrl?: string; // e.g., 'https://cdn.example.com/'
  onEvent?: (event: ResourceEvent<AppContext>) => Promise<void> | void;
  getContext?: (c: Context<{ Bindings: Env }>) => Promise<AppContext> | AppContext;
  tenancy?: TenancyConfig<Env, AppContext>;
  auth?: {
    can?: (appContext: AppContext, permission: string, record?: any) => boolean | Promise<boolean>;
    getRole?: (appContext: AppContext) => string | string[] | null | undefined | Promise<string | string[] | null | undefined>;
  };
  namingSeries?: {
    counter?: NamingSeriesCounter;
  };
  audit?: AppAuditConfig<Env, AppContext>;
  outbox?: AppOutboxConfig<Env, AppContext>;
  webhooks?: AppWebhookConfig<Env, AppContext>;
}

export interface ResourceConfig<
  TTable = unknown,
  TSelect = InferSelect<TTable>,
  TInsert = InferInsert<TTable>,
  Env extends Record<string, unknown> = Record<string, unknown>,
  AppContext = any
> {
  name: string;
  queryKey?: string;
  table: TTable;
  schema?: Record<string, any>; // Scoped schema for performance
  adapter?: DatabaseAdapter<TTable, TSelect, TInsert> | ((c: Context<{ Bindings: Env }>) => DatabaseAdapter<TTable, TSelect, TInsert>);
  validator:
    | StandardSchemaV1<unknown, TInsert>
    | [StandardSchemaV1<unknown, TInsert>, StandardSchemaV1<unknown, any>]
    | { create: StandardSchemaV1<unknown, TInsert>; update: StandardSchemaV1<unknown, any> };
  
  // Enterprise Features
  middleware?: MiddlewareHandler<{ Bindings: Env }>[];
  methods?: ("list" | "detail" | "create" | "update" | "delete" | "batch-update" | "batch-delete" | "import-preview" | "import-execute")[];
  softDelete?: string; 
  slugs?: string[];
  tenancy?: boolean | ResourceTenancyConfig;
  roles?: string[] | MethodRoles;
  fields?: Record<string, FieldRule<AppContext, TSelect>>;
  fieldViolationStrategy?: FieldViolationStrategy;
  namingSeries?: NamingSeriesConfig<AppContext, TSelect>;
  workflow?: WorkflowConfig<AppContext, TSelect>;
  audit?: boolean | AuditConfig<AppContext, TSelect>;
  outbox?: boolean | ResourceOutboxConfig;
  computed?: Record<string, ComputedFieldDefinition<TSelect, AppContext>>;
  virtualFields?: Record<string, ComputedFieldDefinition<TSelect, AppContext>>; 
  
  import?: {
    lookupBy: string | string[] | string[][];
    /**
     * How many rows an import request may carry. Defaults to 100.
     *
     * A payload over the limit is refused with a 400 — it is not truncated.
     * A partial import that reports success is much harder to notice than a
     * rejected request, so the caller is told to chunk the payload instead.
     */
    maxRowsPerRequest?: number;
  };
  
  // Security
  permissions?: {
    list?: string;
    detail?: string;
    create?: string;
    update?: string;
    delete?: string;
    "batch-update"?: string;
    "batch-delete"?: string;
    "import-preview"?: string;
    "import-execute"?: string;
  };
  authorize?: (appContext: AppContext, action: "list" | "detail" | "create" | "update" | "delete" | "batch-update" | "batch-delete" | "import-preview" | "import-execute", record?: TSelect) => boolean | Promise<boolean>;

  // UI/API Hints
  hidden?: (keyof TSelect)[];

  // Data Transformation
  transform?: (record: TSelect, appContext: AppContext) => any | Promise<any>;
  
  // Performance & Protection
  cache?: {
    enabled: boolean;
    ttl?: number; // Time-to-live in seconds
    /**
     * Identifies the caller in the cache key.
     *
     * A cached response may only be shared between callers when the key
     * says who is asking. `scope` and `transform` both depend on the app
     * context, so two callers sending the same query can be owed different
     * rows — a key without a caller dimension hands the first caller's
     * response to the second one.
     *
     * The returned string becomes part of the cache key, so it has to
     * distinguish every caller that must not see another caller's data.
     * Returning `undefined` — an anonymous caller, for instance — leaves
     * the response uncached.
     *
     * When this is not set at all the resource is served from the database
     * every time and nothing is read from or written to the cache. A
     * resource whose response is the same for everybody can say so
     * explicitly with `keyBy: () => 'shared'`.
     */
    keyBy?: (appContext: AppContext, query: Record<string, string>) => string | undefined;
  };
  
  rateLimit?: {
    limit: number;
    window: string; // e.g., '1m', '1h'
    key?: (c: Context<{ Bindings: Env }>, appContext: AppContext) => string;
  };

  // Files
  uploads?: Record<string, { folder?: string }>;

  // Data Management
  timestamps?: boolean | {
    createdAt?: string; // Default: 'createdAt'
    updatedAt?: string; // Default: 'updatedAt'
  };
  
  versionControl?: {
    field: string;
    strategy?: "optimistic";
  };

  // Mandatory Query Constraints
  scope?: (cols: any, ops: any, appContext: AppContext) => any;

  // New Search & Filter Configuration
  search?: {
    fields?: (keyof TSelect | string)[];
    relations?: string[];
  };

  filter?: {
    allow?: (keyof TSelect | string)[];
  };

  defaultSort?: { field: string; direction: "asc" | "desc" };
  pagination?: { defaultLimit?: number; maxLimit?: number };
  
  // Relations
  relations?: {
    one?: OneConfig<any>[];
    pivots?: PivotConfig<any>[];
    many?: ManyConfig<any>[];
  };

  with?: ResourceWithConfig; // Explicit control over which relations are returned

  hooks?: ResourceHooks<TSelect, TInsert, Env>;

  actions?: ActionConfig<Env, AppContext>[];
}

export interface ActionConfig<Env extends Record<string, unknown> = Record<string, unknown>, AppContext = any> {
  path: string;
  method: "get" | "post" | "put" | "patch" | "delete";
  handler: (c: Context<{ Bindings: Env }>, appContext: AppContext, validatedData?: any) => Promise<any> | any;
  validator?: StandardSchemaV1<unknown, any>;
}

export interface OneConfig<TTable = any> {
  name: string; // the property name on the result
  table: TTable;
  foreignKey: string; // e.g., 'customerId' on the main table
  referenceKey: string; // e.g., 'id' on the related table
  search?: string[]; // searchable fields in this relation
  hidden?: string[]; // hidden fields in this relation
}

export interface PivotConfig<TTable = any> {
  name: string;
  table: TTable;
  targetTable?: any; // The actual table to search in
  foreignKey: string; // key on pivot linking to parent
  referenceKey: string; // key on pivot linking to target
  targetReferenceKey: string; // key on target table
  relationName: string;
  strategy?: "upsert" | "replace" | "append";
  lookupBy?: string | string[] | string[][];
  search?: string[]; // searchable fields in the target table
  hidden?: string[]; // hidden fields in the target table
}

export interface ManyConfig<TTable = any> {
  name: string;
  table: TTable;
  foreignKey: string; // key on child table linking back to parent
  referenceKey: string; // key on parent table
  schema: StandardSchemaV1<unknown, any>;
  strategy?: "upsert" | "replace" | "append";
  lookupBy?: string | string[] | string[][];
  search?: string[]; // searchable fields in this relation
  hidden?: string[]; // hidden fields in this relation
}

export type * from "./testing/types.js";
