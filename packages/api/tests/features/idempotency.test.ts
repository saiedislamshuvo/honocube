import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { IdempotencyRecord, IdempotencyStorage } from "../../src/types.js";
import { createTestDb, posts } from "../fixtures/db.js";

class CustomTestStorage implements IdempotencyStorage {
  public store = new Map<string, IdempotencyRecord>();
  public getCount = 0;
  public setCount = 0;
  public deleteCount = 0;

  async get(key: string) {
    this.getCount++;
    const record = this.store.get(key);
    if (!record) return null;
    if (Date.now() > record.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return record;
  }

  async set(key: string, record: IdempotencyRecord, ttlMs: number) {
    this.setCount++;
    const expiresAt = record.expiresAt || Date.now() + ttlMs;
    this.store.set(key, { ...record, expiresAt });
  }

  async delete(key: string) {
    this.deleteCount++;
    this.store.delete(key);
  }
}

describe("Mutation Idempotency Key Engine", () => {
  it("replays identical mutation requests with cached response and Idempotent-Replayed header", async () => {
    const { adapter } = await createTestDb();
    let insertCount = 0;

    const app = createApp({ adapter });
    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      idempotency: { enabled: true },
      validator: z.object({ title: z.string() }),
      hooks: {
        afterCreate: async () => {
          insertCount++;
        },
      },
    });

    const idempotencyKey = "tx-create-order-001";
    const payload = { title: "Idempotent Post Title" };

    // 1. Initial POST request
    const res1 = await postsResource.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    expect(res1.status).toBe(201);
    expect(res1.headers.get("Idempotent-Replayed")).toBeNull();
    const data1 = await res1.json();
    expect(data1.success).toBe(true);
    expect(data1.data.title).toBe("Idempotent Post Title");
    expect(insertCount).toBe(1);

    // 2. Second POST request with identical payload and key
    const res2 = await postsResource.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    expect(res2.status).toBe(201);
    expect(res2.headers.get("Idempotent-Replayed")).toBe("true");
    const data2 = await res2.json();
    expect(data2).toEqual(data1);
    // Ensure the mutation hook was NOT executed a second time
    expect(insertCount).toBe(1);

    // 3. Third POST request with whitespace formatting variation (canonical JSON equivalence)
    const res3 = await postsResource.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload, null, 2),
    });

    expect(res3.status).toBe(201);
    expect(res3.headers.get("Idempotent-Replayed")).toBe("true");
    const data3 = await res3.json();
    expect(data3).toEqual(data1);
    expect(insertCount).toBe(1);
  });

  it("rejects mismatched payload on same idempotency key with HTTP 422 IDEMPOTENCY_KEY_MISMATCH", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });
    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      idempotency: { enabled: true },
      validator: z.object({ title: z.string() }),
    });

    const idempotencyKey = "tx-mismatch-test";

    // 1. First mutation
    const res1 = await postsResource.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ title: "First Title" }),
    });
    expect(res1.status).toBe(201);

    // 2. Second mutation reusing key with different payload
    const res2 = await postsResource.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ title: "Completely Different Title" }),
    });

    expect(res2.status).toBe(422);
    const json = await res2.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("IDEMPOTENCY_KEY_MISMATCH");
    expect(json.error.message).toContain(idempotencyKey);
  });

  it("enforces concurrent execution lock with HTTP 409 IDEMPOTENCY_KEY_LOCKED and Retry-After header", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    let releaseBlocker: () => void = () => {};
    const blocker = new Promise<void>((resolve) => {
      releaseBlocker = resolve;
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      idempotency: { enabled: true },
      validator: z.object({ title: z.string() }),
      hooks: {
        beforeCreate: async () => {
          // Simulate long running in-flight operation
          await blocker;
        },
      },
    });

    const idempotencyKey = "tx-concurrent-001";
    const payload = { title: "Concurrent Post" };

    // 1. Launch first in-flight request
    const p1 = postsResource.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    // Short yield so p1 registers the lock in storage
    await new Promise((r) => setTimeout(r, 20));

    // 2. Second concurrent request with the same key
    const res2 = await postsResource.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    expect(res2.status).toBe(409);
    expect(res2.headers.get("Retry-After")).toBe("1");
    const json2 = await res2.json();
    expect(json2.success).toBe(false);
    expect(json2.error.code).toBe("IDEMPOTENCY_KEY_LOCKED");

    // Release blocker to let p1 complete
    releaseBlocker();
    const res1 = await p1;
    expect(res1.status).toBe(201);

    // 3. Subsequent request after p1 completes successfully replays
    const res3 = await postsResource.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    expect(res3.status).toBe(201);
    expect(res3.headers.get("Idempotent-Replayed")).toBe("true");
  });

  it("expires idempotency records after configured ttlMs", async () => {
    const { adapter } = await createTestDb();
    let insertCount = 0;

    const app = createApp({ adapter });
    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      idempotency: {
        enabled: true,
        ttlMs: 50, // 50ms TTL
      },
      validator: z.object({ title: z.string() }),
      hooks: {
        afterCreate: async () => {
          insertCount++;
        },
      },
    });

    const idempotencyKey = "tx-ttl-test";
    const payload = { title: "Short Lived Key" };

    // 1. First request
    const res1 = await postsResource.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
    expect(res1.status).toBe(201);
    expect(insertCount).toBe(1);

    // 2. Request immediately: Replayed
    const res2 = await postsResource.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
    expect(res2.status).toBe(201);
    expect(res2.headers.get("Idempotent-Replayed")).toBe("true");
    expect(insertCount).toBe(1);

    // 3. Wait for TTL expiration (> 50ms)
    await new Promise((r) => setTimeout(r, 70));

    // 4. Request after expiration: Executed afresh (insertCount incremented)
    const res3 = await postsResource.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    expect(res3.status).toBe(201);
    expect(res3.headers.get("Idempotent-Replayed")).toBeNull();
    expect(insertCount).toBe(2);
  });

  it("supports pluggable custom storage providers", async () => {
    const { adapter } = await createTestDb();
    const customStorage = new CustomTestStorage();

    const app = createApp({ adapter });
    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      idempotency: {
        enabled: true,
        storage: customStorage,
      },
      validator: z.object({ title: z.string() }),
    });

    const key = "tx-custom-storage";
    const res1 = await postsResource.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify({ title: "Custom Storage Post" }),
    });

    expect(res1.status).toBe(201);
    expect(customStorage.setCount).toBeGreaterThanOrEqual(1);
    expect(customStorage.store.has(key)).toBe(true);

    const res2 = await postsResource.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify({ title: "Custom Storage Post" }),
    });

    expect(res2.status).toBe(201);
    expect(res2.headers.get("Idempotent-Replayed")).toBe("true");
    expect(customStorage.getCount).toBeGreaterThanOrEqual(2);
  });

  it("inherits global idempotency config and respects resource-level override", async () => {
    const { adapter } = await createTestDb();
    let enabledCreates = 0;
    let disabledCreates = 0;

    const app = createApp({
      adapter,
      idempotency: { enabled: true },
    });

    const enabledResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
      hooks: {
        afterCreate: async () => {
          enabledCreates++;
        },
      },
    });

    const disabledResource = app.defineResource({
      name: "posts_unprotected",
      table: posts,
      idempotency: { enabled: false }, // explicitly disabled
      validator: z.object({ title: z.string() }),
      hooks: {
        afterCreate: async () => {
          disabledCreates++;
        },
      },
    });

    const key = "tx-scope-test";
    const payload = { title: "Scoped Test" };

    // Enabled resource replays
    await enabledResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify(payload),
    });
    await enabledResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify(payload),
    });
    expect(enabledCreates).toBe(1);

    // Disabled resource does not replay
    await disabledResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify(payload),
    });
    await disabledResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify(payload),
    });
    expect(disabledCreates).toBe(2);
  });

  it("clears in-flight lock on 500 server error so client can retry", async () => {
    const { adapter } = await createTestDb();
    let shouldCrash = true;

    const app = createApp({ adapter });
    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      idempotency: { enabled: true },
      validator: z.object({ title: z.string() }),
      hooks: {
        beforeCreate: async () => {
          if (shouldCrash) {
            shouldCrash = false;
            throw new Error("Simulated Database Crash");
          }
        },
      },
    });

    const key = "tx-retry-after-fail";
    const payload = { title: "Retry Post" };

    // 1. Initial attempt fails with 500
    const res1 = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify(payload),
    });
    expect(res1.status).toBe(500);

    // 2. Client retries: should not be blocked by 409, succeeds with 201
    const res2 = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify(payload),
    });
    expect(res2.status).toBe(201);
    expect(res2.headers.get("Idempotent-Replayed")).toBeNull();

    // 3. Subsequent retry after success is replayed
    const res3 = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify(payload),
    });
    expect(res3.status).toBe(201);
    expect(res3.headers.get("Idempotent-Replayed")).toBe("true");
  });

  it("replays idempotency on PATCH and DELETE mutations", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });
    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      idempotency: { enabled: true },
      validator: z.object({ title: z.string() }),
    });

    // Create a row first
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Original Title" }),
    });
    const created = await createRes.json();
    const id = created.data.id;

    // PATCH mutation with idempotency key
    const patchKey = "tx-patch-001";
    const patchRes1 = await postsResource.request(`/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": patchKey,
      },
      body: JSON.stringify({ title: "Updated Title" }),
    });
    expect(patchRes1.status).toBe(200);
    expect(patchRes1.headers.get("Idempotent-Replayed")).toBeNull();

    const patchRes2 = await postsResource.request(`/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": patchKey,
      },
      body: JSON.stringify({ title: "Updated Title" }),
    });
    expect(patchRes2.status).toBe(200);
    expect(patchRes2.headers.get("Idempotent-Replayed")).toBe("true");

    // DELETE mutation with idempotency key
    const deleteKey = "tx-delete-001";
    const deleteRes1 = await postsResource.request(`/${id}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": deleteKey },
    });
    expect(deleteRes1.status).toBe(200);
    expect(deleteRes1.headers.get("Idempotent-Replayed")).toBeNull();

    // Replay DELETE mutation returns cached 200 response with Idempotent-Replayed header
    // rather than 404
    const deleteRes2 = await postsResource.request(`/${id}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": deleteKey },
    });
    expect(deleteRes2.status).toBe(200);
    expect(deleteRes2.headers.get("Idempotent-Replayed")).toBe("true");
  });

  it("does not intercept safe HTTP methods like GET", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });
    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      idempotency: { enabled: true },
      validator: z.object({ title: z.string() }),
    });

    const res1 = await postsResource.request("/", {
      method: "GET",
      headers: { "Idempotency-Key": "get-key-1" },
    });
    expect(res1.status).toBe(200);
    expect(res1.headers.get("Idempotent-Replayed")).toBeNull();

    const res2 = await postsResource.request("/", {
      method: "GET",
      headers: { "Idempotency-Key": "get-key-1" },
    });
    expect(res2.status).toBe(200);
    expect(res2.headers.get("Idempotent-Replayed")).toBeNull();
  });
});
