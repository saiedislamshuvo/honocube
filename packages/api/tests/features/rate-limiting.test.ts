import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { RateLimiter } from "../../src/types.js";
import { createTestDb, posts } from "../fixtures/db.js";

class MockRateLimiter implements RateLimiter {
  private counts = new Map<string, number>();

  async check(key: string, limit: number, _window: string) {
    const current = this.counts.get(key) || 0;
    if (current >= limit) return false;
    this.counts.set(key, current + 1);
    return true;
  }
}

describe("Universal Rate Limiting", () => {
  it("enforces rate limits and throws 429 TOO_MANY_REQUESTS when exceeded", async () => {
    const { adapter } = await createTestDb();
    const rateLimiter = new MockRateLimiter();

    const app = createApp({
      adapter,
      rateLimiter,
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      rateLimit: {
        limit: 2,
        window: "1m",
        key: () => "test-client-ip",
      },
      validator: z.object({ title: z.string() }),
    });

    // 1. First request allowed
    const res1 = await postsResource.request("/", { method: "GET" });
    expect(res1.status).toBe(200);

    // 2. Second request allowed
    const res2 = await postsResource.request("/", { method: "GET" });
    expect(res2.status).toBe(200);

    // 3. Third request rejected with 429
    const res3 = await postsResource.request("/", { method: "GET" });
    expect(res3.status).toBe(429);
    const json = await res3.json();
    expect(json).toEqual({
      success: false,
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "Too Many Requests",
      },
    });
  });
});
