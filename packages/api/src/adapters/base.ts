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
