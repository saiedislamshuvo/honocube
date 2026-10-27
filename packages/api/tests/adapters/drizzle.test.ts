import { describe, it, expect } from "vitest";
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
});
