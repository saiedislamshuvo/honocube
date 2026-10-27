import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts } from "../fixtures/db.js";

describe("Resource CRUD Operations", () => {
  it("creates, reads, updates, and deletes records with timestamps", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const postsResource = defineResource({
      name: "posts",
      table: posts,
      timestamps: true,
      slugs: ["slug"],
      validator: z.object({
        title: z.string().min(1),
        content: z.string().optional(),
        slug: z.string().optional(),
        price: z.number().optional(),
        status: z.string().optional(),
      }),
    });

    // 1. Create (POST /) returns 201 Created
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Hello World",
        content: "This is a test post",
        slug: "hello-world",
        price: 100,
      }),
    });

    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.success).toBe(true);
    expect(created.data.id).toBeDefined();
    expect(created.data.title).toBe("Hello World");
    expect(created.data.createdAt).toBeDefined();
    expect(created.data.updatedAt).toBeDefined();
    const postId = created.data.id;

    // 2. Read Detail (GET /:id)
    const detailRes = await postsResource.request(`/${postId}`, { method: "GET" });
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json();
    expect(detail.success).toBe(true);
    expect(detail.data.id).toBe(postId);
    expect(detail.data.title).toBe("Hello World");

    // 3. Slug Lookup (GET /:slug/:value)
    const slugRes = await postsResource.request(`/slug/hello-world`, { method: "GET" });
    expect(slugRes.status).toBe(200);
    const slugData = await slugRes.json();
    expect(slugData.success).toBe(true);
    expect(slugData.data.id).toBe(postId);

    // 4. Update (PATCH /:id)
    const updateRes = await postsResource.request(`/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Updated Hello World",
        price: 150,
      }),
    });

    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.success).toBe(true);
    expect(updated.data.title).toBe("Updated Hello World");
    expect(updated.data.price).toBe(150);

    // 5. List (GET /)
    const listRes = await postsResource.request("/?limit=10&page=1", { method: "GET" });
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.success).toBe(true);
    expect(list.data.length).toBe(1);
    expect(list.meta).toEqual({
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    // 6. Delete (DELETE /:id)
    const deleteRes = await postsResource.request(`/${postId}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(200);
    const deleted = await deleteRes.json();
    expect(deleted.success).toBe(true);

    // Verify it is gone
    const verifyRes = await postsResource.request(`/${postId}`, { method: "GET" });
    expect(verifyRes.status).toBe(404);
  });

  it("enforces pagination validation and caps at maxLimit", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const postsResource = defineResource({
      name: "posts",
      table: posts,
      pagination: {
        defaultLimit: 5,
        maxLimit: 25,
      },
      validator: z.object({ title: z.string() }),
    });

    // Invalid limit: 0
    const zeroLimitRes = await postsResource.request("/?limit=0", { method: "GET" });
    expect(zeroLimitRes.status).toBe(400);

    // Invalid limit: negative
    const negLimitRes = await postsResource.request("/?limit=-5", { method: "GET" });
    expect(negLimitRes.status).toBe(400);

    // Invalid limit: non-integer string
    const stringLimitRes = await postsResource.request("/?limit=abc", { method: "GET" });
    expect(stringLimitRes.status).toBe(400);

    // Invalid page: 0
    const zeroPageRes = await postsResource.request("/?page=0", { method: "GET" });
    expect(zeroPageRes.status).toBe(400);

    // Capping at maxLimit (25)
    const cappedRes = await postsResource.request("/?limit=50", { method: "GET" });
    expect(cappedRes.status).toBe(200);
    const json = await cappedRes.json();
    expect(json.meta.limit).toBe(25);
  });

  it("triggers lifecycle hooks on CRUD operations", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const events: string[] = [];

    const postsResource = defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        content: z.string().optional(),
      }),
      hooks: {
        beforeCreate: (data) => {
          events.push("beforeCreate");
          return { ...data, content: "hook-modified-content" };
        },
        afterCreate: (record) => {
          events.push(`afterCreate:${record.id}`);
        },
        beforeUpdate: (id, data) => {
          events.push(`beforeUpdate:${id}`);
          return data;
        },
        afterUpdate: (record) => {
          events.push(`afterUpdate:${record.id}`);
        },
        beforeDelete: (id) => {
          events.push(`beforeDelete:${id}`);
        },
        afterDelete: (id) => {
          events.push(`afterDelete:${id}`);
        },
      },
    });

    // Create
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hook Test" }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.data.content).toBe("hook-modified-content");

    // Update
    await postsResource.request(`/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hook Test Updated" }),
    });

    // Delete
    await postsResource.request(`/${created.data.id}`, { method: "DELETE" });

    expect(events).toEqual([
      "beforeCreate",
      `afterCreate:${created.data.id}`,
      `beforeUpdate:${created.data.id}`,
      `afterUpdate:${created.data.id}`,
      `beforeDelete:${created.data.id}`,
      `afterDelete:${created.data.id}`,
    ]);
  });
});
