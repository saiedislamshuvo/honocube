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
import { DatabaseAdapter, FindManyOptions, FindFirstOptions } from "./base.js";

export type DrizzleDialect = "postgresql" | "mysql" | "sqlite";

export interface DrizzleAdapterOptions {
  dialect: DrizzleDialect;
  schema?: Record<string, any>;
}

export class DrizzleAdapter implements DatabaseAdapter<unknown, unknown, unknown> {
  private dialect: DrizzleDialect;
  private globalSchema?: Record<string, any>;

  constructor(private db: any, options: DrizzleAdapterOptions) {
    this.dialect = options.dialect;
    this.globalSchema = options.schema;
  }

  private getOperators() {
    return { eq, and, or, gt, gte, lt, lte, like, inArray, exists, isNull, isNotNull };
  }

  /**
   * Resolves the dialect actually in use.
   *
   * The dialect passed to the constructor is used, but the live instance is
   * preferred when it exposes one — a mismatch between the two would
   * otherwise produce dialect-specific SQL against the wrong database.
   */
  private resolveDialect(): DrizzleDialect {
    const name = this.db?.dialect?.constructor?.name ?? "";
    if (name.includes("Postgres") || name.includes("Pg")) return "postgresql";
    if (name.includes("MySql") || name.includes("Mysql")) return "mysql";
    if (name.includes("SQLite") || name.includes("LibSQL")) return "sqlite";
    return this.dialect;
  }

  /**
   * Helper to get the correct DB instance (potentially with a scoped schema)
   */
  private getDbInstance(options: FindManyOptions | FindFirstOptions) {
    // If a local schema is provided in options, we'd ideally create a scoped instance.
    // However, Drizzle's relational API is tied to the instance creation.
    // For now, we assume the provided 'this.db' already has the necessary schema
    // OR we use the global schema if available.
    return this.db;
  }

  async findMany(table: any, options: FindManyOptions): Promise<unknown[]> {
    const db = this.getDbInstance(options);

    // 1. Try Relational Query API first
    if (options.queryKey && db.query?.[options.queryKey]) {
      const relOptions: any = {
        where: options.where,
        limit: options.limit,
        offset: options.offset,
        with: options.with,
      };

      if (options.orderBy) {
        const { field, direction } = options.orderBy;
        relOptions.orderBy = (cols: any) => 
          direction === "desc" ? desc(cols[field]) : asc(cols[field]);
      }

      return await db.query[options.queryKey].findMany(relOptions);
    }

    // 2. Fallback to standard Select API
    let query = db.select().from(table).$dynamic();
    
    if (options.where) {
      if (typeof options.where === 'function') {
        const columns = getTableColumns(table);
        query.where(options.where(columns, this.getOperators()));
      } else {
        query.where(options.where);
      }
    }

    if (options.orderBy) {
      const { field, direction } = options.orderBy;
      const column = table[field];
      if (column) {
        query.orderBy(direction === "desc" ? desc(column) : asc(column));
      }
    }

    if (options.limit) query.limit(options.limit);
    if (options.offset) query.offset(options.offset);

    return await query;
  }

  async findFirst(table: any, options: FindFirstOptions): Promise<unknown | null> {
    const db = this.getDbInstance(options);

    if (options.queryKey && db.query?.[options.queryKey]) {
      return await db.query[options.queryKey].findFirst({
        where: options.where,
        with: options.with
      });
    }

    const results = await this.findMany(table, { ...options, limit: 1 });
    return results[0] || null;
  }

  async insert(table: any, data: unknown): Promise<unknown> {
    if (this.dialect === "mysql") {
      const result = await this.db.insert(table).values(data);
      const insertId = result[0]?.insertId;
      if (!insertId) return null;
      
      return this.findFirst(table, {
        where: (cols: any, { eq }: any) => eq(cols.id, insertId)
      });
    }

    const result = await this.db.insert(table).values(data).returning();
    return result[0];
  }

  async update(table: any, id: string | number, data: any, where?: unknown): Promise<unknown> {
    const columns = getTableColumns(table);
    const idCol = (columns as any).id;
    if (!idCol) throw new Error("Table must have an 'id' column for updates");

    const condition = where ? and(eq(idCol, id as any), where as any) : eq(idCol, id as any);

    if (this.dialect === "mysql") {
      await this.db.update(table).set(data).where(condition);
      return this.findFirst(table, { where: condition });
    }

    const result = await this.db.update(table).set(data).where(condition).returning();
    return result[0];
  }

  async delete(table: any, id: string | number, _permanent = false, where?: unknown): Promise<void> {
    const columns = getTableColumns(table);
    const idCol = (columns as any).id;
    if (!idCol) throw new Error("Table must have an 'id' column for deletion");
    const condition = where ? and(eq(idCol, id as any), where as any) : eq(idCol, id as any);
    await this.db.delete(table).where(condition);
  }

  async count(table: any, where?: unknown): Promise<number> {
    const query = this.db.select({ value: drizzleCount() }).from(table).$dynamic();
    
    if (where) {
      if (typeof where === 'function') {
        const columns = getTableColumns(table);
        query.where(where(columns, this.getOperators()));
      } else {
        query.where(where);
      }
    }

    const result = await query;
    return Number(result[0]?.value ?? 0);
  }

  async transaction<T>(cb: (tx: DatabaseAdapter<unknown, unknown, unknown>) => Promise<T>): Promise<T> {
    return await this.db.transaction(async (tx: any) => {
      const txAdapter = new DrizzleAdapter(tx, { dialect: this.dialect, schema: this.globalSchema });
      return await cb(txAdapter);
    });
  }

  async batch<T = any>(stmts: any[]): Promise<T[]> {
    return await this.db.batch(stmts);
  }

  /**
   * Detects whether the underlying Drizzle driver exposes `db.batch()`.
   *
   * Drizzle only implements `batch` on a subset of drivers. As of 0.45.x these
   * are `d1`, `libsql`, `neon-http` and `sqlite-proxy`. On `postgres-js`,
   * `node-postgres`, `mysql2` and `better-sqlite3` the method is absent, so
   * calling it throws "tx.batch is not a function".
   *
   * The check is done on the live instance rather than on a driver-name list,
   * so it stays correct for custom drivers and for future Drizzle releases.
   */
  supportsBatch(): boolean {
    return typeof this.db?.batch === "function";
  }

  /**
   * Builds a portable expression that resolves to the id of the parent row
   * inserted earlier in the same batch.
   *
   * The previous implementation hard-coded SQLite's
   * `(SELECT last_insert_rowid())`, which does not exist on Postgres or
   * MySQL — creating a resource with relations failed on both.
   *
   * `last_insert_rowid()` / `LAST_INSERT_ID()` are not a usable substitute
   * either: both are scoped to the connection and are advanced by *every*
   * insert that follows, so with more than one child row each child would
   * pick up the id of the row inserted right before it instead of the
   * parent's. The expressions below read the parent id back from the
   * database instead of relying on connection state, so they stay correct
   * for any number of children:
   *
   * - Postgres: `currval(pg_get_serial_sequence('table', 'id'))` — `currval`
   *   is scoped to the sequence behind the id column, so inserts into other
   *   tables do not move it, and concurrent transactions cannot interfere
   * - SQLite / MySQL: `(SELECT <id> FROM <table> ORDER BY <id> DESC LIMIT 1)`
   *   — the parent row is the most recently inserted one, and SQLite allows
   *   a single writer at a time, so the row read back is always the one
   *   inserted by this batch
   *
   * The expression is only valid while the parent's insert statement runs
   * immediately before its children in the same batch, which is how the
   * framework orders the statements.
   */
  parentIdExpression(parentTable: any, parentIdColumn = "id"): any {
    const dialect = this.resolveDialect();
    const columns = getTableColumns(parentTable);
    const idColumn = (columns as any)?.[parentIdColumn];

    if (!idColumn) {
      throw new Error(
        `Table "${getTableName(parentTable)}" must have an '${parentIdColumn}' column`
      );
    }

    if (dialect === "postgresql") {
      const tableName = getTableUniqueName(parentTable);
      const columnName = idColumn.name;
      // `pg_get_serial_sequence` returns NULL when the column is not backed
      // by a sequence, and `currval` errors on a NULL sequence — fall back to
      // reading the row back in that case.
      return sql`(SELECT CASE
        WHEN pg_get_serial_sequence(${tableName}, ${columnName}) IS NULL
          THEN (SELECT ${idColumn} FROM ${parentTable} ORDER BY ${idColumn} DESC LIMIT 1)
        ELSE currval(pg_get_serial_sequence(${tableName}, ${columnName}))
      END)`;
    }

    return sql`(SELECT ${idColumn} FROM ${parentTable} ORDER BY ${idColumn} DESC LIMIT 1)`;
  }

  insertStmt(table: any, data: unknown): any {
    if (this.dialect === "mysql") {
      return this.db.insert(table).values(data);
    }
    return this.db.insert(table).values(data).returning();
  }

  updateStmt(table: any, id: string | number, data: any): any {
    const columns = getTableColumns(table);
    const idCol = (columns as any).id;
    if (!idCol) throw new Error("Table must have an 'id' column for updates");

    if (this.dialect === "mysql") {
      return this.db.update(table).set(data).where(eq(idCol, id as any));
    }
    return this.db.update(table).set(data).where(eq(idCol, id as any)).returning();
  }

  deleteStmt(table: any, id: string | number): any {
    const columns = getTableColumns(table);
    const idCol = (columns as any).id;
    if (!idCol) throw new Error("Table must have an 'id' column for deletion");
    return this.db.delete(table).where(eq(idCol, id as any));
  }

  getColumnNames(table: any): string[] {
    return Object.keys(getTableColumns(table));
  }

  getDb(): any {
    return this.db;
  }

  getSql(): any {
    return sql;
  }
}
