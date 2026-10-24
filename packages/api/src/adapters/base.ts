export type DatabaseStrategy = "transaction" | "batch" | "none";

/**
 * The condition operators the framework builds predicates with.
 *
 * The operators are specific to the ORM the adapter speaks — they are the
 * functions the underlying driver understands — so the framework asks the
 * adapter for them instead of importing them itself. That keeps the core
 * free of a direct dependency on the ORM.
 */
export interface DatabaseOperators {
  eq: (...args: any[]) => any;
  and: (...args: any[]) => any;
  or: (...args: any[]) => any;
  gt: (...args: any[]) => any;
  gte: (...args: any[]) => any;
  lt: (...args: any[]) => any;
  lte: (...args: any[]) => any;
  like: (...args: any[]) => any;
  inArray: (...args: any[]) => any;
  exists: (...args: any[]) => any;
  isNull: (...args: any[]) => any;
  isNotNull: (...args: any[]) => any;
}

export interface FindManyOptions {
  where?: unknown;
  limit?: number;
  offset?: number;
  orderBy?: { field: string; direction: "asc" | "desc" };
  with?: unknown;
  queryKey?: string;
}

export interface FindFirstOptions {
  where: unknown;
  with?: unknown;
  queryKey?: string;
}

export interface DatabaseAdapter<TTable = unknown, TSelect = unknown, TInsert = unknown> {
  findMany(table: TTable, options: FindManyOptions): Promise<TSelect[]>;
  findFirst(table: TTable, options: FindFirstOptions): Promise<TSelect | null>;
  insert(table: TTable, data: TInsert): Promise<TSelect>;

  /**
   * Updates a single row.
   *
   * `where` is an optional additional predicate that is combined with the
   * row's id. The framework passes the row-level scope and the soft-delete
   * filter, so that a row outside the caller's scope cannot be written even
   * if it is addressed directly by id.
   */
  update(table: TTable, id: string | number, data: Partial<TInsert>, where?: unknown): Promise<TSelect>;

  /**
   * Deletes a single row.
   *
   * `where` is an optional additional predicate that is combined with the
   * row's id, with the same meaning as in `update`.
   */
  delete(table: TTable, id: string | number, permanent?: boolean, where?: unknown): Promise<void>;
  count(table: TTable, where?: unknown): Promise<number>;
  
  // Transaction support is vital for pivot tables
  transaction<T>(cb: (tx: DatabaseAdapter<TTable, TSelect, TInsert>) => Promise<T>): Promise<T>;
  
  // Batch support for D1 and other performance-sensitive environments
  batch<T = any>(stmts: any[]): Promise<T[]>;

  /**
   * Whether the underlying driver exposes `db.batch()`.
   *
   * Only some Drizzle drivers implement it — `d1`, `libsql`, `neon-http` and
   * `sqlite-proxy` do. `postgres-js`, `node-postgres`, `mysql2` and
   * `better-sqlite3` do not, and calling it there throws
   * "tx.batch is not a function".
   *
   * Optional so that custom adapters written before this method existed keep
   * type-checking. When it is absent the framework assumes batch is
   * available, because `batch()` is a required member of this interface and
   * a custom adapter that implements it can be relied on to work.
   */
  supportsBatch?(): boolean;

  /**
   * Builds a SQL expression that resolves to the id of the parent row that
   * was inserted earlier in the same batch.
   *
   * This is used when a parent row and its children are inserted in a single
   * batch, where the parent's id is not known until the insert has run.
   *
   * The expression must be portable across the dialect in use — SQLite's
   * `last_insert_rowid()` does not exist on Postgres or MySQL — and it must
   * be *stable*: it has to keep resolving to the same parent id for every
   * child, no matter how many inserts run after the parent's insert.
   *
   * Optional so that custom adapters written before this method existed keep
   * type-checking. When it is absent the framework falls back to inserting
   * the parent first and reading its id back, which works everywhere.
   */
  parentIdExpression?(parentTable: unknown, parentIdColumn?: string): unknown;

  // Statement builders for batching
  insertStmt(table: TTable, data: TInsert): any;
  updateStmt(table: TTable, id: string | number, data: Partial<TInsert>): any;
  deleteStmt(table: TTable, id: string | number): any;

  // Helper to get columns for validation/filtering
  getColumnNames(table: TTable): string[];

  /**
   * The condition operators the framework builds predicates with.
   *
   * The core does not import the ORM's operators itself — it asks the
   * adapter for them, so the operators always belong to the driver the
   * adapter talks to.
   */
  getOperators(): DatabaseOperators;

  /**
   * Every column of a table, keyed by the name the framework uses it under.
   */
  getColumns(table: TTable): Record<string, unknown>;

  /**
   * A single column of a table.
   */
  getColumn(table: TTable, name: string): unknown;

  // Advanced access
  getDb(): any;
  getSql(): any;
}
