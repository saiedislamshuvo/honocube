import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts } from "../fixtures/db.js";

describe("Middleware Pipeline", () => {
  it("executes global and resource-level middleware before route handlers", async () => {
    const { adapter } = await createTestDb();

    const app = createApp({
      adapter,
      middleware: [
        async (c, next) => {
          await next();
          c.res.headers.set("X-Global-Header", "active");
        },
      ],
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
      middleware: [
        async (c, next) => {
          const auth = c.req.header("X-API-Key");
          if (!auth || auth !== "secret-123") {
            return c.json({ error: "Missing or invalid API key" }, 401);
          }
          await next();
          c.res.headers.set("X-Resource-Header", "posts-active");
        },
      ],
    });

    // 1. Request without X-API-Key is blocked by resource middleware with 401
    const blockedRes = await postsResource.request("/", { method: "GET" });
    expect(blockedRes.status).toBe(401);
    expect(blockedRes.headers.get("X-Global-Header")).toBe("active");

    // 2. Request with valid X-API-Key succeeds and has both headers set
    const allowedRes = await postsResource.request("/", {
      method: "GET",
      headers: { "X-API-Key": "secret-123" },
    });
    expect(allowedRes.status).toBe(200);
    expect(allowedRes.headers.get("X-Global-Header")).toBe("active");
    expect(allowedRes.headers.get("X-Resource-Header")).toBe("posts-active");
  });
});
