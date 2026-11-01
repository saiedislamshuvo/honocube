import { describe, it, expect } from "vitest";
import { z } from "zod";
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { createApp } from "../../src/core/factory.js";
import { createTestDb } from "../fixtures/db.js";

const itemsTable = sqliteTable("test_cursor_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  tenantId: text("tenant_id"),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at").notNull(),
});

const itemSchema = z.object({
  name: z.string(),
  status: z.string().optional(),
  tenantId: z.string().optional(),
  deletedAt: z.string().nullable().optional(),
  createdAt: z.string(),
});

describe("Keyset & Cursor-Based Pagination Engine", () => {
  const setupDb = async () => {
    const { adapter, db } = await createTestDb();

    await (db as any).run(`
      CREATE TABLE IF NOT EXISTS test_cursor_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        tenant_id TEXT,
        deleted_at TEXT,
        created_at TEXT NOT NULL
      );
    `);

    // Insert 10 items for tenant-1
    // IDs 1 to 10
    // Item 7 is soft-deleted
    // Items 4, 5, 6 share the identical timestamp to test composite tie-breaker
    // Item 11 belongs to tenant-2
    await (db as any).run(`
      INSERT INTO test_cursor_items (id, name, status, tenant_id, deleted_at, created_at)
      VALUES 
        (1, 'Item 1', 'active', 'tenant-1', NULL, '2026-10-01T10:00:00.000Z'),
        (2, 'Item 2', 'inactive', 'tenant-1', NULL, '2026-10-02T10:00:00.000Z'),
        (3, 'Item 3', 'active', 'tenant-1', NULL, '2026-10-03T10:00:00.000Z'),
        (4, 'Item 4', 'active', 'tenant-1', NULL, '2026-10-04T12:00:00.000Z'),
        (5, 'Item 5', 'active', 'tenant-1', NULL, '2026-10-04T12:00:00.000Z'),
        (6, 'Item 6', 'active', 'tenant-1', NULL, '2026-10-04T12:00:00.000Z'),
        (7, 'Item 7 (Deleted)', 'active', 'tenant-1', '2026-10-05T12:00:00.000Z', '2026-10-05T10:00:00.000Z'),
        (8, 'Item 8', 'active', 'tenant-1', NULL, '2026-10-06T10:00:00.000Z'),
        (9, 'Item 9', 'inactive', 'tenant-1', NULL, '2026-10-07T10:00:00.000Z'),
        (10, 'Item 10', 'active', 'tenant-1', NULL, '2026-10-08T10:00:00.000Z'),
        (11, 'Item 11 (Tenant-2)', 'active', 'tenant-2', NULL, '2026-10-09T10:00:00.000Z');
    `);

    return { adapter, db };
  };

  it("navigates forward through pages using cursor and after with flat meta", async () => {
    const { adapter } = await setupDb();

    const app = createApp({ adapter });
    const resource = app.defineResource({
      name: "items",
      table: itemsTable,
      validator: itemSchema,
      softDelete: "deletedAt",
      pagination: { type: "cursor", defaultLimit: 3 },
    });

    // Page 1: Default limit 3, id DESC
    // Non-deleted: 11, 10, 9, 8, 6, 5, 4, 3, 2, 1 (Total 10)
    const p1Res = await resource.request("/?limit=3");
    expect(p1Res.status).toBe(200);
    const p1 = await p1Res.json();

    expect(p1.success).toBe(true);
    expect(p1.data.map((r: any) => r.id)).toEqual([11, 10, 9]);
    expect(p1.meta.total).toBe(10);
    expect(p1.meta.limit).toBe(3);
    expect(p1.meta.hasNext).toBe(true);
    expect(p1.meta.hasPrev).toBe(false);
    expect(p1.meta.prevCursor).toBeNull();
    expect(typeof p1.meta.nextCursor).toBe("string");

    // Page 2: pass after
    const p2Res = await resource.request(`/?limit=3&after=${p1.meta.nextCursor}`);
    expect(p2Res.status).toBe(200);
    const p2 = await p2Res.json();

    expect(p2.data.map((r: any) => r.id)).toEqual([8, 6, 5]); // item 7 is deleted
    expect(p2.meta.hasNext).toBe(true);
    expect(p2.meta.hasPrev).toBe(true);
    expect(typeof p2.meta.prevCursor).toBe("string");
    expect(typeof p2.meta.nextCursor).toBe("string");

    // Page 3: pass after
    const p3Res = await resource.request(`/?limit=3&after=${p2.meta.nextCursor}`);
    expect(p3Res.status).toBe(200);
    const p3 = await p3Res.json();

    expect(p3.data.map((r: any) => r.id)).toEqual([4, 3, 2]);
    expect(p3.meta.hasNext).toBe(true);
    expect(p3.meta.hasPrev).toBe(true);

    // Page 4: last page (only 1 item remaining: item 1)
    const p4Res = await resource.request(`/?limit=3&after=${p3.meta.nextCursor}`);
    expect(p4Res.status).toBe(200);
    const p4 = await p4Res.json();

    expect(p4.data.map((r: any) => r.id)).toEqual([1]);
    expect(p4.meta.hasNext).toBe(false);
    expect(p4.meta.hasPrev).toBe(true);
    expect(p4.meta.nextCursor).toBeNull();
  });

  it("navigates backward through pages using before and preserves natural descending order", async () => {
    const { adapter } = await setupDb();

    const app = createApp({ adapter });
    const resource = app.defineResource({
      name: "items",
      table: itemsTable,
      validator: itemSchema,
      softDelete: "deletedAt",
      pagination: { type: "cursor" },
    });

    // Advance to page 2 then page 3
    const p1 = await (await resource.request("/?limit=3")).json();
    const p2 = await (await resource.request(`/?limit=3&after=${p1.meta.nextCursor}`)).json();
    const p3 = await (await resource.request(`/?limit=3&after=${p2.meta.nextCursor}`)).json();

    expect(p3.data.map((r: any) => r.id)).toEqual([4, 3, 2]);

    // Go backward from page 3 using before (first item on p3 is item 4)
    const backToP2 = await (await resource.request(`/?limit=3&before=${p3.meta.prevCursor}`)).json();
    expect(backToP2.data.map((r: any) => r.id)).toEqual([8, 6, 5]);
    expect(backToP2.meta.hasNext).toBe(true);
    expect(backToP2.meta.hasPrev).toBe(true);

    // Go backward from page 2 to page 1
    const backToP1 = await (await resource.request(`/?limit=3&before=${backToP2.meta.prevCursor}`)).json();
    expect(backToP1.data.map((r: any) => r.id)).toEqual([11, 10, 9]);
    expect(backToP1.meta.hasPrev).toBe(false);
    expect(backToP1.meta.prevCursor).toBeNull();
    expect(backToP1.meta.hasNext).toBe(true);
  });

  it("handles composite keyset pagination with tie-breaker (createdAt and id)", async () => {
    const { adapter } = await setupDb();

    const app = createApp({ adapter });
    const resource = app.defineResource({
      name: "items",
      table: itemsTable,
      validator: itemSchema,
      softDelete: "deletedAt",
      defaultSort: { field: "createdAt", direction: "desc" },
      pagination: { type: "cursor" },
    });

    // Page 1: Items 11, 10 (limit 2)
    const p1 = await (await resource.request("/?limit=2")).json();
    expect(p1.data.map((r: any) => r.id)).toEqual([11, 10]);

    // Page 2: Items 9, 8
    const p2 = await (await resource.request(`/?limit=2&after=${p1.meta.nextCursor}`)).json();
    expect(p2.data.map((r: any) => r.id)).toEqual([9, 8]);

    // Page 3: Items 6, 5 (both have identical timestamp 2026-10-04T12:00:00.000Z, broken by id)
    const p3 = await (await resource.request(`/?limit=2&after=${p2.meta.nextCursor}`)).json();
    expect(p3.data.map((r: any) => r.id)).toEqual([6, 5]);

    // Page 4: Item 4 (also identical timestamp), then Item 3
    const p4 = await (await resource.request(`/?limit=2&after=${p3.meta.nextCursor}`)).json();
    expect(p4.data.map((r: any) => r.id)).toEqual([4, 3]);

    // Go backward from Page 4 to Page 3
    const backP3 = await (await resource.request(`/?limit=2&before=${p4.meta.prevCursor}`)).json();
    expect(backP3.data.map((r: any) => r.id)).toEqual([6, 5]);
  });

  it("supports ascending keyset pagination (order=asc)", async () => {
    const { adapter } = await setupDb();

    const app = createApp({ adapter });
    const resource = app.defineResource({
      name: "items",
      table: itemsTable,
      validator: itemSchema,
      softDelete: "deletedAt",
      pagination: { type: "cursor" },
    });

    // Forward ASC
    const p1 = await (await resource.request("/?limit=3&sort=id&order=asc")).json();
    expect(p1.data.map((r: any) => r.id)).toEqual([1, 2, 3]);

    const p2 = await (await resource.request(`/?limit=3&sort=id&order=asc&after=${p1.meta.nextCursor}`)).json();
    expect(p2.data.map((r: any) => r.id)).toEqual([4, 5, 6]);

    // Backward ASC
    const backP1 = await (await resource.request(`/?limit=3&sort=id&order=asc&before=${p2.meta.prevCursor}`)).json();
    expect(backP1.data.map((r: any) => r.id)).toEqual([1, 2, 3]);
  });

  it("accurately maintains total count reflecting active filters across cursor pages", async () => {
    const { adapter } = await setupDb();

    const app = createApp({ adapter });
    const resource = app.defineResource({
      name: "items",
      table: itemsTable,
      validator: itemSchema,
      softDelete: "deletedAt",
      pagination: { type: "cursor" },
    });

    // Active items only (IDs 11, 10, 8, 6, 5, 4, 3, 1 -> 8 active non-deleted items)
    const p1 = await (await resource.request("/?status=active&limit=3")).json();
    expect(p1.data.map((r: any) => r.id)).toEqual([11, 10, 8]);
    expect(p1.meta.total).toBe(8);

    const p2 = await (await resource.request(`/?status=active&limit=3&after=${p1.meta.nextCursor}`)).json();
    expect(p2.data.map((r: any) => r.id)).toEqual([6, 5, 4]);
    expect(p2.meta.total).toBe(8); // Total remains 8 on subsequent pages!

    const p3 = await (await resource.request(`/?status=active&limit=3&after=${p2.meta.nextCursor}`)).json();
    expect(p3.data.map((r: any) => r.id)).toEqual([3, 1]);
    expect(p3.meta.total).toBe(8);
  });

  it("enforces multi-tenancy and soft-delete in keyset queries", async () => {
    const { adapter } = await setupDb();

    const app = createApp({
      adapter,
      tenancy: {
        field: "tenantId",
        resolve: (c) => c.req.header("x-tenant") || "tenant-1",
      },
    });

    const resource = app.defineResource({
      name: "items",
      table: itemsTable,
      validator: itemSchema,
      softDelete: "deletedAt",
      tenancy: true,
      pagination: { type: "cursor" },
    });

    // As tenant-1: item 11 (tenant-2) and item 7 (deleted) are excluded
    const p1 = await (await resource.request("/?limit=3", { headers: { "x-tenant": "tenant-1" } })).json();
    expect(p1.data.map((r: any) => r.id)).toEqual([10, 9, 8]);
    expect(p1.meta.total).toBe(9); // 10 minus item 11 and deleted item 7
  });

  it("validates cursors and handles errors gracefully", async () => {
    const { adapter } = await setupDb();

    const app = createApp({ adapter });
    const resource = app.defineResource({
      name: "items",
      table: itemsTable,
      validator: itemSchema,
      pagination: { type: "cursor" },
    });

    // 1. Invalid base64/json string
    const res1 = await resource.request("/?cursor=not-a-valid-cursor-token");
    expect(res1.status).toBe(400);
    const b1 = await res1.json();
    expect(b1.error.code).toBe("INVALID_CURSOR");

    // 2. Passing ?page on cursor-only resource
    const res2 = await resource.request("/?page=2");
    expect(res2.status).toBe(400);
    const b2 = await res2.json();
    expect(b2.error.code).toBe("PAGINATION_TYPE_MISMATCH");
  });

  it("enforces offset-only restriction when pagination.type is 'offset'", async () => {
    const { adapter } = await setupDb();

    const app = createApp({ adapter });
    const resource = app.defineResource({
      name: "items",
      table: itemsTable,
      validator: itemSchema,
      pagination: { type: "offset" },
    });

    // Passing cursor on offset-only resource
    const res = await resource.request("/?cursor=eyJpZCI6MTB9");
    expect(res.status).toBe(400);
    const b = await res.json();
    expect(b.error.code).toBe("PAGINATION_TYPE_MISMATCH");
  });

  it("handles empty tables and zero matching rows without errors", async () => {
    const { adapter } = await setupDb();

    const app = createApp({ adapter });
    const resource = app.defineResource({
      name: "items",
      table: itemsTable,
      validator: itemSchema,
      pagination: { type: "cursor" },
    });

    const res = await resource.request("/?status=non_existent");
    expect(res.status).toBe(200);
    const b = await res.json();

    expect(b.data).toEqual([]);
    expect(b.meta.total).toBe(0);
    expect(b.meta.hasNext).toBe(false);
    expect(b.meta.hasPrev).toBe(false);
    expect(b.meta.nextCursor).toBeNull();
    expect(b.meta.prevCursor).toBeNull();
  });

  it("demonstrates O(1) page drift protection: inserting a new top item does not duplicate rows across pages", async () => {
    const { adapter, db } = await setupDb();

    const app = createApp({ adapter });
    const resource = app.defineResource({
      name: "items",
      table: itemsTable,
      validator: itemSchema,
      softDelete: "deletedAt",
      pagination: { type: "cursor" },
    });

    // Fetch page 1: returns items 11, 10
    const p1 = await (await resource.request("/?limit=2")).json();
    expect(p1.data.map((r: any) => r.id)).toEqual([11, 10]);

    // While client is viewing Page 1, a concurrent user inserts Item 12 at the very top!
    await (db as any).run(`
      INSERT INTO test_cursor_items (id, name, status, tenant_id, deleted_at, created_at)
      VALUES (12, 'Item 12 (Inserted)', 'active', 'tenant-1', NULL, '2026-10-10T10:00:00.000Z');
    `);

    // In OFFSET pagination, fetching offset 2 would now return item 10 AGAIN (page drift)!
    // In CURSOR pagination, querying after p1.nextCursor queries WHERE id < 10:
    const p2 = await (await resource.request(`/?limit=2&after=${p1.meta.nextCursor}`)).json();
    // It returns EXACTLY items 9, 8 — ZERO duplicate of item 10, zero page drift!
    expect(p2.data.map((r: any) => r.id)).toEqual([9, 8]);
  });
});
