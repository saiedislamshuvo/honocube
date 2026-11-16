import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts } from "../fixtures/db.js";

describe("Instant Boolean Toggle Engine (Issue #148)", () => {
  it("toggles single record boolean field via POST /:id/toggle/:field", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const postsResource = defineResource({
      name: "posts",
      table: posts,
      methods: ["list", "detail", "create", "update", "delete"],
      validator: z.object({
        title: z.string().optional(),
        status: z.string().optional(),
        price: z.number().optional(),
      }),
    });

    // 1. Insert initial post with price = 0 (simulating false/0 flag)
    const p1: any = await adapter.insert(posts, { title: "Post 1", price: 0 });
    expect(p1.price).toBe(0);

    // 2. Toggle 'price' field (inverts 0 -> true/1)
    const toggleRes1 = await postsResource.request(`/${p1.id}/toggle/price`, {
      method: "POST",
    });

    expect(toggleRes1.status).toBe(200);
    const body1: any = await toggleRes1.json();
    expect(body1.success).toBe(true);
    expect(body1.field).toBe("price");
    expect(body1.value).toBe(true);

    // 3. Toggle again (inverts true/1 -> false/0)
    const toggleRes2 = await postsResource.request(`/${p1.id}/toggle/price`, {
      method: "POST",
    });

    expect(toggleRes2.status).toBe(200);
    const body2: any = await toggleRes2.json();
    expect(body2.value).toBe(false);

    // 4. Toggle with explicit value payload
    const toggleRes3 = await postsResource.request(`/${p1.id}/toggle/price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: true }),
    });

    expect(toggleRes3.status).toBe(200);
    const body3: any = await toggleRes3.json();
    expect(body3.value).toBe(true);
  });

  it("returns 400 for invalid field name on toggle", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const postsResource = defineResource({
      name: "posts",
      table: posts,
    });

    const p1: any = await adapter.insert(posts, { title: "Post 1" });

    const res = await postsResource.request(`/${p1.id}/toggle/non_existent_column`, {
      method: "POST",
    });

    expect(res.status).toBe(400);
  });

  it("performs bulk boolean toggles via POST /batch-toggle", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const postsResource = defineResource({
      name: "posts",
      table: posts,
      methods: ["list", "detail", "create", "update", "delete", "batch-update"],
    });

    const p1: any = await adapter.insert(posts, { title: "P1", price: 0 });
    const p2: any = await adapter.insert(posts, { title: "P2", price: 0 });
    const p3: any = await adapter.insert(posts, { title: "P3", price: 1 });

    // 1. Bulk toggle with explicit value: true
    const batchRes1 = await postsResource.request("/batch-toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [p1.id, p2.id],
        field: "price",
        value: true,
      }),
    });

    expect(batchRes1.status).toBe(200);
    const json1: any = await batchRes1.json();
    expect(json1.success).toBe(true);
    expect(json1.count).toBe(2);

    // Verify p1 and p2 are true
    const updatedP1: any = await adapter.findFirst(posts, { where: (cols: any, { eq }: any) => eq(cols.id, p1.id) });
    const updatedP2: any = await adapter.findFirst(posts, { where: (cols: any, { eq }: any) => eq(cols.id, p2.id) });
    expect(Boolean(updatedP1.price)).toBe(true);
    expect(Boolean(updatedP2.price)).toBe(true);

    // 2. Bulk toggle without explicit value (inverts each record)
    const batchRes2 = await postsResource.request("/batch-toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [p1.id, p3.id],
        field: "price",
      }),
    });

    expect(batchRes2.status).toBe(200);
    const json2: any = await batchRes2.json();
    expect(json2.count).toBe(2);

    // p1 was true -> now false; p3 was 1 (true) -> now false
    const reloadedP1: any = await adapter.findFirst(posts, { where: (cols: any, { eq }: any) => eq(cols.id, p1.id) });
    const reloadedP3: any = await adapter.findFirst(posts, { where: (cols: any, { eq }: any) => eq(cols.id, p3.id) });
    expect(Boolean(reloadedP1.price)).toBe(false);
    expect(Boolean(reloadedP3.price)).toBe(false);
  });
});
