import { 
  eq, 
  and, 
  or,
  sql, 
  getTableColumns, 
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

  async update(table: any, id: string | number, data: any): Promise<unknown> {
    const columns = getTableColumns(table);
    const idCol = (columns as any).id;
    if (!idCol) throw new Error("Table must have an 'id' column for updates");

    if (this.dialect === "mysql") {
      await this.db.update(table).set(data).where(eq(idCol, id as any));
      return this.findFirst(table, {
        where: (cols: any, { eq }: any) => eq(cols.id, id)
      });
    }

    const result = await this.db.update(table).set(data).where(eq(idCol, id as any)).returning();
    return result[0];
  }

  async delete(table: any, id: string | number, _permanent = false): Promise<void> {
    const columns = getTableColumns(table);
    const idCol = (columns as any).id;
    if (!idCol) throw new Error("Table must have an 'id' column for deletion");
    await this.db.delete(table).where(eq(idCol, id as any));
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
