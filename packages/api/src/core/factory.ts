import { Hono, Context } from "hono";
import { z } from "zod";
import { or, like, eq, and, isNull, isNotNull, getTableColumns, inArray, gt, gte, lt, lte, exists } from "drizzle-orm";
import { ResourceConfig, AppConfig } from "../types.js";
import { ApiError } from "../utils/errors.js";

/**
 * Creates the resource framework with global configuration.
 */
export function createApp<Env extends Record<string, unknown> = Record<string, unknown>, AppContext = any>(
  globalConfig: AppConfig<Env, AppContext>
) {
  // Setup default logger if none provided
  if (!globalConfig.logger) {
    globalConfig.logger = {
      info: (msg, ...meta) => console.log(`[HonoCube INFO] ${msg}`, ...meta),
      warn: (msg, ...meta) => console.warn(`[HonoCube WARN] ${msg}`, ...meta),
      error: (msg, err, ...meta) => console.error(`[HonoCube ERROR] ${msg}`, err, ...meta),
      debug: (msg, ...meta) => console.debug(`[HonoCube DEBUG] ${msg}`, ...meta),
    };
  }

  return {
    defineResource: <TTable, TSelect, TInsert>(
      config: ResourceConfig<TTable, TSelect, TInsert, Env, AppContext>
    ) => defineResource<TTable, TSelect, TInsert, Env, AppContext>(config, globalConfig),

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
  const adapter = config.adapter ?? globalConfig?.adapter;

  if (!adapter) {
    throw ApiError.internal(`Adapter not found for resource: ${config.name}. Ensure it is provided in defineResource or createApp.`);
  }

  const methods = new Set(config.methods ?? ["list", "detail", "create", "update", "delete"]);

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
  const checkAccess = async (appContext: any, action: "list" | "detail" | "create" | "update" | "delete" | "batch-update" | "batch-delete", record?: any) => {
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

  const getCacheKey = (c: Context, type: "list" | "detail", id?: string | number) => {
    const queryStr = new URL(c.req.url).search;
    return `res:${config.name}:${type}${id ? `:${id}` : ''}:${queryStr}`;
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
      const appContext = (globalConfig?.getContext ? await globalConfig.getContext(c) : {}) as AppContext;

      await checkRateLimit(c, appContext);
      await checkAccess(appContext, "list");

      // 0. Cache Check
      const cacheEnabled = config.cache?.enabled && globalConfig?.cache;
      const cacheKey = getCacheKey(c, "list");
      if (cacheEnabled) {
        const cached = await globalConfig!.cache!.get(cacheKey);
        if (cached) return c.json(cached);
      }

      if (config.hooks?.beforeFetch) {
        await config.hooks.beforeFetch(c, { list: true }, appContext);
      }

      const queryParams = c.req.query();
      const limit = Number(queryParams.limit ?? config.pagination?.defaultLimit ?? 20);
      const page = Number(queryParams.page ?? 1);
      const offset = (page - 1) * limit;
      const q = queryParams.q;

      // 1. Resolve 'with' object (Explicit only)
      const withTree: any = config.with;

      // 2. Build 'where' clause using ID collection for search
      let matchingIds: any[] | undefined = undefined;

      if (q && config.search) {
        const idSet = new Set<any>();

        // Search local fields
        if (config.search.fields) {
          const localMatch = await adapter.getDb()
            .select({ id: (config.table as any).id })
            .from(config.table)
            .where(or(...config.search.fields.map(f => like((config.table as any)[f as string], `%${q}%`))));
          localMatch.forEach((r: any) => idSet.add(r.id));
        }

        // Search relations
        if (config.search.relations) {
          for (const relName of config.search.relations) {
            // Check 'one' relations
            const oneRel = config.relations?.one?.find(r => r.name === relName);
            if (oneRel && oneRel.search) {
              const relMatch = await adapter.getDb()
                .select({ parentId: (config.table as any)[oneRel.foreignKey] })
                .from(config.table)
                .innerJoin(oneRel.table, eq(oneRel.table[oneRel.referenceKey], (config.table as any)[oneRel.foreignKey]))
                .where(or(...oneRel.search.map(f => like(oneRel.table[f], `%${q}%`))));
              relMatch.forEach((r: any) => idSet.add(r.parentId));
            }

            // Check 'many' relations
            const manyRel = config.relations?.many?.find(r => r.name === relName);
            if (manyRel && manyRel.search) {
              const relMatch = await adapter.getDb()
                .select({ parentId: manyRel.table[manyRel.foreignKey] })
                .from(manyRel.table)
                .where(or(...manyRel.search.map(f => like(manyRel.table[f], `%${q}%`))));
              relMatch.forEach((r: any) => idSet.add(r.parentId));
            }

            // Check 'pivot' relations
            const pivotRel = config.relations?.pivots?.find(r => r.name === relName);
            if (pivotRel && pivotRel.search && pivotRel.targetTable) {
              const relMatch = await adapter.getDb()
                .select({ parentId: pivotRel.table[pivotRel.foreignKey] })
                .from(pivotRel.table)
                .innerJoin(pivotRel.targetTable, eq(pivotRel.targetTable[pivotRel.targetReferenceKey], pivotRel.table[pivotRel.referenceKey]))
                .where(or(...pivotRel.search.map(f => like(pivotRel.targetTable[f], `%${q}%`))));
              relMatch.forEach((r: any) => idSet.add(r.parentId));
            }
          }
        }

        matchingIds = Array.from(idSet);
      }

      const where = (cols: any, ops: any) => {
        const { and, eq, inArray, like, gt, gte, lt, lte, isNull } = ops;
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

        if (matchingIds !== undefined) {
          if (matchingIds.length === 0) {
            conditions.push(eq(cols.id, -1));
          } else {
            conditions.push(inArray(cols.id, matchingIds));
          }
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
          orderBy: config.defaultSort,
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

      if (cacheEnabled) {
        await globalConfig!.cache!.set(cacheKey, response, config.cache?.ttl);
      }

      return c.json(response);
    });
  }

  if (methods.has("batch-update")) {
    app.patch("/batch-update", async (c) => {
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

      const validatedData = validator.parse(updateData);

      // Auto Timestamps
      const ts = getTimestampFields();
      if (ts && ts.updated) {
        validatedData[ts.updated] = new Date().toISOString();
      }

      const record = await adapter.transaction(async (tx) => {
        // Apply Batch Hook
        if (config.hooks?.beforeBatchUpdate) {
          const hooked = await config.hooks.beforeBatchUpdate(targetIds, validatedData, c, tx, appContext);
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
      const appContext = (globalConfig?.getContext ? await globalConfig.getContext(c) : {}) as AppContext;
      await checkRateLimit(c, appContext);
      await checkAccess(appContext, "batch-delete");

      const body = await c.req.json();
      const schema = z.object({
        ids: z.array(z.union([z.string(), z.number()])).min(1)
      });

      const parsed = schema.parse(body);
      let targetIds = parsed.ids;

      await adapter.transaction(async (tx) => {
        // Apply Batch Hook
        if (config.hooks?.beforeBatchDelete) {
          const hookedIds = await config.hooks.beforeBatchDelete(targetIds, c, tx, appContext);
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
        
        if (config.softDelete) {
          let updateQuery = tx.getDb().update(config.table).set({ [config.softDelete]: new Date().toISOString() }).where(inArray(idCol, targetIds));
          if (scopedWhere) {
             updateQuery = tx.getDb().update(config.table).set({ [config.softDelete]: new Date().toISOString() }).where(and(inArray(idCol, targetIds), scopedWhere));
          }
          await updateQuery;
        } else {
          let deleteQuery = tx.getDb().delete(config.table).where(inArray(idCol, targetIds));
          if (scopedWhere) {
             deleteQuery = tx.getDb().delete(config.table).where(and(inArray(idCol, targetIds), scopedWhere));
          }
          await deleteQuery;
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
      const appContext = (globalConfig?.getContext ? await globalConfig.getContext(c) : {}) as AppContext;
      await checkRateLimit(c, appContext);
      const id = c.req.param("id");
      
      // 0. Cache Check
      const cacheEnabled = config.cache?.enabled && globalConfig?.cache;
      const cacheKey = getCacheKey(c, "detail", id);
      if (cacheEnabled) {
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

      if (cacheEnabled) {
        await globalConfig!.cache!.set(cacheKey, response, config.cache?.ttl);
      }

      return c.json(response);
    });
  }

  if (methods.has("create")) {
    app.post("/", async (c) => {
      const appContext = (globalConfig?.getContext ? await globalConfig.getContext(c) : {}) as AppContext;
      await checkRateLimit(c, appContext);
      await checkAccess(appContext, "create");

      let body = await c.req.json();
      
      // 0. Recursive File Upload Processing
      body = await processUploads(body);

      const record = await adapter.transaction(async (tx) => {
        let data = body;
        
        if (config.hooks?.beforeCreate) {
          const hooked = await config.hooks.beforeCreate(data, c, tx, appContext);
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

        const validated = validator.parse(data);

        // Auto Timestamps
        const ts = getTimestampFields();
        if (ts) {
          const now = new Date().toISOString();
          if (ts.created && !(ts.created in validated)) validated[ts.created] = now;
          if (ts.updated) validated[ts.updated] = now; // Always update modified time
        }

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
      const appContext = (globalConfig?.getContext ? await globalConfig.getContext(c) : {}) as AppContext;
      await checkRateLimit(c, appContext);
      const id = c.req.param("id");

      // We need to fetch the existing record first for Row-Level Security
      const existingRecord = await adapter.findFirst(config.table, {
        where: (cols: any, { eq }: any) => eq(cols.id, id),
      });

      if (!existingRecord) throw ApiError.notFound();

      await checkAccess(appContext, "update", existingRecord);

      let body = await c.req.json();

      // 0. Recursive File Upload Processing
      body = await processUploads(body);

      const record = await adapter.transaction(async (tx) => {
        let data = body;

        if (config.hooks?.beforeUpdate) {
          const hooked = await config.hooks.beforeUpdate(id, data, c, tx, appContext);
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

        const validated = validator.parse(data);

        // Auto Timestamps
        const ts = getTimestampFields();
        if (ts && ts.updated) {
          validated[ts.updated] = new Date().toISOString();
        }

        // 1. Update Parent
        const updated = await tx.update(config.table, id, validated);
        if (!updated) throw ApiError.notFound();

        // 2. Sync Relations (if provided)
        if (config.relations) {
          // Sync Many
          if (config.relations.many) {
            for (const rel of config.relations.many) {
              if (Array.isArray(data[rel.name])) {
                const strategy = rel.strategy ?? "replace";
                if (strategy === "replace") {
                   await tx.getDb().delete(rel.table).where(eq(rel.table[rel.foreignKey], id));
                }
                
                for (const child of data[rel.name]) {
                  await tx.insert(rel.table, { ...child, [rel.foreignKey]: id });
                }
              }
            }
          }

          // Sync Pivots
          if (config.relations.pivots) {
            for (const rel of config.relations.pivots) {
              if (Array.isArray(data[rel.name])) {
                const strategy = rel.strategy ?? "replace";
                if (strategy === "replace") {
                  await tx.getDb().delete(rel.table).where(eq(rel.table[rel.foreignKey], id));
                }
                
                for (const item of data[rel.name]) {
                  await tx.insert(rel.table, { ...item, [rel.foreignKey]: id });
                }
              }
            }
          }
        }

        if (config.hooks?.afterUpdate) {
          await config.hooks.afterUpdate(updated as TSelect, c, tx, appContext);
        }

        return updated;
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
      const appContext = (globalConfig?.getContext ? await globalConfig.getContext(c) : {}) as AppContext;
      await checkRateLimit(c, appContext);
      const id = c.req.param("id");

      const existingRecord = await adapter.findFirst(config.table, {
        where: (cols: any, { eq }: any) => eq(cols.id, id),
      });

      if (!existingRecord) throw ApiError.notFound();

      await checkAccess(appContext, "delete", existingRecord);

      await adapter.transaction(async (tx) => {
        if (config.hooks?.beforeDelete) {
          await config.hooks.beforeDelete(id, c, tx, appContext);
        }

        if (config.softDelete) {
          await tx.update(config.table, id, { [config.softDelete]: new Date().toISOString() } as any);
        } else {
          await tx.delete(config.table, id, true);
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

  // Custom Actions
  if (config.actions) {
    for (const action of config.actions) {
      app[action.method](action.path, async (c) => {
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
