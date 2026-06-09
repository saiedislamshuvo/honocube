import type { Context, MiddlewareHandler } from "hono";
import type { z } from "zod";
import type { DatabaseAdapter } from "./adapters/base.js";

export type ApiErrorStatus = 400 | 401 | 403 | 404 | 429 | 500;

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
  beforeFetch?: (c: Context<{ Bindings: Env }>, params: { list?: boolean; detailId?: string | number }, appContext: AppContext) => Promise<void> | void;
  afterFetch?: (rows: TSelect[], c: Context<{ Bindings: Env }>, appContext: AppContext) => Promise<TSelect[]> | TSelect[];
  beforeCreate?: (data: TInsert, c: Context<{ Bindings: Env }>, tx: DatabaseAdapter<any, any, any>, appContext: AppContext) => Promise<TInsert | void> | TInsert | void;
  afterCreate?: (record: TSelect, c: Context<{ Bindings: Env }>, tx: DatabaseAdapter<any, any, any>, appContext: AppContext) => Promise<void> | void;
  beforeUpdate?: (id: string | number, data: Partial<TInsert>, c: Context<{ Bindings: Env }>, tx: DatabaseAdapter<any, any, any>, appContext: AppContext) => Promise<Partial<TInsert> | void> | Partial<TInsert> | void;
  afterUpdate?: (record: TSelect, c: Context<{ Bindings: Env }>, tx: DatabaseAdapter<any, any, any>, appContext: AppContext) => Promise<void> | void;
  beforeDelete?: (id: string | number, c: Context<{ Bindings: Env }>, tx: DatabaseAdapter<any, any, any>, appContext: AppContext) => Promise<void> | void;
  afterDelete?: (id: string | number, c: Context<{ Bindings: Env }>, tx: DatabaseAdapter<any, any, any>, appContext: AppContext) => Promise<void> | void;
  
  // Batch Hooks
  beforeBatchUpdate?: (ids: (string | number)[], data: Partial<TInsert>, c: Context<{ Bindings: Env }>, tx: DatabaseAdapter<any, any, any>, appContext: AppContext) => Promise<{ ids: (string | number)[], data: Partial<TInsert> } | void> | { ids: (string | number)[], data: Partial<TInsert> } | void;
  afterBatchUpdate?: (ids: (string | number)[], c: Context<{ Bindings: Env }>, tx: DatabaseAdapter<any, any, any>, appContext: AppContext) => Promise<void> | void;
  beforeBatchDelete?: (ids: (string | number)[], c: Context<{ Bindings: Env }>, tx: DatabaseAdapter<any, any, any>, appContext: AppContext) => Promise<(string | number)[] | void> | (string | number)[] | void;
  afterBatchDelete?: (ids: (string | number)[], c: Context<{ Bindings: Env }>, tx: DatabaseAdapter<any, any, any>, appContext: AppContext) => Promise<void> | void;
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
  type: "create" | "update" | "delete" | "batch-update" | "batch-delete";
  resource: string;
  data?: any;
  ids?: (string | number)[];
  appContext: AppContext;
}

export interface AppConfig<Env extends Record<string, unknown> = Record<string, unknown>, AppContext = any> {
  adapter: DatabaseAdapter<any, any, any>;
  middleware?: MiddlewareHandler<{ Bindings: Env }>[];
  schema?: Record<string, any>; // Global schema for convenience
  logger?: AppLogger; // Global framework logger
  cache?: AppCache; // Global cache provider
  rateLimiter?: RateLimiter; // Global rate limiter
  storage?: AppStorage; // Global storage provider
  mediaBaseUrl?: string; // e.g., 'https://cdn.example.com/'
  onEvent?: (event: ResourceEvent<AppContext>) => Promise<void> | void;
  getContext?: (c: Context<{ Bindings: Env }>) => Promise<AppContext> | AppContext;
  auth?: {
    can: (appContext: AppContext, permission: string, record?: any) => boolean | Promise<boolean>;
  };
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
  adapter?: DatabaseAdapter<TTable, TSelect, TInsert>;
  validator: 
    | z.ZodType<TInsert, any, any> 
    | [z.ZodType<TInsert, any, any>, z.ZodTypeAny]
    | { create: z.ZodType<TInsert, any, any>; update: z.ZodTypeAny };
  
  // Enterprise Features
  middleware?: MiddlewareHandler<{ Bindings: Env }>[];
  methods?: ("list" | "detail" | "create" | "update" | "delete" | "batch-update" | "batch-delete")[];
  softDelete?: string; 
  
  // Security
  permissions?: {
    list?: string;
    detail?: string;
    create?: string;
    update?: string;
    delete?: string;
    "batch-update"?: string;
    "batch-delete"?: string;
  };
  authorize?: (appContext: AppContext, action: "list" | "detail" | "create" | "update" | "delete" | "batch-update" | "batch-delete", record?: TSelect) => boolean | Promise<boolean>;

  // UI/API Hints
  hidden?: (keyof TSelect)[];

  // Data Transformation
  transform?: (record: TSelect, appContext: AppContext) => any | Promise<any>;
  
  // Performance & Protection
  cache?: {
    enabled: boolean;
    ttl?: number; // Time-to-live in seconds
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

  with?: Record<string, any>; // Explicit control over which relations are returned

  hooks?: ResourceHooks<TSelect, TInsert, Env>;

  actions?: ActionConfig<Env, AppContext>[];
}

export interface ActionConfig<Env extends Record<string, unknown> = Record<string, unknown>, AppContext = any> {
  path: string;
  method: "get" | "post" | "put" | "patch" | "delete";
  handler: (c: Context<{ Bindings: Env }>, appContext: AppContext, validatedData?: any) => Promise<any> | any;
  validator?: z.ZodTypeAny;
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
  search?: string[]; // searchable fields in the target table
  hidden?: string[]; // hidden fields in the target table
}

export interface ManyConfig<TTable = any> {
  name: string;
  table: TTable;
  foreignKey: string; // key on child table linking back to parent
  referenceKey: string; // key on parent table
  schema: z.ZodSchema;
  strategy?: "upsert" | "replace" | "append";
  search?: string[]; // searchable fields in this relation
  hidden?: string[]; // hidden fields in this relation
}
