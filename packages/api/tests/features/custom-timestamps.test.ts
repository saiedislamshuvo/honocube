import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts } from "../fixtures/db.js";

describe("Custom Timestamp Configurations", () => {
  it("supports custom timestamp object configuration", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      timestamps: {
        createdAt: "createdAt",
        updatedAt: "updatedAt",
      },
      validator: z.object({ title: z.string() }),
    });

    // 1. Create auto-populates both createdAt and updatedAt
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Custom Timestamps Post" }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.data.createdAt).toBeDefined();
    expect(created.data.updatedAt).toBeDefined();

    // 2. Update refreshes updatedAt
    const updateRes = await postsResource.request(`/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Custom Timestamps Post" }),
    });
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.data.updatedAt).toBeDefined();
  });
});
