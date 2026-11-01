import { describe, it, expect } from "vitest";
import { z } from "zod";
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { createApp } from "../../src/core/factory.js";
import { createTestDb } from "../fixtures/db.js";

const ordersTable = sqliteTable("test_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  status: text("status").notNull().default("pending"),
  category: text("category").notNull().default("general"),
  amount: integer("amount").notNull().default(0),
  tenantId: text("tenant_id"),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

const orderSchema = z.object({
  title: z.string(),
  status: z.string().optional(),
  category: z.string().optional(),
  amount: z.number().optional(),
  tenantId: z.string().optional(),
  deletedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

describe("Declarative Query Aggregations & Analytics Engine", () => {
  const setupDb = async () => {
    const { adapter, db } = await createTestDb();

    await (db as any).run(`
      CREATE TABLE IF NOT EXISTS test_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        category TEXT NOT NULL DEFAULT 'general',
        amount INTEGER NOT NULL DEFAULT 0,
        tenant_id TEXT,
        deleted_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT
      );
    `);

    // Insert test seed data:
    // 1. Oct 1: Order 1, completed, electronics, 500, tenant-1
    // 2. Oct 15: Order 2, completed, books, 100, tenant-1
    // 3. Nov 1: Order 3, completed, electronics, 600, tenant-1
    // 4. Nov 1: Order 4, pending, clothing, 150, tenant-1
    // 5. Nov 2: Order 5, pending, clothing, 200, tenant-1
    // 6. Nov 2: Order 6, cancelled, books, 50, tenant-1
    // 7. Nov 2: Order 7 (Soft-deleted), completed, electronics, 1000, tenant-1
    // 8. Nov 2: Order 8 (Tenant-2), completed, electronics, 800, tenant-2
    await (db as any).run(`
      INSERT INTO test_orders (title, status, category, amount, tenant_id, deleted_at, created_at)
      VALUES 
        ('Order 1', 'completed', 'electronics', 500, 'tenant-1', NULL, '2026-10-01T10:00:00.000Z'),
        ('Order 2', 'completed', 'books', 100, 'tenant-1', NULL, '2026-10-15T12:00:00.000Z'),
        ('Order 3', 'completed', 'electronics', 600, 'tenant-1', NULL, '2026-11-01T08:00:00.000Z'),
        ('Order 4', 'pending', 'clothing', 150, 'tenant-1', NULL, '2026-11-01T14:00:00.000Z'),
        ('Order 5', 'pending', 'clothing', 200, 'tenant-1', NULL, '2026-11-02T02:00:00.000Z'),
        ('Order 6', 'cancelled', 'books', 50, 'tenant-1', NULL, '2026-11-02T03:00:00.000Z'),
        ('Order 7', 'completed', 'electronics', 1000, 'tenant-1', '2026-11-02T03:30:00.000Z', '2026-11-02T01:00:00.000Z'),
        ('Order 8', 'completed', 'electronics', 800, 'tenant-2', NULL, '2026-11-02T02:00:00.000Z');
    `);

    return { adapter, db };
  };

  it("calculates scalar summary aggregates without groupBy (count, sum, avg, min, max)", async () => {
    const { adapter } = await setupDb();

    const app = createApp({ adapter });
    const ordersResource = app.defineResource({
      name: "orders",
      table: ordersTable,
      validator: orderSchema,
      softDelete: "deletedAt",
      methods: ["list", "aggregate"],
    });

    const res = await ordersResource.request("/aggregate?metrics=count,sum:amount,avg:amount,min:amount,max:amount");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);

    // Total non-deleted orders (excluding Order 7):
    // Amounts: 500, 100, 600, 150, 200, 50, 800 -> 7 orders
    // Sum: 2400
    // Avg: 2400 / 7 = 342.8571
    // Min: 50
    // Max: 800
    expect(body.data.count).toBe(7);
    expect(body.data.sum_amount).toBe(2400);
    expect(body.data.avg_amount).toBeCloseTo(342.8571, 2);
    expect(body.data.min_amount).toBe(50);
    expect(body.data.max_amount).toBe(800);

    expect(body.meta.totalRecords).toBe(7);
    expect(body.meta.metrics).toEqual(["count", "sum_amount", "avg_amount", "min_amount", "max_amount"]);
  });

  it("supports custom metric aliases via colon and 'as' syntax", async () => {
    const { adapter } = await setupDb();

    const app = createApp({ adapter });
    const ordersResource = app.defineResource({
      name: "orders",
      table: ordersTable,
      validator: orderSchema,
      softDelete: "deletedAt",
      methods: ["list", "aggregate"],
    });

    const res = await ordersResource.request("/aggregate?metrics=sum:amount:total_revenue,avg:amount as average_ticket,count:id:order_count");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.total_revenue).toBe(2400);
    expect(body.data.average_ticket).toBeCloseTo(342.8571, 2);
    expect(body.data.order_count).toBe(7);
    expect(body.meta.metrics).toEqual(["total_revenue", "average_ticket", "order_count"]);
  });

  it("handles categorical grouping (groupBy=status)", async () => {
    const { adapter } = await setupDb();

    const app = createApp({ adapter });
    const ordersResource = app.defineResource({
      name: "orders",
      table: ordersTable,
      validator: orderSchema,
      softDelete: "deletedAt",
      methods: ["list", "aggregate"],
    });

    const res = await ordersResource.request("/aggregate?metrics=count,sum:amount&groupBy=status");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(3);

    // Group sums:
    // cancelled: 1 order (50)
    // completed: 4 orders (500 + 100 + 600 + 800 = 2000)
    // pending: 2 orders (150 + 200 = 350)
    const cancelled = body.data.find((r: any) => r.status === "cancelled");
    const completed = body.data.find((r: any) => r.status === "completed");
    const pending = body.data.find((r: any) => r.status === "pending");

    expect(cancelled).toEqual({ status: "cancelled", count: 1, sum_amount: 50 });
    expect(completed).toEqual({ status: "completed", count: 4, sum_amount: 2000 });
    expect(pending).toEqual({ status: "pending", count: 2, sum_amount: 350 });

    expect(body.meta.totalRecords).toBe(7);
    expect(body.meta.groupBy).toEqual(["status"]);
  });

  it("supports sorting groups by aggregate metric and limiting results", async () => {
    const { adapter } = await setupDb();

    const app = createApp({ adapter });
    const ordersResource = app.defineResource({
      name: "orders",
      table: ordersTable,
      validator: orderSchema,
      softDelete: "deletedAt",
      aggregate: true, // Activated via aggregate: true
    });

    // Highest revenue status first, limit to top 2
    const res = await ordersResource.request("/aggregate?metrics=count,sum:amount&groupBy=status&sort=sum_amount&order=desc&limit=2");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(2);

    expect(body.data[0].status).toBe("completed");
    expect(body.data[0].sum_amount).toBe(2000);

    expect(body.data[1].status).toBe("pending");
    expect(body.data[1].sum_amount).toBe(350);
  });

  it("supports multi-column grouping (groupBy=status,category)", async () => {
    const { adapter } = await setupDb();

    const app = createApp({ adapter });
    const ordersResource = app.defineResource({
      name: "orders",
      table: ordersTable,
      validator: orderSchema,
      softDelete: "deletedAt",
      methods: ["list", "aggregate"],
    });

    const res = await ordersResource.request("/aggregate?metrics=count,sum:amount&groupBy=status,category");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const completedElectronics = body.data.find((r: any) => r.status === "completed" && r.category === "electronics");
    expect(completedElectronics).toEqual({
      status: "completed",
      category: "electronics",
      count: 3, // Order 1 (500), Order 3 (600), Order 8 (800)
      sum_amount: 1900,
    });
  });

  it("handles time-series date bucketing (groupBy=createdAt:month and groupBy=createdAt:day)", async () => {
    const { adapter } = await setupDb();

    const app = createApp({ adapter });
    const ordersResource = app.defineResource({
      name: "orders",
      table: ordersTable,
      validator: orderSchema,
      softDelete: "deletedAt",
      methods: ["list", "aggregate"],
    });

    // Month bucketing
    const monthRes = await ordersResource.request("/aggregate?metrics=count,sum:amount&groupBy=createdAt:month");
    expect(monthRes.status).toBe(200);

    const monthBody = await monthRes.json();
    expect(monthBody.success).toBe(true);
    expect(monthBody.data.length).toBe(2);

    const oct = monthBody.data.find((r: any) => r.createdAt === "2026-10" || r.period === "2026-10");
    const nov = monthBody.data.find((r: any) => r.createdAt === "2026-11" || r.period === "2026-11");

    expect(oct.count).toBe(2); // Order 1 (500) + Order 2 (100)
    expect(oct.sum_amount).toBe(600);

    expect(nov.count).toBe(5); // Order 3 (600) + Order 4 (150) + Order 5 (200) + Order 6 (50) + Order 8 (800)
    expect(nov.sum_amount).toBe(1800);

    // Day bucketing
    const dayRes = await ordersResource.request("/aggregate?metrics=count,sum:amount&groupBy=createdAt:day");
    expect(dayRes.status).toBe(200);

    const dayBody = await dayRes.json();
    expect(dayBody.success).toBe(true);
    expect(dayBody.data.length).toBe(4); // 2026-10-01, 2026-10-15, 2026-11-01, 2026-11-02

    const nov1 = dayBody.data.find((r: any) => r.period === "2026-11-01" || r.createdAt === "2026-11-01");
    expect(nov1.count).toBe(2); // Order 3 (600) + Order 4 (150)
    expect(nov1.sum_amount).toBe(750);
  });

  it("supports date range filtering via from and to query parameters", async () => {
    const { adapter } = await setupDb();

    const app = createApp({ adapter });
    const ordersResource = app.defineResource({
      name: "orders",
      table: ordersTable,
      validator: orderSchema,
      softDelete: "deletedAt",
      methods: ["list", "aggregate"],
    });

    // Filter exactly on Nov 1
    const res = await ordersResource.request("/aggregate?metrics=count,sum:amount&from=2026-11-01T00:00:00.000Z&to=2026-11-01T23:59:59.999Z");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.count).toBe(2); // Order 3 (600) + Order 4 (150)
    expect(body.data.sum_amount).toBe(750);
    expect(body.meta.from).toBe("2026-11-01T00:00:00.000Z");
    expect(body.meta.to).toBe("2026-11-01T23:59:59.999Z");
  });

  it("applies direct resource filters and operator suffixes (__gte)", async () => {
    const { adapter } = await setupDb();

    const app = createApp({ adapter });
    const ordersResource = app.defineResource({
      name: "orders",
      table: ordersTable,
      validator: orderSchema,
      softDelete: "deletedAt",
      methods: ["list", "aggregate"],
    });

    const res = await ordersResource.request("/aggregate?status=completed&amount__gte=500&metrics=count,sum:amount");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    // Completed with amount >= 500:
    // Order 1 (500), Order 3 (600), Order 8 (800) -> 3 orders
    expect(body.data.count).toBe(3);
    expect(body.data.sum_amount).toBe(1900);
  });

  it("enforces multi-tenancy isolation automatically in aggregations", async () => {
    const { adapter } = await setupDb();

    const app = createApp({
      adapter,
      tenancy: {
        field: "tenantId",
        resolve: (c) => c.req.header("x-tenant") || "tenant-1",
      },
    });

    const ordersResource = app.defineResource({
      name: "orders",
      table: ordersTable,
      validator: orderSchema,
      softDelete: "deletedAt",
      tenancy: true,
      methods: ["list", "aggregate"],
    });

    // Query as tenant-1 (should exclude Order 8 which belongs to tenant-2)
    const resTenant1 = await ordersResource.request("/aggregate?metrics=count,sum:amount", {
      headers: { "x-tenant": "tenant-1" },
    });
    expect(resTenant1.status).toBe(200);
    const bodyTenant1 = await resTenant1.json();
    expect(bodyTenant1.data.count).toBe(6);
    expect(bodyTenant1.data.sum_amount).toBe(1600); // 2400 - 800

    // Query as tenant-2 (should only see Order 8)
    const resTenant2 = await ordersResource.request("/aggregate?metrics=count,sum:amount", {
      headers: { "x-tenant": "tenant-2" },
    });
    expect(resTenant2.status).toBe(200);
    const bodyTenant2 = await resTenant2.json();
    expect(bodyTenant2.data.count).toBe(1);
    expect(bodyTenant2.data.sum_amount).toBe(800);
  });

  it("enforces row-level authorization scopes", async () => {
    const { adapter } = await setupDb();

    const app = createApp({ adapter });
    const ordersResource = app.defineResource({
      name: "orders",
      table: ordersTable,
      validator: orderSchema,
      softDelete: "deletedAt",
      scope: (cols, { eq }) => eq(cols.category, "electronics"),
      methods: ["list", "aggregate"],
    });

    const res = await ordersResource.request("/aggregate?metrics=count,sum:amount");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    // Only electronics: Order 1 (500), Order 3 (600), Order 8 (800) -> 3 orders
    expect(body.data.count).toBe(3);
    expect(body.data.sum_amount).toBe(1900);
  });

  it("enforces role-based access control (RBAC) on aggregate action", async () => {
    const { adapter } = await setupDb();

    const app = createApp<{ Bindings: Record<string, unknown> }, { role: string }>({
      adapter,
      getContext: async (c) => ({
        role: c.req.header("x-role") || "viewer",
      }),
    });

    const ordersResource = app.defineResource({
      name: "orders",
      table: ordersTable,
      validator: orderSchema,
      roles: {
        list: ["viewer", "admin"],
        aggregate: ["admin"], // Only admins can see aggregate analytics
      },
      methods: ["list", "aggregate"],
    });

    // Viewer gets 403 Forbidden
    const viewerRes = await ordersResource.request("/aggregate", {
      headers: { "x-role": "viewer" },
    });
    expect(viewerRes.status).toBe(403);

    // Admin succeeds with 200 OK
    const adminRes = await ordersResource.request("/aggregate", {
      headers: { "x-role": "admin" },
    });
    expect(adminRes.status).toBe(200);
  });

  it("responds identically on the alias endpoint /stats", async () => {
    const { adapter } = await setupDb();

    const app = createApp({ adapter });
    const ordersResource = app.defineResource({
      name: "orders",
      table: ordersTable,
      validator: orderSchema,
      softDelete: "deletedAt",
      methods: ["list", "aggregate"],
    });

    const res = await ordersResource.request("/stats?metrics=count,sum:amount");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.count).toBe(7);
    expect(body.data.sum_amount).toBe(2400);
  });

  it("validates guardrails and throws 400 on invalid metrics, columns, or intervals", async () => {
    const { adapter } = await setupDb();

    const app = createApp({ adapter });
    const ordersResource = app.defineResource({
      name: "orders",
      table: ordersTable,
      validator: orderSchema,
      aggregate: {
        allowedMetrics: ["count", "sum"],
        allowedFields: ["amount"],
        allowedGroupBy: ["status"],
      },
    });

    // 1. Disallowed metric
    const res1 = await ordersResource.request("/aggregate?metrics=avg:amount");
    expect(res1.status).toBe(400);
    const body1 = await res1.json();
    expect(body1.error.code).toBe("FORBIDDEN_METRIC");

    // 2. Disallowed field
    const res2 = await ordersResource.request("/aggregate?metrics=sum:id");
    expect(res2.status).toBe(400);
    const body2 = await res2.json();
    expect(body2.error.code).toBe("FORBIDDEN_FIELD");

    // 3. Disallowed groupBy
    const res3 = await ordersResource.request("/aggregate?groupBy=category");
    expect(res3.status).toBe(400);
    const body3 = await res3.json();
    expect(body3.error.code).toBe("FORBIDDEN_GROUP_BY");

    // 4. Unknown function
    const res4 = await ordersResource.request("/aggregate?metrics=drop:amount");
    expect(res4.status).toBe(400);
    const body4 = await res4.json();
    expect(body4.error.code).toBe("INVALID_METRIC");

    // 5. Non-existent column
    const res5 = await ordersResource.request("/aggregate?metrics=sum:non_existent_column");
    expect(res5.status).toBe(400);
    const body5 = await res5.json();
    expect(body5.error.code).toBe("INVALID_COLUMN");

    // 6. Invalid timeframe string
    const res6 = await ordersResource.request("/aggregate?timeframe=invalid_timeframe");
    expect(res6.status).toBe(400);
    const body6 = await res6.json();
    expect(body6.error.code).toBe("INVALID_TIMEFRAME");
  });

  it("returns zero counts and null/zero values when matching zero records", async () => {
    const { adapter } = await setupDb();

    const app = createApp({ adapter });
    const ordersResource = app.defineResource({
      name: "orders",
      table: ordersTable,
      validator: orderSchema,
      softDelete: "deletedAt",
      methods: ["list", "aggregate"],
    });

    // Scalar query with filter matching 0 records
    const scalarRes = await ordersResource.request("/aggregate?status=non_existent&metrics=count,sum:amount,avg:amount,min:amount,max:amount");
    expect(scalarRes.status).toBe(200);
    const scalarBody = await scalarRes.json();
    expect(scalarBody.success).toBe(true);
    expect(scalarBody.data.count).toBe(0);
    expect(scalarBody.data.sum_amount).toBe(0);
    expect(scalarBody.data.avg_amount).toBeNull();
    expect(scalarBody.data.min_amount).toBeNull();
    expect(scalarBody.data.max_amount).toBeNull();
    expect(scalarBody.meta.totalRecords).toBe(0);

    // Grouped query with filter matching 0 records
    const groupedRes = await ordersResource.request("/aggregate?status=non_existent&groupBy=status&metrics=count,sum:amount");
    expect(groupedRes.status).toBe(200);
    const groupedBody = await groupedRes.json();
    expect(groupedBody.success).toBe(true);
    expect(groupedBody.data).toEqual([]);
    expect(groupedBody.meta.totalRecords).toBe(0);
  });
});
