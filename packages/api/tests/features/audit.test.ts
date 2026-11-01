import { describe, it, expect } from "vitest";
import { z } from "zod";
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts } from "../fixtures/db.js";
import type { AuditEntry } from "../../src/types.js";

// Dedicated SQLite table fixture for audit testing
const auditLogsTable = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  resource: text("resource").notNull(),
  recordId: text("record_id").notNull(),
  action: text("action").notNull(),
  actorId: text("actor_id"),
  tenantId: text("tenant_id"),
  diff: text("diff"),
  oldData: text("old_data"),
  newData: text("new_data"),
  metadata: text("metadata"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  timestamp: text("timestamp").notNull(),
});

describe("Automated Audit Trail and Field-Level Diff Logging Engine", () => {
  it("captures document creation with actor, IP, User-Agent, and initial fields", async () => {
    const { adapter, db } = await createTestDb();

    // Create audit_logs table in SQLite memory DB
    await (db as any).run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resource TEXT NOT NULL,
        record_id TEXT NOT NULL,
        action TEXT NOT NULL,
        actor_id TEXT,
        tenant_id TEXT,
        diff TEXT,
        old_data TEXT,
        new_data TEXT,
        metadata TEXT,
        ip TEXT,
        user_agent TEXT,
        timestamp TEXT NOT NULL
      );
    `);

    const capturedEntries: AuditEntry[] = [];

    const app = createApp<{ Bindings: Record<string, unknown> }, { userId: number }>({
      adapter,
      getContext: () => ({ userId: 99 }),
      audit: {
        mode: "sync",
        store: (entry) => {
          capturedEntries.push(entry);
        },
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        price: z.number().optional(),
      }),
      audit: {
        includeSnapshots: true,
      },
    });

    const res = await postsResource.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "203.0.113.195",
        "User-Agent": "Mozilla/5.0 ERP-Client",
      },
      body: JSON.stringify({ title: "Audit PO #1", price: 250 }),
    });

    expect(res.status).toBe(201);
    expect(capturedEntries.length).toBe(1);

    const entry = capturedEntries[0];
    expect(entry.resource).toBe("posts");
    expect(entry.action).toBe("create");
    expect(entry.actorId).toBe(99);
    expect(entry.ip).toBe("203.0.113.195");
    expect(entry.userAgent).toBe("Mozilla/5.0 ERP-Client");
    expect(entry.newData).toBeDefined();
    expect((entry.newData as any).title).toBe("Audit PO #1");
  });

  it("computes exact field-level diffs on updates, ignoring untouched fields", async () => {
    const { adapter } = await createTestDb();
    const capturedEntries: AuditEntry[] = [];

    const app = createApp<{ Bindings: Record<string, unknown> }, { actorId: string }>({
      adapter,
      getContext: () => ({ actorId: "emp_101" }),
      audit: {
        mode: "sync",
        store: (entry) => {
          capturedEntries.push(entry);
        },
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string().optional(),
        content: z.string().optional(),
        price: z.number().optional(),
      }),
      audit: true,
    });

    const seed: any = await adapter.insert(posts, {
      title: "Untouched Title",
      content: "Stable Content",
      price: 100,
    });

    // Client only updates price from 100 -> 150
    const res = await postsResource.request(`/${seed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: 150 }),
    });

    expect(res.status).toBe(200);
    expect(capturedEntries.length).toBe(1);

    const entry = capturedEntries[0];
    expect(entry.action).toBe("update");
    expect(entry.recordId).toBe(String(seed.id));
    expect(entry.actorId).toBe("emp_101");

    // Only price changed! Title and content should NOT be in diff
    const priceDiff = entry.diff?.find((d) => d.field === "price");
    expect(priceDiff).toBeDefined();
    expect(priceDiff?.from).toBe(100);
    expect(priceDiff?.to).toBe(150);

    const titleDiff = entry.diff?.find((d) => d.field === "title");
    expect(titleDiff).toBeUndefined();
  });

  it("stamps workflow transition metadata when state transitions occur", async () => {
    const { adapter } = await createTestDb();
    const capturedEntries: AuditEntry[] = [];

    const app = createApp({
      adapter,
      audit: {
        mode: "sync",
        store: (entry) => {
          capturedEntries.push(entry);
        },
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string().optional(),
        status: z.string().optional(),
      }),
      workflow: {
        field: "status",
        initial: "draft",
        states: {
          draft: { editable: true },
          submitted: { editable: false },
        },
        transitions: [
          { from: "draft", to: "submitted", action: "submit_for_approval" },
        ],
      },
      audit: true,
    });

    const seed: any = await adapter.insert(posts, {
      title: "Invoice 123",
      status: "draft",
    });

    const res = await postsResource.request(`/${seed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "submitted" }),
    });

    expect(res.status).toBe(200);
    expect(capturedEntries.length).toBe(1);

    const entry = capturedEntries[0];
    expect(entry.action).toBe("transition");
    expect(entry.metadata?.workflow).toEqual({
      from: "draft",
      to: "submitted",
      action: "submit_for_approval",
    });

    const statusDiff = entry.diff?.find((d) => d.field === "status");
    expect(statusDiff?.from).toBe("draft");
    expect(statusDiff?.to).toBe("submitted");
  });

  it("excludes sensitive fields and masks confidential values in diffs and snapshots", async () => {
    const { adapter } = await createTestDb();
    const capturedEntries: AuditEntry[] = [];

    const app = createApp({
      adapter,
      audit: {
        mode: "sync",
        // Global exclusion
        excludeFields: ["content"],
        // Global masking
        maskFields: ["price"],
        maskString: "REDACTED",
        store: (entry) => {
          capturedEntries.push(entry);
        },
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string().optional(),
        content: z.string().optional(),
        price: z.number().optional(),
      }),
      audit: {
        includeSnapshots: true,
      },
    });

    const seed: any = await adapter.insert(posts, {
      title: "Public Title",
      content: "Super Secret Password",
      price: 500,
    });

    // Update title, content (excluded), and price (masked)
    const res = await postsResource.request(`/${seed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Updated Title",
        content: "New Secret Password",
        price: 750,
      }),
    });

    expect(res.status).toBe(200);
    expect(capturedEntries.length).toBe(1);

    const entry = capturedEntries[0];

    // 1. content is completely excluded from diff and snapshots
    const contentDiff = entry.diff?.find((d) => d.field === "content");
    expect(contentDiff).toBeUndefined();
    expect((entry.oldData as any)?.content).toBeUndefined();
    expect((entry.newData as any)?.content).toBeUndefined();

    // 2. price is masked with REDACTED
    const priceDiff = entry.diff?.find((d) => d.field === "price");
    expect(priceDiff?.from).toBe("REDACTED");
    expect(priceDiff?.to).toBe("REDACTED");
    expect((entry.newData as any)?.price).toBe("REDACTED");

    // 3. title appears in plain text
    const titleDiff = entry.diff?.find((d) => d.field === "title");
    expect(titleDiff?.from).toBe("Public Title");
    expect(titleDiff?.to).toBe("Updated Title");
  });

  it("captures deletion audit with oldData snapshot", async () => {
    const { adapter } = await createTestDb();
    const capturedEntries: AuditEntry[] = [];

    const app = createApp({
      adapter,
      audit: {
        mode: "sync",
        store: (entry) => {
          capturedEntries.push(entry);
        },
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
      audit: {
        includeSnapshots: true,
      },
    });

    const seed: any = await adapter.insert(posts, { title: "To Be Deleted" });

    const delRes = await postsResource.request(`/${seed.id}`, { method: "DELETE" });
    expect(delRes.status).toBe(200);

    expect(capturedEntries.length).toBe(1);
    const entry = capturedEntries[0];
    expect(entry.action).toBe("delete");
    expect(entry.recordId).toBe(String(seed.id));
    expect((entry.oldData as any)?.title).toBe("To Be Deleted");
    expect(entry.newData).toBeNull();
  });

  it("propagates tenantId in multi-tenant environments automatically", async () => {
    const { adapter } = await createTestDb();
    const capturedEntries: AuditEntry[] = [];

    const app = createApp({
      adapter,
      tenancy: {
        field: "tenantId",
        resolve: () => "corp_acme",
      },
      audit: {
        mode: "sync",
        store: (entry) => {
          capturedEntries.push(entry);
        },
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
      tenancy: true,
      audit: true,
    });

    const res = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Acme Document" }),
    });

    expect(res.status).toBe(201);
    expect(capturedEntries.length).toBe(1);
    expect(capturedEntries[0].tenantId).toBe("corp_acme");
  });

  it("records audit entries for batch-update and batch-delete", async () => {
    const { adapter } = await createTestDb();
    const capturedEntries: AuditEntry[] = [];

    const app = createApp({
      adapter,
      audit: {
        mode: "sync",
        store: (entry) => {
          capturedEntries.push(entry);
        },
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      methods: ["list", "detail", "create", "update", "delete", "batch-update", "batch-delete"],
      validator: z.object({
        title: z.string().optional(),
        price: z.number().optional(),
      }),
      audit: true,
    });

    const p1: any = await adapter.insert(posts, { title: "Item 1", price: 10 });
    const p2: any = await adapter.insert(posts, { title: "Item 2", price: 20 });

    // 1. Batch Update
    const batchUpRes = await postsResource.request("/batch-update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [p1.id, p2.id],
        data: { price: 99 },
      }),
    });
    expect(batchUpRes.status).toBe(200);

    const batchUpEntries = capturedEntries.filter((e) => e.action === "batch-update");
    expect(batchUpEntries.length).toBe(2);
    expect(batchUpEntries.map((e) => e.recordId)).toEqual([p1.id, p2.id]);

    // 2. Batch Delete
    const batchDelRes = await postsResource.request("/batch-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [p1.id, p2.id],
      }),
    });
    expect(batchDelRes.status).toBe(200);

    const batchDelEntries = capturedEntries.filter((e) => e.action === "batch-delete");
    expect(batchDelEntries.length).toBe(2);
    expect(batchDelEntries.map((e) => e.recordId)).toEqual([p1.id, p2.id]);
  });

  it("persists audit entries directly into a database table via audit.table", async () => {
    const { adapter, db } = await createTestDb();

    // Create table in SQLite
    await (db as any).run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resource TEXT NOT NULL,
        record_id TEXT NOT NULL,
        action TEXT NOT NULL,
        actor_id TEXT,
        tenant_id TEXT,
        diff TEXT,
        old_data TEXT,
        new_data TEXT,
        metadata TEXT,
        ip TEXT,
        user_agent TEXT,
        timestamp TEXT NOT NULL
      );
    `);

    const app = createApp<{ Bindings: Record<string, unknown> }, { userId: number }>({
      adapter,
      getContext: () => ({ userId: 55 }),
      audit: {
        table: auditLogsTable,
        mode: "sync",
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        price: z.number().optional(),
      }),
      audit: true,
    });

    // 1. Create Post
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "DB Audit PO", price: 300 }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    // Verify written to SQLite table directly
    const logsInDb: any[] = await adapter.findMany(auditLogsTable, {
      where: (cols: any, { eq }: any) => eq(cols.recordId, String(created.data.id)),
    }) as any[];

    expect(logsInDb.length).toBe(1);
    expect(logsInDb[0].resource).toBe("posts");
    expect(logsInDb[0].action).toBe("create");
    expect(logsInDb[0].actorId).toBe("55");
    expect(JSON.parse(logsInDb[0].diff)).toBeDefined();

    // 2. Update Post
    const updateRes = await postsResource.request(`/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: 400 }),
    });
    expect(updateRes.status).toBe(200);

    const updatedLogsInDb: any[] = await adapter.findMany(auditLogsTable, {
      where: (cols: any, { eq }: any) => eq(cols.recordId, String(created.data.id)),
    }) as any[];

    expect(updatedLogsInDb.length).toBe(2);
    const updateLog = updatedLogsInDb.find((l) => l.action === "update");
    expect(updateLog).toBeDefined();
    const diff = JSON.parse(updateLog.diff);
    expect(diff).toEqual([{ field: "price", from: 300, to: 400 }]);
  });
  it("respects explicit audit: false to opt out of globally configured auditing", async () => {
    const { adapter } = await createTestDb();
    const capturedEntries: AuditEntry[] = [];

    const app = createApp({
      adapter,
      audit: {
        mode: "sync",
        store: (entry) => {
          capturedEntries.push(entry);
        },
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
      // Explicitly disabled on this resource
      audit: false,
    });

    // 1. Create should not be audited
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Unaudited Post" }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(capturedEntries.length).toBe(0);

    // 2. Update should not be audited
    const patchRes = await postsResource.request(`/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Unaudited Post Modified" }),
    });
    expect(patchRes.status).toBe(200);
    expect(capturedEntries.length).toBe(0);

    // 3. Delete should not be audited
    const delRes = await postsResource.request(`/${created.data.id}`, {
      method: "DELETE",
    });
    expect(delRes.status).toBe(200);
    expect(capturedEntries.length).toBe(0);
  });

  it("filters audited events via selective actions configuration", async () => {
    const { adapter } = await createTestDb();
    const capturedEntries: AuditEntry[] = [];

    const app = createApp({
      adapter,
      audit: {
        mode: "sync",
        store: (entry) => {
          capturedEntries.push(entry);
        },
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string().optional() }),
      audit: {
        // Only audit deletions!
        actions: ["delete"],
      },
    });

    // 1. Create -> not audited
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Delete-only audit" }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(capturedEntries.length).toBe(0);

    // 2. Update -> not audited
    const patchRes = await postsResource.request(`/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated title" }),
    });
    expect(patchRes.status).toBe(200);
    expect(capturedEntries.length).toBe(0);

    // 3. Delete -> audited!
    const delRes = await postsResource.request(`/${created.data.id}`, {
      method: "DELETE",
    });
    expect(delRes.status).toBe(200);
    expect(capturedEntries.length).toBe(1);
    expect(capturedEntries[0].action).toBe("delete");
  });

  it("invokes custom getActorId and custom metadata enrichment callback", async () => {
    const { adapter } = await createTestDb();
    const capturedEntries: AuditEntry[] = [];

    const app = createApp<{ Bindings: Record<string, unknown> }, { sessionUser: { email: string; sub: string } }>({
      adapter,
      getContext: () => ({ sessionUser: { email: "lead@example.com", sub: "auth0|98765" } }),
      audit: {
        mode: "sync",
        // Custom actor extraction function
        getActorId: (ctx) => ctx.sessionUser.sub,
        store: (entry) => {
          capturedEntries.push(entry);
        },
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
      audit: {
        // Custom metadata callback extracting headers and context
        metadata: (c, ctx, record) => ({
          changeReason: c.req.header("X-Change-Reason"),
          userEmail: ctx.sessionUser.email,
          titleEcho: record?.title,
        }),
      },
    });

    const res = await postsResource.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Change-Reason": "Emergency Patch Order",
      },
      body: JSON.stringify({ title: "Custom Actor PO" }),
    });

    expect(res.status).toBe(201);
    expect(capturedEntries.length).toBe(1);

    const entry = capturedEntries[0];
    expect(entry.actorId).toBe("auth0|98765");
    expect(entry.metadata).toEqual({
      changeReason: "Emergency Patch Order",
      userEmail: "lead@example.com",
      titleEcho: "Custom Actor PO",
    });
  });

  it("is resilient to audit store failures and does not crash the client request", async () => {
    const { adapter } = await createTestDb();

    const app = createApp({
      adapter,
      audit: {
        mode: "sync",
        store: () => {
          // Simulate audit backend / Datadog / DB connection crash
          throw new Error("Audit Sink Connection Refused");
        },
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string().optional() }),
      audit: true,
    });

    // Create should succeed with 201 despite audit store throwing
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Resilient Post" }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.data.title).toBe("Resilient Post");

    // Update should succeed with 200 despite audit store throwing
    const updateRes = await postsResource.request(`/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Resilient Post Modified" }),
    });
    expect(updateRes.status).toBe(200);

    // Delete should succeed with 200 despite audit store throwing
    const deleteRes = await postsResource.request(`/${created.data.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(200);
  });

});
