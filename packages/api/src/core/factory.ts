import { Hono, Context } from "hono";
import { z } from "zod";
import { sql, or, like, eq, and, isNull, isNotNull, getTableColumns, inArray, gt, gte, lt, lte, exists } from "drizzle-orm";
import { ResourceConfig, AppConfig } from "../types.js";
import { ApiError } from "../utils/errors.js";
import { DatabaseAdapter, DatabaseStrategy } from "../adapters/base.js";

/**
 * The execution strategy used when the application does not ask for one.
 *
 * This is the single source of truth for the default — `createApp` and every
 * strategy-reading call site read it from here.
 */
export const DEFAULT_STRATEGY: DatabaseStrategy = "batch";

/**
 * Creates the resource framework with global configuration.
 */
export function createApp<Env extends Record<string, unknown> = Record<string, unknown>, AppContext = any>(
  globalConfig: AppConfig<Env, AppContext>
) {
  // Copy the config so the caller's object is never mutated. The defaults are
  // applied to the copy, not written back into the object the caller holds.
  const appConfig: AppConfig<Env, AppContext> = { ...globalConfig };

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

  const finalize = async (row: any, appContext: any, localConfig: any = config): Promise<any> => {
    if (!row) return row;
    
    // 1. Handle Array
    if (Array.isArray(row)) {
      return await Promise.all(row.map(r => finalize(r, appContext, localConfig)));
    }

    const currentConfig = localConfig === config ? config : localConfig;
    const hidden = new Set(currentConfig.hidden as string[] ?? []);
    let out = { ...row };

    // 2. Hide local fields
    for (const key of hidden) {
      delete out[key];
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
        if (out[rel.name] !== undefined && typeof out[rel.name] === 'object') {
          out[rel.name] = await finalize(out[rel.name], appContext, rel);
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
    action: "list" | "detail" | "create" | "update" | "delete" | "batch-update" | "batch-delete" | "import-preview" | "import-execute", 
    record?: any
  ) => {
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

  /**
   * Builds the predicate a single-record write has to satisfy: the row's id,
   * plus the soft-delete filter and the row-level scope.
   *
   * The read paths apply the same two filters, so a row that does not match
   * them must not be writable either — otherwise a caller could update or
   * delete another user's row simply by guessing its id.
   */
  const buildRecordPredicate = (id: string | number, appContext: AppContext) => {
    const cols = getTableColumns(config.table as any);
    const conditions: any[] = [eq((cols as any).id, id as any)];

    if (config.softDelete) {
      conditions.push(isNull((cols as any)[config.softDelete]));
    }

    if (config.scope) {
      const ops = { eq, and, or, gt, gte, lt, lte, isNull, isNotNull, like, inArray, exists };
      const scoped = config.scope(cols, ops, appContext);
      if (scoped) conditions.push(scoped);
    }

    return conditions.length > 1 ? and(...conditions) : conditions[0];
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

    if (relStrategy === "replace") {
      stmts.push(tx.getDb().delete(relConfig.table).where(eq(relConfig.table[relConfig.foreignKey], parentId)));
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

      const existingChildren = await tx.getDb().select().from(relConfig.table).where(eq(relConfig.table[relConfig.foreignKey], parentId));

      const findExisting = (row: any) => {
        return existingChildren.find((er: any) => {
          if (typeof lookupBy === 'string') return er[lookupBy] === row[lookupBy];
          if (Array.isArray(lookupBy) && typeof lookupBy[0] === 'string') return (lookupBy as string[]).every(k => er[k] === row[k]);
          if (Array.isArray(lookupBy) && Array.isArray(lookupBy[0])) return (lookupBy as string[][]).some(keys => keys.every(k => er[k] === row[k]));
          return false;
        });
      };

      const cCols = getTableColumns(relConfig.table);

      for (const child of incomingChildren) {
        const existing = findExisting(child);
        if (existing) {
          let updateStmt: any = tx.getDb().update(relConfig.table).set(child);
          if (cCols.id) {
             updateStmt = updateStmt.where(eq(cCols.id, existing.id));
          } else {
             if (typeof lookupBy === 'string') updateStmt = updateStmt.where(and(eq(cCols[relConfig.foreignKey], parentId), eq(cCols[lookupBy], existing[lookupBy])));
             else if (Array.isArray(lookupBy) && typeof lookupBy[0] === 'string') {
                updateStmt = updateStmt.where(and(eq(cCols[relConfig.foreignKey], parentId), ...((lookupBy as string[]).map(k => eq(cCols[k], existing[k])))));
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
    appContext: AppContext
  ): string | null => {
    if (!config.cache?.enabled || !globalConfig?.cache) return null;

    const keyBy = config.cache.keyBy;
    if (!keyBy) return null;

    const caller = keyBy(appContext, c.req.query());
    if (caller === undefined || caller === null || caller === '') return null;

    const queryStr = new URL(c.req.url).search;
    return `res:${config.name}:${type}${id ? `:${id}` : ''}:${caller}:${queryStr}`;
  };

  const invalidateCache = async () => {
    if (globalConfig?.cache && config.cache?.enabled) {
      await globalConfig.cache.clear(`res:${config.name}:`);
    }
  };

  const checkRateLimit = async (c: Context, appContext: any) => {
    if (config.rateLimit && globalConfig?.rateLimiter) {
      const { limit, window, key: keyFn } = config.rateLimit;
      const key = keyFn ? keyFn(c as any, appContext) : `${c.req.path}:${c.req.header('cf-connecting-ip') || 'anon'}`;
      const allowed = await globalConfig.rateLimiter.check(key, limit, window);
      if (!allowed) throw ApiError.tooManyRequests();
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
        if (out[rel.name] !== undefined) {
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

      // 0. Cache Check
      const cacheKey = getCacheKey(c, "list", undefined, appContext);
      if (cacheKey) {
        const cached = await globalConfig!.cache!.get(cacheKey);
        if (cached) return c.json(cached);
      }

      if (config.hooks?.beforeFetch) {
        await config.hooks.beforeFetch(c, { list: true }, appContext);
      }

      const queryParams = c.req.query();
      let limit = Number(queryParams.limit ?? config.pagination?.defaultLimit ?? 20);
      const maxLimit = config.pagination?.maxLimit ?? 100;
      if (limit > maxLimit) limit = maxLimit;

      const page = Number(queryParams.page ?? 1);
      const offset = (page - 1) * limit;
      const q = queryParams.q;

      // 1. Resolve 'with' object (Explicit only)
      const withTree: any = config.with;

      // 2. Build Search Subqueries
      const searchSubqueries: any[] = [];

      if (q && config.search) {
        // Search local fields
        if (config.search.fields) {
          const localSubquery = adapter.getDb()
            .select({ id: (config.table as any).id })
            .from(config.table)
            .where(or(...config.search.fields.map(f => like((config.table as any)[f as string], `%${q}%`))));
          searchSubqueries.push(localSubquery);
        }

        // Search relations
        if (config.search.relations) {
          for (const relName of config.search.relations) {
            // Check 'one' relations
            const oneRel = config.relations?.one?.find(r => r.name === relName);
            if (oneRel && oneRel.search) {
              const relSubquery = adapter.getDb()
                .select({ parentId: (config.table as any)[oneRel.foreignKey] })
                .from(config.table)
                .innerJoin(oneRel.table, eq(oneRel.table[oneRel.referenceKey], (config.table as any)[oneRel.foreignKey]))
                .where(or(...oneRel.search.map(f => like(oneRel.table[f], `%${q}%`))));
              searchSubqueries.push(relSubquery);
            }

            // Check 'many' relations
            const manyRel = config.relations?.many?.find(r => r.name === relName);
            if (manyRel && manyRel.search) {
              const relSubquery = adapter.getDb()
                .select({ parentId: manyRel.table[manyRel.foreignKey] })
                .from(manyRel.table)
                .where(or(...manyRel.search.map(f => like(manyRel.table[f], `%${q}%`))));
              searchSubqueries.push(relSubquery);
            }

            // Check 'pivot' relations
            const pivotRel = config.relations?.pivots?.find(r => r.name === relName);
            if (pivotRel && pivotRel.search && pivotRel.targetTable) {
              const relSubquery = adapter.getDb()
                .select({ parentId: pivotRel.table[pivotRel.foreignKey] })
                .from(pivotRel.table)
                .innerJoin(pivotRel.targetTable, eq(pivotRel.targetTable[pivotRel.targetReferenceKey], pivotRel.table[pivotRel.referenceKey]))
                .where(or(...pivotRel.search.map(f => like(pivotRel.targetTable[f], `%${q}%`))));
              searchSubqueries.push(relSubquery);
            }
          }
        }
      }

      const where = (cols: any, ops: any) => {
        const { and, eq, inArray, like, gt, gte, lt, lte, isNull, or } = ops;
        const conditions: any[] = [];

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
          // Use raw sql to force Drizzle to treat it as a subquery, not an array of values
          conditions.push(or(...searchSubqueries.map(sq => sql`${cols.id} IN (${sq})`)));
        } else if (q && config.search) {
          // If search term provided but no fields/relations matched, force empty result
          conditions.push(eq(cols.id, -1));
        }

        // Direct Filters
        const allowedFilters = config.filter?.allow || [];
        for (const [key, value] of Object.entries(queryParams)) {
          if (['limit', 'page', 'q', 'sort', 'order'].includes(key)) continue;
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

          // Strict filtering: only allow fields in 'filter.allow'
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

      const queryKey = config.queryKey ?? config.name;

      const [rows, total] = await Promise.all([
        adapter.findMany(config.table, {
          limit,
          offset,
          orderBy: config.defaultSort ?? { field: 'id', direction: 'desc' },
          where,
          with: withTree,
          queryKey
        }),
        adapter.count(config.table, where)
      ]);

      let resultRows = rows;
      if (config.hooks?.afterFetch) {
        resultRows = await config.hooks.afterFetch(rows as TSelect[], c, appContext);
      }

      const response = {
        success: true,
        data: await Promise.all(resultRows.map(r => finalize(r, appContext))),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
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
      const adapter = getAdapter(c);
      const appContext = (globalConfig?.getContext ? await globalConfig.getContext(c) : {}) as AppContext;
      await checkRateLimit(c, appContext);
      await checkAccess(appContext, "batch-update");

      const body = await c.req.json();
      const schema = z.object({
        ids: z.array(z.union([z.string(), z.number()])).min(1),
        data: z.any() // Will be validated against resource updateValidator
      });

      const parsed = schema.parse(body);
      let targetIds = parsed.ids;
      let updateData = parsed.data;

      // Validate data payload
      let validator: z.ZodTypeAny;
      if (Array.isArray(config.validator)) {
        validator = config.validator[1];
      } else if ('update' in config.validator && !(config.validator instanceof z.ZodType)) {
        validator = config.validator.update;
      } else if (typeof (config.validator as any).partial === 'function') {
        validator = (config.validator as any).partial();
      } else {
        validator = config.validator as z.ZodTypeAny;
      }

      const validatedData = validator.parse(updateData) as any;

      // Auto Timestamps
      const ts = getTimestampFields();
      if (ts && ts.updated) {
        validatedData[ts.updated] = new Date().toISOString();
      }

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

        // Apply mandatory scope
        let scopedWhere;
        if (config.scope) {
          const cols = getTableColumns(config.table as any);
          scopedWhere = config.scope(cols, { eq, and, or, gt, gte, lt, lte, isNull, isNotNull, like, inArray, exists }, appContext);
        }

        // Execute bulk update
        const idCol = (getTableColumns(config.table as any) as any).id;
        const conditions: any[] = [inArray(idCol, targetIds)];
        
        if (scopedWhere) {
          conditions.push(scopedWhere);
        }

        if (config.softDelete) {
           conditions.push(isNull((getTableColumns(config.table as any) as any)[config.softDelete]));
        }

        const result: any = await tx.getDb().update(config.table).set(validatedData).where(and(...conditions));
        
        // Handle different driver result formats
        const updatedCount = result.changes ?? result.rowCount ?? targetIds.length;

        if (config.hooks?.afterBatchUpdate) {
          await config.hooks.afterBatchUpdate(targetIds, c, tx, appContext);
        }

        return updatedCount;
      });

      await emitEvent(appContext, "batch-update", validatedData, targetIds);
      await invalidateCache();

      return c.json({ success: true, updated: record });
    });
  }

  if (methods.has("batch-delete")) {
    app.post("/batch-delete", async (c) => {
      const adapter = getAdapter(c);
      const appContext = (globalConfig?.getContext ? await globalConfig.getContext(c) : {}) as AppContext;
      await checkRateLimit(c, appContext);
      await checkAccess(appContext, "batch-delete");

      const body = await c.req.json();
      const schema = z.object({
        ids: z.array(z.union([z.string(), z.number()])).min(1)
      });

      const parsed = schema.parse(body);
      let targetIds = parsed.ids;

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
        if (config.scope) {
          const cols = getTableColumns(config.table as any);
          scopedWhere = config.scope(cols, { eq, and, or, gt, gte, lt, lte, isNull, isNotNull, like, inArray, exists }, appContext);
        }

        const idCol = (getTableColumns(config.table as any) as any).id;
        const conditions: any[] = [inArray(idCol, targetIds)];

        if (scopedWhere) {
          conditions.push(scopedWhere);
        }

        // A row that is already soft-deleted is not deleted again.
        if (config.softDelete) {
          conditions.push(isNull((getTableColumns(config.table as any) as any)[config.softDelete]));
          await tx.getDb().update(config.table).set({ [config.softDelete]: new Date().toISOString() }).where(and(...conditions));
        } else {
          await tx.getDb().delete(config.table).where(and(...conditions));
        }

        if (config.hooks?.afterBatchDelete) {
          await config.hooks.afterBatchDelete(targetIds, c, tx, appContext);
        }

        return targetIds.length;
      });

      await emitEvent(appContext, "batch-delete", undefined, targetIds);
      await invalidateCache();

      return c.json({ success: true, deleted: targetIds.length });
    });
  }

  if (methods.has("detail")) {
    app.get("/:id", async (c) => {
      const adapter = getAdapter(c);
      const appContext = (globalConfig?.getContext ? await globalConfig.getContext(c) : {}) as AppContext;
      await checkRateLimit(c, appContext);
      const id = c.req.param("id");
      
      // 0. Cache Check
      const cacheKey = getCacheKey(c, "detail", id, appContext);
      if (cacheKey) {
        const cached = await globalConfig!.cache!.get(cacheKey);
        if (cached) return c.json(cached);
      }

      if (config.hooks?.beforeFetch) {
        await config.hooks.beforeFetch(c, { detailId: id }, appContext);
      }

      const withTree: any = config.with;

      const queryKey = config.queryKey ?? config.name;
      const row = await adapter.findFirst(config.table, {
        where: (cols: any, ops: any) => {
          const { and, eq, isNull } = ops;
          const conditions = [eq(cols.id, id)];
          
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
        data: await finalize(resultRow as TSelect, appContext)
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
        
        // Cache Check
        const cacheKey = getCacheKey(c, `detail:${slugField}`, value, appContext);
        if (cacheKey) {
          const cached = await globalConfig!.cache!.get(cacheKey);
          if (cached) return c.json(cached);
        }

        if (config.hooks?.beforeFetch) {
          await config.hooks.beforeFetch(c, { detailId: value, slug: slugField }, appContext);
        }

        const withTree: any = config.with;
        const queryKey = config.queryKey ?? config.name;

        const row = await adapter.findFirst(config.table, {
          where: (cols: any, ops: any) => {
            const { and, eq, isNull } = ops;
            const conditions = [eq(cols[slugField], value)];
            
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
          data: await finalize(resultRow as TSelect, appContext)
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

      let body = await c.req.json();
      
      // 0. Recursive File Upload Processing
      body = await processUploads(body);

      const record = await runTransaction(c, async (tx) => {
        let data = body;

        const stmts: any[] = [];
        
        if (config.hooks?.beforeCreate) {
          const hooked = await config.hooks.beforeCreate(data, c, tx, appContext, stmts);
          if (hooked) data = hooked;
        }

        // Resolve Create Validator
        let validator: z.ZodTypeAny;
        if (Array.isArray(config.validator)) {
          validator = config.validator[0];
        } else if ('create' in config.validator && !(config.validator instanceof z.ZodType)) {
          validator = config.validator.create;
        } else {
          validator = config.validator as z.ZodTypeAny;
        }

        const validated = validator.parse(data) as any;

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
        const explicitParentId = (validated as any).id;
        const batchParentId = !hasRelations
          ? undefined
          : explicitParentId != null
            ? explicitParentId
            : tx.parentIdExpression?.(config.table);
        const useBatch = strategy === "batch" && (!hasRelations || batchParentId !== undefined);

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

          const results = await tx.batch(stmts);
          const inserted = Array.isArray(results[0]) ? results[0][0] : results[0];

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

          if (config.hooks?.afterCreate) {
            await config.hooks.afterCreate(inserted as TSelect, c, tx, appContext);
          }

          return inserted;
        }
      });

      await emitEvent(appContext, "create", record);
      await invalidateCache();

      // Reload with relations if necessary (since we just saved them)
      let finalRecord = record;
      const idCol = (getTableColumns(config.table as any) as any).id;
      const recordId = record[idCol.name] || record.id;
      
      if (config.with && recordId) {
        const reloaded = await adapter.findFirst(config.table, {
          where: (cols: any, { eq }: any) => eq(cols.id, recordId),
          with: config.with,
          queryKey: config.queryKey ?? config.name
        });
        if (reloaded) finalRecord = reloaded;
      }

      return c.json({
        success: true,
        data: await finalize(finalRecord as TSelect, appContext)
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

      // The scope and soft-delete filters are part of the lookup, so a row
      // outside the caller's scope is reported as not found instead of
      // confirming that it exists.
      const recordPredicate = buildRecordPredicate(id, appContext);

      // We need to fetch the existing record first for Row-Level Security
      const existingRecord = await adapter.findFirst(config.table, {
        where: recordPredicate,
      });

      if (!existingRecord) throw ApiError.notFound();

      await checkAccess(appContext, "update", existingRecord);

      let body = await c.req.json();

      // 0. Recursive File Upload Processing
      body = await processUploads(body);

      const record = await runTransaction(c, async (tx) => {
        let data = body;
        const stmts: any[] = [];

        if (config.hooks?.beforeUpdate) {
          const hooked = await config.hooks.beforeUpdate(id, data, c, tx, appContext, stmts);
          if (hooked) data = hooked;
        }

        // Resolve Update Validator
        let validator: z.ZodTypeAny;
        if (Array.isArray(config.validator)) {
          validator = config.validator[1];
        } else if ('update' in config.validator && !(config.validator instanceof z.ZodType)) {
          validator = config.validator.update;
        } else if (typeof (config.validator as any).partial === 'function') {
          validator = (config.validator as any).partial();
        } else {
          validator = config.validator as z.ZodTypeAny;
        }

        const validated = validator.parse(data) as any;

        // Auto Timestamps
        const ts = getTimestampFields();
        if (ts && ts.updated) {
          validated[ts.updated] = new Date().toISOString();
        }

        if (strategy === "batch") {
          // 1. Add Parent Statement
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
             const updateCondition = and(recordPredicate, eq((config.table as any)[vField], expectedVersion));
             parentStmt = parentStmt.where(updateCondition);
          } else {
             parentStmt = parentStmt.where(recordPredicate);
          }

          stmts.push(parentStmt);

          // 2. Sync Relations (if provided)
          if (config.relations) {
            // Sync Many
            if (config.relations.many) {
              for (const rel of config.relations.many) {
                if (Array.isArray(data[rel.name])) {
                  const relStrategy = rel.strategy ?? "replace";
                  if (relStrategy === "replace") {
                    stmts.push(tx.getDb().delete(rel.table).where(eq(rel.table[rel.foreignKey], id)));
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
                    stmts.push(tx.getDb().delete(rel.table).where(eq(rel.table[rel.foreignKey], id)));
                  }
                  
                  for (const item of data[rel.name]) {
                    stmts.push(tx.insertStmt(rel.table, { ...item, [rel.foreignKey]: id }));
                  }
                }
              }
            }
          }

          const results = await tx.batch(stmts);
          const updated = Array.isArray(results[0]) ? results[0][0] : results[0];

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
             const updateCondition = and(recordPredicate, eq((config.table as any)[vField], expectedVersion));
             updateQuery = updateQuery.where(updateCondition);
          } else {
             updateQuery = updateQuery.where(recordPredicate);
          }

          const results = await updateQuery;
          const updated = Array.isArray(results) ? results[0] : results;
          
          if (config.versionControl && !updated) {
            throw new ApiError(409, "OCC_FAILED", "Optimistic concurrency control failed. The record was modified by another transaction.");
          } else if (!updated) {
            throw ApiError.notFound();
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

          if (config.hooks?.afterUpdate) {
            await config.hooks.afterUpdate(updated as TSelect, c, tx, appContext);
          }

          return updated;
        }
      });

      await emitEvent(appContext, "update", record);
      await invalidateCache();

      // Reload if necessary
      let finalRecord = record;
      if (config.with) {
        const reloaded = await adapter.findFirst(config.table, {
          where: (cols: any, { eq }: any) => eq(cols.id, id),
          with: config.with,
          queryKey: config.queryKey ?? config.name
        });
        if (reloaded) finalRecord = reloaded;
      }

      return c.json({
        success: true,
        data: await finalize(finalRecord as TSelect, appContext)
      });
    });
  }

  if (methods.has("delete")) {
    app.delete("/:id", async (c) => {
      const adapter = getAdapter(c);
      const appContext = (globalConfig?.getContext ? await globalConfig.getContext(c) : {}) as AppContext;
      await checkRateLimit(c, appContext);
      const id = c.req.param("id");

      // The scope and soft-delete filters are part of the lookup, so a row
      // outside the caller's scope is reported as not found instead of
      // confirming that it exists.
      const recordPredicate = buildRecordPredicate(id, appContext);

      const existingRecord = await adapter.findFirst(config.table, {
        where: recordPredicate,
      });

      if (!existingRecord) throw ApiError.notFound();

      await checkAccess(appContext, "delete", existingRecord);

      await runTransaction(c, async (tx) => {
        const stmts: any[] = [];
        if (config.hooks?.beforeDelete) {
          await config.hooks.beforeDelete(id, c, tx, appContext, stmts);
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

      await emitEvent(appContext, "delete", undefined, [id]);
      await invalidateCache();

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

      let body = await c.req.json();
      if (!Array.isArray(body)) throw new ApiError(400, "INVALID_PAYLOAD", "Import payload must be an array of objects.");

      const maxRows = config.import?.maxRowsPerRequest ?? 100;
      if (body.length > maxRows) {
        body = body.slice(0, maxRows);
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
        const cols = getTableColumns(config.table as any);
        let existingRecords: any[] = [];
        
        // We do a pre-check to see if ANY rows have valid lookup keys.
        // If not, we skip the DB query entirely to prevent full table scans.
        const hasValidKeys = body.some((row: any) => {
           let lookupConfig = config.import!.lookupBy;
           if (typeof lookupConfig === 'string') return row[lookupConfig] !== undefined;
           if (Array.isArray(lookupConfig) && typeof lookupConfig[0] === 'string') return !(lookupConfig as string[]).some(k => row[k] === undefined);
           if (Array.isArray(lookupConfig) && Array.isArray(lookupConfig[0])) return (lookupConfig as string[][]).some(keys => !keys.some(k => row[k] === undefined));
           return false;
        });

        if (hasValidKeys) {
           existingRecords = await adapter.findMany(config.table, {
             where: (cCols: any, { or, and, eq }: any) => {
                const rowConditions = body.map((row: any) => {
                   let lookupConfig = config.import!.lookupBy;
                   if (typeof lookupConfig === 'string') {
                      if (row[lookupConfig] === undefined) return null;
                      return eq(cCols[lookupConfig], row[lookupConfig]);
                   } else if (Array.isArray(lookupConfig) && typeof lookupConfig[0] === 'string') {
                      if ((lookupConfig as string[]).some(k => row[k] === undefined)) return null;
                      return and(...(lookupConfig as string[]).map(k => eq(cCols[k], row[k])));
                   } else if (Array.isArray(lookupConfig) && Array.isArray(lookupConfig[0])) {
                      const orConds = (lookupConfig as string[][]).map(keys => {
                          if (keys.some(k => row[k] === undefined)) return null;
                          return and(...keys.map(k => eq(cCols[k], row[k])));
                      }).filter(Boolean);
                      if (orConds.length === 0) return null;
                      return or(...orConds);
                   }
                }).filter(Boolean);
                
                return rowConditions.length > 1 ? or(...rowConditions) : rowConditions[0];
             }
           });
        }

        const findExisting = (row: any) => {
           return existingRecords.find(er => {
              let lookupConfig = config.import!.lookupBy;
              if (typeof lookupConfig === 'string') {
                 return er[lookupConfig] === row[lookupConfig];
              } else if (Array.isArray(lookupConfig) && typeof lookupConfig[0] === 'string') {
                 return (lookupConfig as string[]).every(k => er[k] === row[k]);
              } else if (Array.isArray(lookupConfig) && Array.isArray(lookupConfig[0])) {
                 return (lookupConfig as string[][]).some(keys => keys.every(k => er[k] === row[k]));
              }
              return false;
           });
        };

        let createValidator: z.ZodTypeAny;
        let updateValidator: z.ZodTypeAny;
        if (Array.isArray(config.validator)) {
            createValidator = config.validator[0];
            updateValidator = config.validator[1];
        } else if ('create' in config.validator && !(config.validator instanceof z.ZodType)) {
            createValidator = config.validator.create as z.ZodTypeAny;
            updateValidator = ('update' in config.validator && !(config.validator instanceof z.ZodType))
                ? config.validator.update 
                : (config.validator as any).partial?.() || config.validator;
        } else {
            createValidator = config.validator as z.ZodTypeAny;
            updateValidator = (config.validator as any).partial?.() || config.validator;
        }

        const ts = getTimestampFields();
        const stmts: any[] = [];
        const strategy = resolveStrategy(tx);

        for (let i = 0; i < body.length; i++) {
           const rawRow = body[i];
           const existing = findExisting(rawRow);
           const isUpdate = !!existing;

           let validatedRow: any;
           try {
              validatedRow = isUpdate ? updateValidator.parse(rawRow) : createValidator.parse(rawRow);
           } catch (e: any) {
              results.errors.push({ index: i, error: e.errors || e.message });
              continue;
           }
           
           if (!isUpdate) {
              // Create
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
                 if (strategy === "batch") {
                    let updateStmt: any = tx.updateStmt(config.table, existing.id, validatedRow);
                    if (config.versionControl) {
                       const vField = config.versionControl.field;
                       updateStmt = updateStmt.where(and(eq(idCol, existing.id as any), eq((config.table as any)[vField], expectedVersion)));
                    }
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
                    let updateQuery: any = tx.updateStmt(config.table, existing.id, validatedRow);
                    if (config.versionControl) {
                       const vField = config.versionControl.field;
                       updateQuery = updateQuery.where(and(eq(idCol, existing.id as any), eq((config.table as any)[vField], expectedVersion)));
                    }
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
        const adapter = getAdapter(c);
      const appContext = (globalConfig?.getContext ? await globalConfig.getContext(c) : {}) as AppContext;
        await checkRateLimit(c, appContext);
        let validatedData = undefined;

        if (action.validator) {
          const body = await c.req.json();
          validatedData = action.validator.parse(body);
        }

        const result = await action.handler(c, appContext, validatedData);
        return c.json({ success: true, data: result });
      });
    }
  }

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json({ success: false, error: { code: err.code, message: err.message, details: err.details } }, err.status);
    }
    if (err.name === "ZodError") {
       return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Validation failed", details: (err as any).issues } }, 400);
    }
    
    // Use the framework logger for unexpected errors
    globalConfig?.logger?.error("Internal Error:", err);
    
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Internal Server Error", debug: err.message } }, 500);
  });

  return app;
}

export function defineApi<Env extends Record<string, unknown> = Record<string, unknown>>(
  resources: Record<string, Hono<any>>,
  version?: string
) {
  const api = new Hono<{ Bindings: Env }>();
  
  for (const [path, resourceApp] of Object.entries(resources)) {
    api.route(`/${path}`, resourceApp);
  }

  if (version) {
    const versionedApi = new Hono<{ Bindings: Env }>();
    versionedApi.route(`/${version}`, api);
    return versionedApi;
  }
  
  return api;
}
