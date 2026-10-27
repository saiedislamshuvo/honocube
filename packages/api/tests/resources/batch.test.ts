import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts } from "../fixtures/db.js";

describe("Batch Operations", () => {
  it("performs batch-update across multiple records", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const postsResource = defineResource({
      name: "posts",
      table: posts,
      methods: ["list", "detail", "create", "update", "delete", "batch-update", "batch-delete"],
      validator: z.object({
        title: z.string().optional(),
        status: z.string().optional(),
      }),
    });

    // 1. Insert 3 posts directly
    const p1: any = await adapter.insert(posts, { title: "P1", status: "draft" });
    const p2: any = await adapter.insert(posts, { title: "P2", status: "draft" });
    const p3: any = await adapter.insert(posts, { title: "P3", status: "draft" });

    // 2. Batch update p1 and p2 to "published"
    const batchUpdateRes = await postsResource.request("/batch-update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [p1.id, p2.id],
        data: { status: "published" },
      }),
    });

    expect(batchUpdateRes.status).toBe(200);

    // Verify p1 and p2 are published, p3 is still draft
    const updatedP1: any = await adapter.findFirst(posts, { where: (cols: any, { eq }: any) => eq(cols.id, p1.id) });
    const updatedP2: any = await adapter.findFirst(posts, { where: (cols: any, { eq }: any) => eq(cols.id, p2.id) });
    const updatedP3: any = await adapter.findFirst(posts, { where: (cols: any, { eq }: any) => eq(cols.id, p3.id) });

    expect(updatedP1.status).toBe("published");
    expect(updatedP2.status).toBe("published");
    expect(updatedP3.status).toBe("draft");
  });

  it("performs batch-delete across multiple records", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const postsResource = defineResource({
      name: "posts",
      table: posts,
      methods: ["list", "detail", "create", "update", "delete", "batch-update", "batch-delete"],
      validator: z.object({ title: z.string().optional() }),
    });

    const p1: any = await adapter.insert(posts, { title: "P1" });
    const p2: any = await adapter.insert(posts, { title: "P2" });
    const p3: any = await adapter.insert(posts, { title: "P3" });

    const batchDeleteRes = await postsResource.request("/batch-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [p1.id, p2.id],
      }),
    });

    expect(batchDeleteRes.status).toBe(200);

    const remaining = await adapter.findMany(posts, {});
    expect(remaining.length).toBe(1);
    expect((remaining[0] as any).id).toBe(p3.id);
  });
});
