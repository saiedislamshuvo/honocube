import { 
  eq, 
  and, 
  or,
  sql, 
  getTableColumns, 
  getTableName,
  getTableUniqueName,
  asc, 
  desc, 
  count as drizzleCount,
  gt,
  gte,
  lt,
  lte,
  like,
  inArray,
  exists,
  isNull,
  isNotNull
} from "drizzle-orm";
import { DatabaseAdapter, DatabaseOperators, FindManyOptions, FindFirstOptions } from "./base.js";

export type DrizzleDialect = "postgresql" | "mysql" | "sqlite";

export interface DrizzleAdapterOptions {
  dialect: DrizzleDialect;
  schema?: Record<string, any>;
}

export function createDrizzleAdapter(
  db: any,
  options: DrizzleAdapterOptions
): DatabaseAdapter<unknown, unknown, unknown> {
  const dialect = options.dialect;
  const globalSchema = options.schema;

  /**
   * Resolves the dialect actually in use.
   *
   * The dialect passed to the constructor is used, but the live instance is
   * preferred when it exposes one — a mismatch between the two would
   * otherwise produce dialect-specific SQL against the wrong database.
   */
  const resolveDialect = (): DrizzleDialect => {
    const name = db?.dialect?.constructor?.name ?? "";
    if (name.includes("Postgres") || name.includes("Pg")) return "postgresql";
    if (name.includes("MySql") || name.includes("Mysql")) return "mysql";
    if (name.includes("SQLite") || name.includes("LibSQL")) return "sqlite";
    return dialect;
  };

  /**
   * The Drizzle operators the framework builds predicates with.
   */
  const getOperators = (): DatabaseOperators => ({
    eq,
    and,
    or,
    gt,
    gte,
    lt,
    lte,
    like,
    inArray,
    exists,
    isNull,
    isNotNull,
  });

  /**
   * Every column of a table, keyed by the name the framework uses it under.
   */
  const getColumns = (table: any): Record<string, unknown> => {
    return getTableColumns(table) as Record<string, unknown>;
  };

  /**
   * A single column of a table.
   */
  const getColumn = (table: any, name: string): unknown => {
    return (getTableColumns(table) as any)[name];
  };

  /**
   * Helper to get the correct DB instance (potentially with a scoped schema)
   */
  const getDbInstance = (_options: FindManyOptions | FindFirstOptions) => db;

  const findMany = async (table: any, options: FindManyOptions): Promise<unknown[]> => {
    const dbInstance = getDbInstance(options);

    // 1. Try Relational Query API first
    if (options.queryKey && dbInstance.query?.[options.queryKey]) {
      const relOptions: any = {
        where: options.where,
        limit: options.limit,
        offset: options.offset,
        with: options.with,
      };

      if (options.orderBy) {
        const orderList = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy];
        relOptions.orderBy = (cols: any) => 
          orderList.map(({ field, direction }) =>
            direction === "desc" ? desc(cols[field]) : asc(cols[field])
          );
      }

      return await dbInstance.query[options.queryKey].findMany(relOptions);
    }

    // 2. Fallback to standard Select API
    const query = dbInstance.select().from(table).$dynamic();
    
    if (options.where) {
      if (typeof options.where === 'function') {
        const columns = getTableColumns(table);
        query.where(options.where(columns, getOperators()));
      } else {
        query.where(options.where);
      }
    }

    if (options.orderBy) {
      const orderList = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy];
      const clauses = orderList
        .map(({ field, direction }) => {
          const column = table[field];
          return column ? (direction === "desc" ? desc(column) : asc(column)) : undefined;
        })
        .filter(Boolean);
      if (clauses.length > 0) {
        query.orderBy(...clauses);
      }
    }

    if (options.limit) query.limit(options.limit);
    if (options.offset) query.offset(options.offset);

    return await query;
  };

  const findFirst = async (table: any, options: FindFirstOptions): Promise<unknown | null> => {
    const dbInstance = getDbInstance(options);

    if (options.queryKey && dbInstance.query?.[options.queryKey]) {
      const relOptions: any = {
        where: options.where,
        with: options.with
      };
      if (options.orderBy) {
        const orderList = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy];
        relOptions.orderBy = (cols: any) => 
          orderList.map(({ field, direction }) =>
            direction === "desc" ? desc(cols[field]) : asc(cols[field])
          );
      }
      return await dbInstance.query[options.queryKey].findFirst(relOptions);
    }

    const results = await findMany(table, { ...options, limit: 1 });
    return results[0] || null;
  };

  const insert = async (table: any, data: unknown): Promise<unknown> => {
    if (dialect === "mysql") {
      const result = await db.insert(table).values(data);
      const insertId = result[0]?.insertId;
      if (!insertId) return null;
      
      return findFirst(table, {
        where: (cols: any, { eq: eqOp }: any) => eqOp(cols.id, insertId)
      });
    }

    const result = await db.insert(table).values(data).returning();
    return result[0];
  };

  const update = async (table: any, id: string | number, data: any, where?: unknown): Promise<unknown> => {
    const columns = getTableColumns(table);
    const idCol = (columns as any).id;
    if (!idCol) throw new Error("Table must have an 'id' column for updates");

    const condition = where ? and(eq(idCol, id as any), where as any) : eq(idCol, id as any);

    if (dialect === "mysql") {
      await db.update(table).set(data).where(condition);
      return findFirst(table, { where: condition });
    }

    const result = await db.update(table).set(data).where(condition).returning();
    return result[0];
  };

  const deleteFn = async (table: any, id: string | number, _permanent = false, where?: unknown): Promise<void> => {
    const columns = getTableColumns(table);
    const idCol = (columns as any).id;
    if (!idCol) throw new Error("Table must have an 'id' column for deletion");
    const condition = where ? and(eq(idCol, id as any), where as any) : eq(idCol, id as any);
    await db.delete(table).where(condition);
  };

  const count = async (table: any, where?: unknown): Promise<number> => {
    const query = db.select({ value: drizzleCount() }).from(table).$dynamic();
    
    if (where) {
      if (typeof where === 'function') {
        const columns = getTableColumns(table);
        query.where(where(columns, getOperators()));
      } else {
        query.where(where);
      }
    }

    const result = await query;
    return Number(result[0]?.value ?? 0);
  };

  const transaction = async <T>(cb: (tx: DatabaseAdapter<unknown, unknown, unknown>) => Promise<T>): Promise<T> => {
    return await db.transaction(async (tx: any) => {
      const txAdapter = createDrizzleAdapter(tx, { dialect, schema: globalSchema });
      return await cb(txAdapter);
    });
  };

  const batch = async <T = any>(stmts: any[]): Promise<T[]> => {
    return await db.batch(stmts);
  };

  const supportsBatch = (): boolean => {
    return typeof db?.batch === "function";
  };

  const parentIdExpression = (parentTable: any, parentIdColumn = "id"): any => {
    const currentDialect = resolveDialect();
    const columns = getTableColumns(parentTable);
    const idColumn = (columns as any)?.[parentIdColumn];

    if (!idColumn) {
      throw new Error(
        `Table "${getTableName(parentTable)}" must have an '${parentIdColumn}' column`
      );
    }

    if (currentDialect === "postgresql") {
      const tableName = getTableUniqueName(parentTable);
      const columnName = idColumn.name;
      return sql`(SELECT CASE
        WHEN pg_get_serial_sequence(${tableName}, ${columnName}) IS NULL
          THEN (SELECT ${idColumn} FROM ${parentTable} ORDER BY ${idColumn} DESC LIMIT 1)
        ELSE currval(pg_get_serial_sequence(${tableName}, ${columnName}))
      END)`;
    }

    return sql`(SELECT ${idColumn} FROM ${parentTable} ORDER BY ${idColumn} DESC LIMIT 1)`;
  };

  const insertStmt = (table: any, data: unknown): any => {
    if (dialect === "mysql") {
      return db.insert(table).values(data);
    }
    return db.insert(table).values(data).returning();
  };

  const updateStmt = (table: any, id: string | number, data: any): any => {
    const columns = getTableColumns(table);
    const idCol = (columns as any).id;
    if (!idCol) throw new Error("Table must have an 'id' column for updates");

    if (dialect === "mysql") {
      return db.update(table).set(data).where(eq(idCol, id as any));
    }
    return db.update(table).set(data).where(eq(idCol, id as any)).returning();
  };

  const deleteStmt = (table: any, id: string | number): any => {
    const columns = getTableColumns(table);
    const idCol = (columns as any).id;
    if (!idCol) throw new Error("Table must have an 'id' column for deletion");
    return db.delete(table).where(eq(idCol, id as any));
  };

  const getColumnNames = (table: any): string[] => {
    return Object.keys(getTableColumns(table));
  };

  const getDb = (): any => db;

  const getSql = (): any => sql;

  const getDialect = (): DrizzleDialect => resolveDialect();

  return {
    getOperators,
    getColumns,
    getColumn,
    findMany,
    findFirst,
    insert,
    update,
    delete: deleteFn,
    count,
    transaction,
    batch,
    supportsBatch,
    parentIdExpression,
    insertStmt,
    updateStmt,
    deleteStmt,
    getColumnNames,
    getDb,
    getSql,
    getDialect,
  };
}
