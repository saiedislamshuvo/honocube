import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts } from "../fixtures/db.js";

describe("Security Misconfiguration Guard", () => {
  it("fails fast with 500 if permissions are declared but auth.can is not configured", async () => {
    const { adapter } = await createTestDb();

    // createApp without auth.can
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
      permissions: {
        list: "posts.view",
      },
    });

    const res = await postsResource.request("/", { method: "GET" });
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("INTERNAL_ERROR");
    expect(json.error.message).toContain("auth.can");
  });
});
