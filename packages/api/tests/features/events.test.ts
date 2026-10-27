import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { ResourceEvent } from "../../src/types.js";
import { createTestDb, posts } from "../fixtures/db.js";

describe("Event Emitter Subsystem", () => {
  it("emits events on create, update, delete, batch-update, and batch-delete", async () => {
    const { adapter } = await createTestDb();
    const emittedEvents: ResourceEvent[] = [];

    const app = createApp({
      adapter,
      onEvent: (event) => {
        emittedEvents.push(event);
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      methods: ["list", "detail", "create", "update", "delete", "batch-update", "batch-delete"],
      validator: z.object({
        title: z.string().optional(),
        status: z.string().optional(),
      }),
    });

    // 1. Create
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Event Post" }),
    });
    const created = await createRes.json();
    const postId = created.data.id;

    // 2. Update
    await postsResource.request(`/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Event Post" }),
    });

    // 3. Batch Update
    await postsResource.request("/batch-update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [postId],
        data: { status: "published" },
      }),
    });

    // 4. Batch Delete
    await postsResource.request("/batch-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [postId] }),
    });

    const types = emittedEvents.map((e) => e.type);
    expect(types).toContain("create");
    expect(types).toContain("update");
    expect(types).toContain("batch-update");
    expect(types).toContain("batch-delete");
  });
});
