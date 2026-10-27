import { describe, it, expect } from "vitest";
import { DrizzleAdapter } from "../../src/adapters/drizzle.js";
import { createTestDb, users } from "../fixtures/db.js";

describe("DrizzleAdapter", () => {
  it("exposes operators, columns, and batch capabilities", async () => {
    const { adapter } = await createTestDb();

    const ops = adapter.getOperators();
    expect(ops.eq).toBeDefined();
    expect(ops.and).toBeDefined();
    expect(ops.or).toBeDefined();
    expect(ops.like).toBeDefined();
    expect(ops.inArray).toBeDefined();

    const cols = adapter.getColumns(users);
    expect(cols.id).toBeDefined();
    expect(cols.name).toBeDefined();
    expect(cols.email).toBeDefined();

    expect(adapter.supportsBatch?.()).toBe(true);

    const parentIdExpr = adapter.parentIdExpression?.(users, "id");
    expect(parentIdExpr).toBeDefined();
  });

  it("performs insert, findFirst, update, delete, and count operations", async () => {
    const { adapter } = await createTestDb();
    const ops = adapter.getOperators();
    const cols = adapter.getColumns(users);

    // 1. Insert
    const inserted: any = await adapter.insert(users, {
      name: "Alice",
      email: "alice@example.com",
    });
    expect(inserted).toBeDefined();
    expect(inserted.id).toBeDefined();
    expect(inserted.name).toBe("Alice");

    // 2. Count
    const countBefore = await adapter.count(users);
    expect(countBefore).toBe(1);

    // 3. FindFirst
    const found: any = await adapter.findFirst(users, {
      where: (cols: any, { eq }: any) => eq(cols.id, inserted.id),
    });
    expect(found).toBeDefined();
    expect(found?.email).toBe("alice@example.com");

    // 4. Update
    const updated: any = await adapter.update(
      users,
      inserted.id,
      { name: "Alice Cooper" },
      ops.eq(cols.email, "alice@example.com")
    );
    expect(updated).toBeDefined();
    expect(updated.name).toBe("Alice Cooper");

    // 5. FindMany with order and limit
    await adapter.insert(users, {
      name: "Bob",
      email: "bob@example.com",
    });

    const many: any[] = await adapter.findMany(users, {
      limit: 10,
      orderBy: { field: "name", direction: "asc" },
    });
    expect(many.length).toBe(2);
    expect(many[0].name).toBe("Alice Cooper");
    expect(many[1].name).toBe("Bob");

    // 6. Delete
    await adapter.delete(users, inserted.id, true);
    const countAfter = await adapter.count(users);
    expect(countAfter).toBe(1);
  });

  it("handles transactions atomically", async () => {
    const { adapter } = await createTestDb();

    // Successful transaction
    await adapter.transaction(async (tx) => {
      await tx.insert(users, {
        name: "TxUser1",
        email: "tx1@example.com",
      });
      await tx.insert(users, {
        name: "TxUser2",
        email: "tx2@example.com",
      });
    });

    const total = await adapter.count(users);
    expect(total).toBe(2);

    // Failed transaction rolls back
    await expect(
      adapter.transaction(async (tx) => {
        await tx.insert(users, {
          name: "TxUser3",
          email: "tx3@example.com",
        });
        // Duplicate email triggers UNIQUE constraint failure
        await tx.insert(users, {
          name: "TxUserDuplicate",
          email: "tx1@example.com",
        });
      })
    ).rejects.toThrow();

    // Count should still be 2 (TxUser3 was rolled back)
    const totalAfterRollback = await adapter.count(users);
    expect(totalAfterRollback).toBe(2);
  });

  it("covers dialect resolution, MySQL methods, offset, and missing ID column guards", async () => {
    const { adapter, db } = await createTestDb();
    const ops = adapter.getOperators();

    // 1. Dialect resolution by driver constructor name
    const pgAdapter = new DrizzleAdapter({ dialect: { constructor: { name: "PostgresDialect" } } } as any, { dialect: "postgresql" });
    expect((pgAdapter as any).resolveDialect()).toBe("postgresql");

    const mysqlDriverAdapter = new DrizzleAdapter({ dialect: { constructor: { name: "MySqlDialect" } } } as any, { dialect: "mysql" });
    expect((mysqlDriverAdapter as any).resolveDialect()).toBe("mysql");

    const sqliteDriverAdapter = new DrizzleAdapter({ dialect: { constructor: { name: "LibSQLDialect" } } } as any, { dialect: "sqlite" });
    expect((sqliteDriverAdapter as any).resolveDialect()).toBe("sqlite");

    // 2. Fallback select query with offset
    await adapter.insert(users, { name: "UserA", email: "a@example.com" });
    await adapter.insert(users, { name: "UserB", email: "b@example.com" });
    const offsetRows = await adapter.findMany(users, { offset: 1, limit: 10 });
    expect(offsetRows.length).toBeGreaterThanOrEqual(1);

    // 3. Count with non-function where condition and function where condition
    const countWithRawWhere = await adapter.count(users, ops.eq(adapter.getColumn(users, "email"), "a@example.com"));
    expect(countWithRawWhere).toBe(1);

    const countWithFnWhere = await adapter.count(users, (cols: any, { eq }: any) => eq(cols.email, "a@example.com"));
    expect(countWithFnWhere).toBe(1);

    // Relational query key in findMany and findFirst
    const relMany = await adapter.findMany(users, { queryKey: "users", limit: 5, orderBy: { field: "name", direction: "desc" } });
    expect(relMany.length).toBeGreaterThanOrEqual(1);

    const relFirst = await adapter.findFirst(users, { queryKey: "users", where: (cols: any, { eq }: any) => eq(cols.email, "a@example.com") });
    expect(relFirst).toBeDefined();

    // Default dialect fallback when driver name unknown
    const customDriverAdapter = new DrizzleAdapter({ dialect: { constructor: { name: "UnknownDialect" } } } as any, { dialect: "sqlite" });
    expect((customDriverAdapter as any).resolveDialect()).toBe("sqlite");

    // Adapter batch directly
    const batchRes = await adapter.batch([]);
    expect(Array.isArray(batchRes)).toBe(true);

    // Postgres parentIdExpression execution
    const pgExpr = pgAdapter.parentIdExpression(users);
    expect(pgExpr).toBeDefined();

    // SQLite insertStmt and updateStmt with returning
    const sqliteInsertStmt = adapter.insertStmt(users, { name: "StmtUser", email: "stmt@example.com" });
    expect(sqliteInsertStmt).toBeDefined();
    const sqliteUpdateStmt = adapter.updateStmt(users, 1, { name: "StmtUserUpdated" });
    expect(sqliteUpdateStmt).toBeDefined();

    // 4. Missing ID Column Guards
    const { sqliteTable, text: sqlText } = await import("drizzle-orm/sqlite-core");
    const noIdTable = sqliteTable("no_id_table", { val: sqlText("val") });

    await expect(adapter.update(noIdTable, 1, { val: "x" })).rejects.toThrow("Table must have an 'id' column for updates");
    await expect(adapter.delete(noIdTable, 1)).rejects.toThrow("Table must have an 'id' column for deletion");
    expect(() => adapter.updateStmt(noIdTable, 1, { val: "x" })).toThrow("Table must have an 'id' column for updates");
    expect(() => adapter.deleteStmt(noIdTable, 1)).toThrow("Table must have an 'id' column for deletion");
    expect(() => adapter.parentIdExpression(noIdTable)).toThrow("must have an 'id' column");

    // 5. Direct Statements & Helpers
    const delStmt = adapter.deleteStmt(users, 999);
    expect(delStmt).toBeDefined();

    const colNames = adapter.getColumnNames(users);
    expect(colNames).toContain("id");
    expect(colNames).toContain("name");
    expect(colNames).toContain("email");

    expect(adapter.getDb()).toBe(db);
    expect(adapter.getSql()).toBeDefined();

    // 6. MySQL dialect insert, update, insertStmt, and updateStmt
    let findFirstWhereCalled = false;
    const queryObj: any = {
      where: () => {
        findFirstWhereCalled = true;
        return queryObj;
      },
      limit: () => queryObj,
      offset: () => queryObj,
      then: (resolve: any) => resolve([{ id: 888, name: "MySQL User" }]),
    };
    const mockMysqlDb: any = {
      insert: () => ({
        values: async () => [{ insertId: 888 }],
      }),
      update: () => ({
        set: () => ({
          where: async () => {},
        }),
      }),
      select: () => ({
        from: () => ({
          $dynamic: () => queryObj,
        }),
      }),
    };

    const mockMysqlAdapter = new DrizzleAdapter(mockMysqlDb, { dialect: "mysql" });
    const mysqlInserted: any = await mockMysqlAdapter.insert(users, { name: "MySQL User" });
    expect(mysqlInserted).toEqual({ id: 888, name: "MySQL User" });
    expect(findFirstWhereCalled).toBe(true);

    const mysqlUpdated: any = await mockMysqlAdapter.update(users, 888, { name: "MySQL User Updated" });
    expect(mysqlUpdated).toEqual({ id: 888, name: "MySQL User" });

    const mysqlInsertStmt = mockMysqlAdapter.insertStmt(users, { name: "Test" });
    expect(mysqlInsertStmt).toBeDefined();

    const mysqlUpdateStmt = mockMysqlAdapter.updateStmt(users, 888, { name: "Test" });
    expect(mysqlUpdateStmt).toBeDefined();

    // MySQL insert with no insertId returns null
    const mockMysqlDbNoInsertId: any = {
      insert: () => ({ values: async () => [] }),
    };
    const mockMysqlNoIdAdapter = new DrizzleAdapter(mockMysqlDbNoInsertId, { dialect: "mysql" });
    const nullInserted = await mockMysqlNoIdAdapter.insert(users, { name: "No ID" });
    expect(nullInserted).toBeNull();
  });
});
