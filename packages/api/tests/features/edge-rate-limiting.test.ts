import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import {
  MemoryRateLimitStore,
  createRedisRateLimiter,
  createUpstashRateLimiter,
  parseWindow,
} from "../../src/utils/rate-limit.js";
import { createTestDb, posts } from "../fixtures/db.js";

describe("Distributed Edge Rate Limiting Engine", () => {
  describe("parseWindow helper", () => {
    it("correctly parses duration strings into milliseconds", () => {
      expect(parseWindow(5000)).toBe(5000);
      expect(parseWindow("10s")).toBe(10000);
      expect(parseWindow("1m")).toBe(60000);
      expect(parseWindow("15m")).toBe(900000);
      expect(parseWindow("1h")).toBe(3600000);
      expect(parseWindow("1d")).toBe(86400000);
      expect(parseWindow("invalid")).toBe(60000);
    });
  });

  it("attaches standard RFC headers and decrements RateLimit-Remaining", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      rateLimit: {
        limit: 3,
        windowMs: 60000,
        keyGenerator: () => "client-rfc-headers",
      },
      validator: z.object({ title: z.string() }),
    });

    // 1. First request: Remaining = 2
    const res1 = await postsResource.request("/", { method: "GET" });
    expect(res1.status).toBe(200);
    expect(res1.headers.get("RateLimit-Limit")).toBe("3");
    expect(res1.headers.get("RateLimit-Remaining")).toBe("2");
    expect(Number(res1.headers.get("RateLimit-Reset"))).toBeGreaterThan(0);

    // 2. Second request: Remaining = 1
    const res2 = await postsResource.request("/", { method: "GET" });
    expect(res2.status).toBe(200);
    expect(res2.headers.get("RateLimit-Limit")).toBe("3");
    expect(res2.headers.get("RateLimit-Remaining")).toBe("1");

    // 3. Third request: Remaining = 0
    const res3 = await postsResource.request("/", { method: "GET" });
    expect(res3.status).toBe(200);
    expect(res3.headers.get("RateLimit-Limit")).toBe("3");
    expect(res3.headers.get("RateLimit-Remaining")).toBe("0");

    // 4. Fourth request: Limit exceeded -> HTTP 429 with Retry-After header
    const res4 = await postsResource.request("/", { method: "GET" });
    expect(res4.status).toBe(429);
    expect(res4.headers.get("RateLimit-Limit")).toBe("3");
    expect(res4.headers.get("RateLimit-Remaining")).toBe("0");
    expect(res4.headers.get("Retry-After")).toBeDefined();
    expect(Number(res4.headers.get("Retry-After"))).toBeGreaterThan(0);

    const json4 = await res4.json();
    expect(json4).toEqual({
      success: false,
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "Too Many Requests",
      },
    });
  });

  it("smooths rate limit across sliding window boundaries without burst spike anomalies", async () => {
    const store = new MemoryRateLimitStore();
    const windowMs = 1000; // 1 second window
    const limit = 10;
    const key = "test-sliding-window";

    // Mock Date.now to test sliding calculations deterministically
    const originalNow = Date.now;
    let mockTime = 10000;
    Date.now = () => mockTime;

    try {
      // 1. Consume 10 requests at the very end of Window 1 (t = 10900ms, window 10000..11000)
      mockTime = 10900;
      for (let i = 0; i < 10; i++) {
        const res = store.increment(key, 1, limit, windowMs);
        expect(res.allowed).toBe(true);
      }

      // 11th request in window 1 is rejected
      expect(store.increment(key, 1, limit, windowMs).allowed).toBe(false);

      // 2. Advance time into Window 2 by 200ms (t = 11200ms, window 11000..12000)
      // Weight of window 1 = (1000 - 200) / 1000 = 0.8
      // Estimated count from window 1 = 10 * 0.8 = 8.
      // So client can ONLY make 2 requests in window 2, not a burst of 10!
      mockTime = 11200;

      const resWin2First = store.increment(key, 1, limit, windowMs);
      expect(resWin2First.allowed).toBe(true); // 8 + 1 = 9 <= 10

      const resWin2Second = store.increment(key, 1, limit, windowMs);
      expect(resWin2Second.allowed).toBe(true); // 9 + 1 = 10 <= 10

      // 3rd request in window 2 at t=11200 is REJECTED because sliding window is saturated!
      const resWin2Third = store.increment(key, 1, limit, windowMs);
      expect(resWin2Third.allowed).toBe(false);

      // 3. Advance time further (t = 11600ms):
      // Weight of window 1 = (1000 - 600) / 1000 = 0.4
      // Estimated window 1 = 10 * 0.4 = 4. Window 2 count = 2. Total estimated = 6.
      // Now more quota has slid in!
      mockTime = 11600;
      const resLater = store.increment(key, 1, limit, windowMs);
      expect(resLater.allowed).toBe(true);
    } finally {
      Date.now = originalNow;
    }
  });

  it("supports custom keyGenerator based on request context and user id", async () => {
    const { adapter } = await createTestDb();
    let currentUser = "user-alice";

    const app = createApp<{ Bindings: Record<string, unknown> }, { userId: string }>({
      adapter,
      getContext: () => ({ userId: currentUser }),
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      rateLimit: {
        limit: 1,
        windowMs: 60000,
        keyGenerator: (_c, ctx) => `user:${ctx.userId}`,
      },
      validator: z.object({ title: z.string() }),
    });

    // Alice request 1: allowed
    const resAlice1 = await postsResource.request("/", { method: "GET" });
    expect(resAlice1.status).toBe(200);

    // Alice request 2: blocked (limit is 1)
    const resAlice2 = await postsResource.request("/", { method: "GET" });
    expect(resAlice2.status).toBe(429);

    // Switch to Bob: allowed (isolated quota)
    currentUser = "user-bob";
    const resBob1 = await postsResource.request("/", { method: "GET" });
    expect(resBob1.status).toBe(200);
  });

  it("supports custom request cost function for expensive mutations", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      rateLimit: {
        limit: 5,
        windowMs: 60000,
        keyGenerator: () => "cost-client",
        cost: (c) => (c.req.method === "POST" ? 3 : 1), // POST costs 3, GET costs 1
      },
      validator: z.object({ title: z.string() }),
    });

    // 1. POST costs 3: Remaining = 5 - 3 = 2
    const resPost = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Heavy Operation" }),
    });
    expect(resPost.status).toBe(201);
    expect(resPost.headers.get("RateLimit-Remaining")).toBe("2");

    // 2. GET costs 1: Remaining = 2 - 1 = 1
    const resGet = await postsResource.request("/", { method: "GET" });
    expect(resGet.status).toBe(200);
    expect(resGet.headers.get("RateLimit-Remaining")).toBe("1");

    // 3. Another POST costs 3: 1 + 3 = 4 > 2 -> Exceeds remaining (1), rejected with 429
    const resPostExceeded = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Another Heavy Operation" }),
    });
    expect(resPostExceeded.status).toBe(429);
  });

  it("supports createRedisRateLimiter with atomic Lua script evaluation", async () => {
    let evalCalled = false;
    let evalArgs: any[] = [];

    const mockRedis = {
      eval: async (script: string, numKeys: number, key: string, cost: number, limit: number, windowMs: number, now: number) => {
        evalCalled = true;
        evalArgs = [script, numKeys, key, cost, limit, windowMs, now];
        // Returns [allowed (1 or 0), limit, remaining, resetSeconds]
        return [1, limit, limit - cost, 60];
      },
      del: vi.fn(),
    };

    const redisStore = createRedisRateLimiter(mockRedis);
    const result = await redisStore.increment("redis-key", 2, 10, 60000);

    expect(evalCalled).toBe(true);
    expect(evalArgs[2]).toBe("redis-key");
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(8);
    expect(result.reset).toBe(60);

    await redisStore.reset?.("redis-key");
    expect(mockRedis.del).toHaveBeenCalledWith("redis-key");
  });

  it("supports createUpstashRateLimiter with client instance and REST config", async () => {
    // 1. Upstash Client instance with .eval
    const mockUpstashClient = {
      eval: async (_script: string, keys: string[], args: any[]) => {
        const cost = Number(args[0]);
        const limit = Number(args[1]);
        return [1, limit, limit - cost, 45];
      },
      del: vi.fn(),
    };

    const upstashStore1 = createUpstashRateLimiter(mockUpstashClient);
    const res1 = await upstashStore1.increment("upstash-key-1", 1, 20, 60000);
    expect(res1.allowed).toBe(true);
    expect(res1.remaining).toBe(19);
    expect(res1.reset).toBe(45);

    // 2. Upstash REST configuration with global fetch mock
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ result: [1, 50, 49, 30] }],
    }) as any;

    try {
      const upstashStore2 = createUpstashRateLimiter({
        url: "https://example-upstash.upstash.io",
        token: "fake-upstash-token",
      });

      const res2 = await upstashStore2.increment("upstash-key-2", 1, 50, 60000);
      expect(res2.allowed).toBe(true);
      expect(res2.limit).toBe(50);
      expect(res2.remaining).toBe(49);
      expect(res2.reset).toBe(30);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://example-upstash.upstash.io/pipeline",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer fake-upstash-token",
          }),
        })
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("inherits global rateLimit configuration across all resources", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({
      adapter,
      rateLimit: {
        limit: 2,
        window: "1m",
        keyGenerator: () => "global-client-key",
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
    });

    const res1 = await postsResource.request("/", { method: "GET" });
    expect(res1.status).toBe(200);
    expect(res1.headers.get("RateLimit-Remaining")).toBe("1");

    const res2 = await postsResource.request("/", { method: "GET" });
    expect(res2.status).toBe(200);
    expect(res2.headers.get("RateLimit-Remaining")).toBe("0");

    const res3 = await postsResource.request("/", { method: "GET" });
    expect(res3.status).toBe(429);
  });
});
