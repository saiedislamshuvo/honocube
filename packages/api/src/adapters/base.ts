export type DatabaseStrategy = "transaction" | "batch" | "none";

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
  update(table: TTable, id: string | number, data: Partial<TInsert>): Promise<TSelect>;
  delete(table: TTable, id: string | number, permanent?: boolean): Promise<void>;
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

  // Advanced access
  getDb(): any;
  getSql(): any;
}
