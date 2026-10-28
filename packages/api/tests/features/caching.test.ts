import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { AppCache } from "../../src/types.js";
import { createTestDb, posts } from "../fixtures/db.js";

class MockCache implements AppCache {
  public store = new Map<string, any>();
  public hitCount = 0;
  public missCount = 0;
  public clearCount = 0;

  async get(key: string) {
    if (this.store.has(key)) {
      this.hitCount++;
      return this.store.get(key);
    }
    this.missCount++;
    return null;
  }

  async set(key: string, value: any) {
    this.store.set(key, value);
  }

  async delete(key: string) {
    this.store.delete(key);
  }

  async clear(prefix: string) {
    this.clearCount++;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }
}

describe("Caching Engine & Scoping", () => {
  it("serves repeated requests from cache and invalidates on mutation", async () => {
    const { adapter } = await createTestDb();
    const cache = new MockCache();

    let currentUser = "user-1";
    const app = createApp<{ Bindings: Record<string, unknown> }, { user: string }>({
      adapter,
      cache,
      getContext: () => ({ user: currentUser }),
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      cache: {
        enabled: true,
        ttl: 60,
        keyBy: (ctx) => ctx.user,
      },
      validator: z.object({ title: z.string() }),
    });

    // 1. Initial request (Cache Miss)
    const res1 = await postsResource.request("/", { method: "GET" });
    expect(res1.status).toBe(200);
    expect(cache.missCount).toBe(1);
    expect(cache.hitCount).toBe(0);

    // 2. Second request by user-1 (Cache Hit)
    const res2 = await postsResource.request("/", { method: "GET" });
    expect(res2.status).toBe(200);
    expect(cache.hitCount).toBe(1);

    // 3. Request by user-2 (Cache Miss due to keyBy scoping)
    currentUser = "user-2";
    const resUser2 = await postsResource.request("/", { method: "GET" });
    expect(resUser2.status).toBe(200);
    expect(cache.missCount).toBe(2);

    // 4. Mutation (Create) invalidates cache
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Cached Post" }),
    });
    expect(createRes.status).toBe(201);
    expect(cache.clearCount).toBeGreaterThanOrEqual(1);

    // 5. Subsequent request is a Cache Miss again after invalidation
    const resAfterMutation = await postsResource.request("/", { method: "GET" });
    expect(resAfterMutation.status).toBe(200);
    expect(cache.missCount).toBe(3);
  });

  it("leaves responses uncached if keyBy returns undefined", async () => {
    const { adapter } = await createTestDb();
    const cache = new MockCache();

    const app = createApp({ adapter, cache });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      cache: {
        enabled: true,
        keyBy: () => undefined, // Anonymous / uncached
      },
      validator: z.object({ title: z.string() }),
    });

    await postsResource.request("/", { method: "GET" });
    await postsResource.request("/", { method: "GET" });

    // Nothing written to or read from cache
    expect(cache.hitCount).toBe(0);
    expect(cache.store.size).toBe(0);
  });

  it("caches detail and slug endpoints and handles missing keyBy", async () => {
    const { adapter } = await createTestDb();
    const cache = new MockCache();

    const app = createApp({
      adapter,
      cache,
      getContext: () => ({ user: "user-cache" }),
    });

    const p: any = await adapter.insert(posts, { title: "Cached Post", slug: "cached-slug" });

    // 1. Missing keyBy leaves cache inactive
    const noKeyResource = app.defineResource({
      name: "posts_no_key",
      table: posts,
      cache: { enabled: true },
      validator: z.object({ title: z.string() }),
    });
    await noKeyResource.request(`/${p.id}`, { method: "GET" });
    expect(cache.store.size).toBe(0);

    // 2. Resource with detail and slug cache
    const cachedResource = app.defineResource({
      name: "posts",
      table: posts,
      slugs: ["slug"],
      cache: {
        enabled: true,
        ttl: 120,
        keyBy: (ctx) => ctx.user,
      },
      validator: z.object({ title: z.string() }),
    });

    // Detail: First call miss, second call hit
    const detailRes1 = await cachedResource.request(`/${p.id}`, { method: "GET" });
    expect(detailRes1.status).toBe(200);
    const detailHitsBefore = cache.hitCount;

    const detailRes2 = await cachedResource.request(`/${p.id}`, { method: "GET" });
    expect(detailRes2.status).toBe(200);
    expect(cache.hitCount).toBe(detailHitsBefore + 1);

    // Slug: First call miss, second call hit
    const slugRes1 = await cachedResource.request(`/slug/cached-slug`, { method: "GET" });
    expect(slugRes1.status).toBe(200);
    const slugHitsBefore = cache.hitCount;

    const slugRes2 = await cachedResource.request(`/slug/cached-slug`, { method: "GET" });
    expect(slugRes2.status).toBe(200);
    expect(cache.hitCount).toBe(slugHitsBefore + 1);
  });
});
