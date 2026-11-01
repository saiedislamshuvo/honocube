import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts } from "../fixtures/db.js";
import {
  signWebhookPayload,
  verifyWebhookSignature,
  isWebhookEventMatch,
  calculateRetryBackoff,
  dispatchSingleWebhook,
  processOutboxQueue,
} from "../../src/utils/webhooks.js";
import type { OutboxRecord, WebhookDeliveryRecord } from "../../src/types.js";

// Dedicated SQLite tables for outbox and webhook deliveries
const outboxTable = sqliteTable("outbox_events", {
  id: text("id").primaryKey(),
  resource: text("resource").notNull(),
  recordId: text("record_id").notNull(),
  event: text("event").notNull(),
  payload: text("payload").notNull(),
  headers: text("headers"),
  tenantId: text("tenant_id"),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  nextRetryAt: text("next_retry_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

const webhookDeliveriesTable = sqliteTable("webhook_deliveries", {
  id: text("id").primaryKey(),
  outboxId: text("outbox_id"),
  endpointUrl: text("endpoint_url").notNull(),
  event: text("event").notNull(),
  attempt: integer("attempt").notNull(),
  statusCode: integer("status_code"),
  durationMs: integer("duration_ms").notNull(),
  error: text("error"),
  requestHeaders: text("request_headers"),
  requestPayload: text("request_payload"),
  responseBody: text("response_body"),
  timestamp: text("timestamp").notNull(),
});

const setupTestTables = async (db: any) => {
  await db.run(`
    CREATE TABLE IF NOT EXISTS outbox_events (
      id TEXT PRIMARY KEY,
      resource TEXT NOT NULL,
      record_id TEXT NOT NULL,
      event TEXT NOT NULL,
      payload TEXT NOT NULL,
      headers TEXT,
      tenant_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      next_retry_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id TEXT PRIMARY KEY,
      outbox_id TEXT,
      endpoint_url TEXT NOT NULL,
      event TEXT NOT NULL,
      attempt INTEGER NOT NULL,
      status_code INTEGER,
      duration_ms INTEGER NOT NULL,
      error TEXT,
      request_headers TEXT,
      request_payload TEXT,
      response_body TEXT,
      timestamp TEXT NOT NULL
    );
  `);
};

describe("Cryptographic HMAC Webhook Signatures", () => {
  const secret = "whsec_test_secret_key_123456789";
  const samplePayload = {
    id: "evt_123",
    resource: "orders",
    event: "orders.create",
    data: { amount: 500, currency: "USD" },
  };

  it("signs and successfully verifies payloads with valid secret", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const header = await signWebhookPayload(samplePayload, secret, timestamp);

    expect(header).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);

    const result = await verifyWebhookSignature(samplePayload, header, secret, {
      now: timestamp,
      toleranceSeconds: 300,
    });

    expect(result.valid).toBe(true);
    expect(result.timestamp).toBe(timestamp);
    expect(result.signature).toBeDefined();
  });

  it("works with raw string payloads as well as JSON objects", async () => {
    const rawString = JSON.stringify(samplePayload);
    const header = await signWebhookPayload(rawString, secret);
    const result = await verifyWebhookSignature(rawString, header, secret);
    expect(result.valid).toBe(true);
  });

  it("rejects tampered payloads with INVALID_SIGNATURE", async () => {
    const header = await signWebhookPayload(samplePayload, secret);
    const tamperedPayload = { ...samplePayload, data: { amount: 9999, currency: "USD" } };

    const result = await verifyWebhookSignature(tamperedPayload, header, secret);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("INVALID_SIGNATURE");
  });

  it("rejects signatures produced with wrong secret", async () => {
    const header = await signWebhookPayload(samplePayload, "wrong_secret");
    const result = await verifyWebhookSignature(samplePayload, header, secret);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("INVALID_SIGNATURE");
  });

  it("rejects expired timestamps outside the tolerance window", async () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
    const header = await signWebhookPayload(samplePayload, secret, oldTimestamp);

    const result = await verifyWebhookSignature(samplePayload, header, secret, {
      now: Math.floor(Date.now() / 1000),
      toleranceSeconds: 300, // 5 minutes max
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("TIMESTAMP_EXPIRED");
  });

  it("allows expired timestamps when tolerance is disabled (toleranceSeconds = 0)", async () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 10000;
    const header = await signWebhookPayload(samplePayload, secret, oldTimestamp);

    const result = await verifyWebhookSignature(samplePayload, header, secret, {
      toleranceSeconds: 0,
    });

    expect(result.valid).toBe(true);
  });

  it("handles missing or malformed signature headers gracefully", async () => {
    expect(await verifyWebhookSignature(samplePayload, null, secret)).toEqual({
      valid: false,
      reason: "MISSING_HEADER",
    });

    expect(await verifyWebhookSignature(samplePayload, "", secret)).toEqual({
      valid: false,
      reason: "MISSING_HEADER",
    });

    expect(await verifyWebhookSignature(samplePayload, "invalid_format", secret)).toEqual({
      valid: false,
      reason: "MISSING_TIMESTAMP",
    });

    expect(await verifyWebhookSignature(samplePayload, "t=notanumber,v1=abc", secret)).toEqual({
      valid: false,
      reason: "MALFORMED_HEADER",
    });

    expect(await verifyWebhookSignature(samplePayload, "t=1700000000", secret)).toEqual({
      valid: false,
      reason: "MISSING_SIGNATURE",
      timestamp: 1700000000,
    });
  });

  it("verifies headers containing multiple v1 signatures (rolling secret support)", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const oldSecret = "old_secret_key_1";
    const newSecret = "new_secret_key_2";

    const oldSigHeader = await signWebhookPayload(samplePayload, oldSecret, timestamp);
    const newSigHeader = await signWebhookPayload(samplePayload, newSecret, timestamp);

    const oldSigHex = oldSigHeader.split("v1=")[1];
    const newSigHex = newSigHeader.split("v1=")[1];

    const dualHeader = `t=${timestamp},v1=${oldSigHex},v1=${newSigHex}`;

    // Should verify successfully against either secret
    const verifyWithOld = await verifyWebhookSignature(samplePayload, dualHeader, oldSecret);
    expect(verifyWithOld.valid).toBe(true);

    const verifyWithNew = await verifyWebhookSignature(samplePayload, dualHeader, newSecret);
    expect(verifyWithNew.valid).toBe(true);
  });
});

describe("Webhook Event Matching & Backoff Utilities", () => {
  it("matches wildcard events correctly", () => {
    expect(isWebhookEventMatch(["*"], "posts", "create")).toBe(true);
    expect(isWebhookEventMatch(["posts.*"], "posts", "update")).toBe(true);
    expect(isWebhookEventMatch(["posts.*"], "users", "update")).toBe(false);
    expect(isWebhookEventMatch(["posts.create"], "posts", "create")).toBe(true);
    expect(isWebhookEventMatch(["posts.create"], "posts", "delete")).toBe(false);
    expect(isWebhookEventMatch(["create"], "posts", "create")).toBe(true);
    expect(isWebhookEventMatch([], "posts", "create")).toBe(true);
    expect(isWebhookEventMatch(undefined, "posts", "create")).toBe(true);
  });

  it("calculates exponential retry backoff correctly", () => {
    expect(calculateRetryBackoff(1, 1000)).toBe(1000);
    expect(calculateRetryBackoff(2, 1000)).toBe(2000);
    expect(calculateRetryBackoff(3, 1000)).toBe(4000);
    expect(calculateRetryBackoff(4, 1000)).toBe(8000);
    // Upper bound
    expect(calculateRetryBackoff(10, 1000, 30000)).toBe(30000);
  });

  it("handles dispatchSingleWebhook when fetch fails", async () => {
    const failingEndpoint = {
      url: "https://invalid-non-existent-domain.internal/webhook",
      secret: "secret",
    };
    const sampleRecord: OutboxRecord = {
      id: "evt_fail_1",
      resource: "orders",
      recordId: "123",
      event: "create",
      payload: { id: "123" },
      status: "pending",
      attempts: 0,
      createdAt: new Date().toISOString(),
    };

    const mockFailingFetch = vi.fn().mockRejectedValue(new Error("DNS resolution failed"));
    const delivery = await dispatchSingleWebhook(failingEndpoint, sampleRecord, {
      fetchFn: mockFailingFetch as any,
    });

    expect(delivery.error).toContain("DNS resolution failed");
    expect(delivery.statusCode).toBeNull();
  });
});

describe("Transactional Outbox Engine", () => {
  it("persists outbox entry atomically in the database transaction during create", async () => {
    const { adapter, db } = await createTestDb();
    await setupTestTables(db);

    const capturedTxSinks: OutboxRecord[] = [];

    const app = createApp({
      adapter,
      outbox: {
        table: outboxTable,
        autoDispatch: false,
        sink: (record) => {
          capturedTxSinks.push(record);
        },
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        content: z.string().optional(),
      }),
    });

    const res = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Outbox Article 1", content: "Reliable messaging" }),
    });

    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.success).toBe(true);

    // Verify outbox entry in database table
    const outboxRows: any[] = await adapter.findMany(outboxTable, {
      where: (cols: any, { eq }: any) => eq(cols.resource, "posts"),
    });
    expect(outboxRows.length).toBe(1);
    const row = outboxRows[0];
    expect(row.resource).toBe("posts");
    expect(row.recordId).toBe(String(body.data.id));
    expect(row.event).toBe("create");
    expect(row.status).toBe("pending");
    expect(row.attempts).toBe(0);

    const parsedPayload = JSON.parse(row.payload);
    expect(parsedPayload.data.title).toBe("Outbox Article 1");

    // Verify transactional sink was invoked
    expect(capturedTxSinks.length).toBe(1);
    expect(capturedTxSinks[0].event).toBe("create");
  });

  it("persists outbox entry on update, delete, batch-update, and batch-delete", async () => {
    const { adapter, db } = await createTestDb();
    await setupTestTables(db);

    const app = createApp({
      adapter,
      outbox: {
        table: outboxTable,
        autoDispatch: false,
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      methods: ["list", "detail", "create", "update", "delete", "batch-update"],
      validator: z.object({
        title: z.string(),
        content: z.string().optional(),
      }),
    });

    // 1. Create a post
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Initial Title" }),
    });
    const created = (await createRes.json()) as any;
    const postId = created.data.id;

    // 2. Update post
    const updateRes = await postsResource.request(`/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Title" }),
    });
    expect(updateRes.status).toBe(200);

    // 3. Batch Update
    const batchUpdateRes = await postsResource.request("/batch-update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [postId], data: { content: "Batch content" } }),
    });
    expect(batchUpdateRes.status).toBe(200);

    // 4. Delete post
    const deleteRes = await postsResource.request(`/${postId}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(200);

    // Verify all outbox records in database
    const outboxRows: any[] = await adapter.findMany(outboxTable, {});
    const events = outboxRows.map((r: any) => r.event);
    expect(events).toContain("create");
    expect(events).toContain("update");
    expect(events).toContain("batch-update");
    expect(events).toContain("delete");

    const updateRecord = outboxRows.find((r: any) => r.event === "update");
    const parsedUpdatePayload = JSON.parse(updateRecord.payload);
    expect(parsedUpdatePayload.diff).toBeDefined();
    expect(parsedUpdatePayload.previous.title).toBe("Initial Title");
    expect(parsedUpdatePayload.data.title).toBe("Updated Title");
  });

  it("persists outbox entry on workflow transitions with transition event and metadata", async () => {
    const { adapter, db } = await createTestDb();
    await setupTestTables(db);

    const app = createApp({
      adapter,
      outbox: {
        table: outboxTable,
        autoDispatch: false,
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        status: z.string().optional(),
      }),
      workflow: {
        field: "status",
        initial: "draft",
        transitions: [
          { action: "submit", from: "draft", to: "review" },
          { action: "publish", from: "review", to: "published" },
        ],
      },
    });

    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Workflow Article" }),
    });
    const created: any = await createRes.json();
    const postId = created.data.id;

    // Transition from draft to review
    const transitionRes = await postsResource.request(`/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "review" }),
    });
    expect(transitionRes.status).toBe(200);

    const outboxRows: any[] = await adapter.findMany(outboxTable, {
      where: (cols: any, { eq }: any) => eq(cols.event, "transition"),
    });
    expect(outboxRows.length).toBe(1);
    const transitionRecord = outboxRows[0];
    const payload = JSON.parse(transitionRecord.payload);
    expect(payload.workflow).toEqual({
      from: "draft",
      to: "review",
      action: "submit",
    });
  });

  it("rolls back outbox entries when database transaction fails (atomicity guarantee)", async () => {
    const { adapter, db } = await createTestDb();
    await setupTestTables(db);

    const app = createApp({
      adapter,
      strategy: "transaction",
      outbox: {
        table: outboxTable,
        autoDispatch: false,
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
      }),
      hooks: {
        afterCreate: async () => {
          throw new Error("Simulated Transaction Failure");
        },
      },
    });

    const res = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Will Fail" }),
    });

    expect(res.status).toBe(500);

    // Verify neither post nor outbox event was committed due to rollback
    const postRows: any[] = await adapter.findMany(posts, {});
    expect(postRows.length).toBe(0);

    const outboxRows: any[] = await adapter.findMany(outboxTable, {});
    expect(outboxRows.length).toBe(0);
  });

  it("honors resource-level opt-out and action filters", async () => {
    const { adapter, db } = await createTestDb();
    await setupTestTables(db);

    const app = createApp({
      adapter,
      outbox: {
        table: outboxTable,
        autoDispatch: false,
      },
    });

    // Resource with outbox disabled
    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
      }),
      outbox: false,
    });

    const res = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "No Outbox Post" }),
    });

    expect(res.status).toBe(201);
    const outboxRows: any[] = await adapter.findMany(outboxTable, {
      where: (cols: any, { eq }: any) => eq(cols.resource, "posts"),
    });
    expect(outboxRows.length).toBe(0);
  });
});

describe("Outbound Webhook Dispatcher with HMAC", () => {
  it("dispatches webhook requests with standard headers and valid HMAC signature", async () => {
    const { adapter, db } = await createTestDb();
    await setupTestTables(db);

    const webhookSecret = "whsec_client_webhook_secret_999";
    const capturedRequests: { url: string; headers: Record<string, string>; body: any }[] = [];

    const mockFetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      capturedRequests.push({
        url,
        headers: init.headers,
        body: JSON.parse(init.body),
      });
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const capturedDeliveries: WebhookDeliveryRecord[] = [];

    const app = createApp({
      adapter,
      outbox: {
        table: outboxTable,
      },
      webhooks: {
        mode: "sync",
        fetch: mockFetch as any,
        deliveryTable: webhookDeliveriesTable,
        deliverySink: (delivery) => {
          capturedDeliveries.push(delivery);
        },
        endpoints: [
          {
            url: "https://example.com/webhooks/orders",
            secret: webhookSecret,
            events: ["posts.create"],
            headers: {
              "X-Custom-Client": "honocube-app",
            },
          },
        ],
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
      }),
    });

    const res = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Webhook Trigger Post" }),
    });

    expect(res.status).toBe(201);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const captured = capturedRequests[0];
    expect(captured.url).toBe("https://example.com/webhooks/orders");
    expect(captured.headers["X-Custom-Client"]).toBe("honocube-app");
    expect(captured.headers["X-Honocube-Event"]).toBe("create");
    expect(captured.headers["X-Honocube-Delivery"]).toBeDefined();

    const signatureHeader = captured.headers["X-Honocube-Signature"];
    expect(signatureHeader).toBeDefined();

    // Verify that the signature header verifies correctly with verifyWebhookSignature
    const verifyResult = await verifyWebhookSignature(
      captured.body,
      signatureHeader,
      webhookSecret
    );
    expect(verifyResult.valid).toBe(true);

    // Verify delivery logged to database table
    const deliveryRows: any[] = await adapter.findMany(webhookDeliveriesTable, {});
    expect(deliveryRows.length).toBe(1);
    expect(deliveryRows[0].statusCode).toBe(200);

    // Verify delivery sink callback
    expect(capturedDeliveries.length).toBe(1);
    expect(capturedDeliveries[0].statusCode).toBe(200);

    // Verify outbox entry status updated to "delivered"
    const outboxRows: any[] = await adapter.findMany(outboxTable, {});
    expect(outboxRows.length).toBe(1);
    expect(outboxRows[0].status).toBe("delivered");
    expect(outboxRows[0].attempts).toBe(1);
  });

  it("updates outbox status to pending/failed and computes nextRetryAt when dispatch fails", async () => {
    const { adapter, db } = await createTestDb();
    await setupTestTables(db);

    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response("Internal Server Error", { status: 500, statusText: "Internal Error" });
    });

    const app = createApp({
      adapter,
      outbox: {
        table: outboxTable,
      },
      webhooks: {
        mode: "sync",
        fetch: mockFetch as any,
        maxAttempts: 3,
        retryBackoffMs: 2000,
        endpoints: [
          {
            url: "https://example.com/failing-endpoint",
            secret: "secret",
          },
        ],
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
      }),
    });

    const res = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Failing Dispatch Post" }),
    });

    expect(res.status).toBe(201);

    const outboxRows: any[] = await adapter.findMany(outboxTable, {});
    expect(outboxRows.length).toBe(1);
    const row = outboxRows[0];
    expect(row.status).toBe("pending"); // attempt 1 < maxAttempts 3 -> pending retry
    expect(row.attempts).toBe(1);
    expect(row.lastError).toContain("HTTP 500");
    expect(row.nextRetryAt).toBeDefined();
  });

  it("filters webhook dispatch based on endpoint event rules and custom filter predicate", async () => {
    const { adapter, db } = await createTestDb();
    await setupTestTables(db);

    const mockFetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));

    const app = createApp({
      adapter,
      outbox: {
        table: outboxTable,
      },
      webhooks: {
        mode: "sync",
        fetch: mockFetch as any,
        endpoints: [
          {
            url: "https://example.com/only-orders",
            secret: "secret",
            events: ["orders.*"], // will not match "posts"
          },
          {
            url: "https://example.com/filtered-posts",
            secret: "secret",
            events: ["posts.*"],
            filter: (rec) => rec.payload.data.title.includes("Important"),
          },
        ],
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
      }),
    });

    // 1. Unimportant post -> filtered out by predicate
    await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Regular Post" }),
    });

    expect(mockFetch).not.toHaveBeenCalled();

    // 2. Important post -> matches filtered-posts
    await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Important Announcement" }),
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("Background Queue Processing Engine (processOutboxQueue)", () => {
  it("polls pending outbox records and dispatches them with retry progression", async () => {
    const { adapter, db } = await createTestDb();
    await setupTestTables(db);

    const mockFetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));

    // Insert pending outbox row via adapter
    await adapter.insert(outboxTable, {
      id: "evt_queue_1",
      resource: "posts",
      recordId: "100",
      event: "create",
      payload: JSON.stringify({ id: 100, data: { title: "Queue Post" } }),
      status: "pending",
      attempts: 0,
      createdAt: new Date().toISOString(),
    });

    const result = await processOutboxQueue(adapter, {
      outboxTable,
      fetch: mockFetch as any,
      endpoints: [
        {
          url: "https://example.com/queue-webhook",
          secret: "queue_secret",
        },
      ],
      webhooks: {
        maxAttempts: 3,
        retryBackoffMs: 1000,
      },
    });

    expect(result.processed).toBe(1);
    expect(result.delivered).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const updatedRows: any[] = await adapter.findMany(outboxTable, {
      where: (cols: any, { eq }: any) => eq(cols.id, "evt_queue_1"),
    });
    expect(updatedRows[0].status).toBe("delivered");
    expect(updatedRows[0].attempts).toBe(1);
  });

  it("marks records as failed when maxAttempts is reached during queue processing", async () => {
    const { adapter, db } = await createTestDb();
    await setupTestTables(db);

    const mockFailingFetch = vi.fn().mockResolvedValue(new Response("Gateway Timeout", { status: 504 }));

    // Insert record with attempt 2 of 3 (will become 3 of 3 -> failed)
    await adapter.insert(outboxTable, {
      id: "evt_queue_fail",
      resource: "posts",
      recordId: "200",
      event: "create",
      payload: JSON.stringify({ id: 200, data: { title: "Failing Post" } }),
      status: "failed",
      attempts: 2,
      createdAt: new Date().toISOString(),
      nextRetryAt: new Date(Date.now() - 5000).toISOString(),
    });

    const result = await processOutboxQueue(adapter, {
      outboxTable,
      fetch: mockFailingFetch as any,
      endpoints: [
        {
          url: "https://example.com/failing-webhook",
          secret: "queue_secret",
        },
      ],
      webhooks: {
        maxAttempts: 3,
        retryBackoffMs: 1000,
      },
    });

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);

    const updatedRows: any[] = await adapter.findMany(outboxTable, {
      where: (cols: any, { eq }: any) => eq(cols.id, "evt_queue_fail"),
    });
    expect(updatedRows[0].status).toBe("failed");
    expect(updatedRows[0].attempts).toBe(3);
    expect(updatedRows[0].nextRetryAt).toBeNull();
  });
});
