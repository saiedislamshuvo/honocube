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

  it("enforces tenant scope, soft-delete, and hook rejection on batch mutations", async () => {
    const { adapter } = await createTestDb();
    const currentTenant = "tenant-1";
    const app = createApp<{ Bindings: Record<string, unknown> }, { tenantId: string }>({
      adapter,
      getContext: () => ({ tenantId: currentTenant }),
    });

    let hookCalledAfterDelete = false;

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      timestamps: true,
      softDelete: "deletedAt",
      scope: (cols, { eq }, ctx) => eq(cols.tenantId, ctx.tenantId),
      methods: ["batch-update", "batch-delete"],
      validator: z.object({
        title: z.string().optional(),
        status: z.string().optional(),
      }),
      hooks: {
        afterBatchDelete: async () => {
          hookCalledAfterDelete = true;
        },
      },
    });

    // Seed: Tenant 1 post, Tenant 2 post, and already soft-deleted post
    const t1Post: any = await adapter.insert(posts, { title: "T1 Post", status: "draft", tenantId: "tenant-1" });
    const t2Post: any = await adapter.insert(posts, { title: "T2 Post", status: "draft", tenantId: "tenant-2" });
    const softDeletedPost: any = await adapter.insert(posts, {
      title: "Deleted Post",
      status: "draft",
      tenantId: "tenant-1",
      deletedAt: new Date().toISOString(),
    });

    // 1. Batch Update respects tenant scope & soft-delete & auto-timestamps
    const updateRes = await postsResource.request("/batch-update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [t1Post.id, t2Post.id, softDeletedPost.id],
        data: { status: "active" },
      }),
    });
    expect(updateRes.status).toBe(200);

    // Verify T1 is active and has updatedAt set
    const inDbT1: any = await adapter.findFirst(posts, { where: (cols: any, { eq }: any) => eq(cols.id, t1Post.id) });
    expect(inDbT1.status).toBe("active");
    expect(inDbT1.updatedAt).toBeDefined();

    // Verify T2 and softDeletedPost are STILL "draft" (unmodified)
    const inDbT2: any = await adapter.findFirst(posts, { where: (cols: any, { eq }: any) => eq(cols.id, t2Post.id) });
    expect(inDbT2.status).toBe("draft");
    const inDbDeleted: any = await adapter.findFirst(posts, { where: (cols: any, { eq }: any) => eq(cols.id, softDeletedPost.id) });
    expect(inDbDeleted.status).toBe("draft");

    // 2. Batch Delete with softDelete enabled marks deletedAt instead of removing rows
    const deleteRes = await postsResource.request("/batch-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [t1Post.id, t2Post.id],
      }),
    });
    expect(deleteRes.status).toBe(200);
    expect(hookCalledAfterDelete).toBe(true);

    // T1 is now soft-deleted (has deletedAt), row still exists
    const inDbT1AfterDel: any = await adapter.findFirst(posts, { where: (cols: any, { eq }: any) => eq(cols.id, t1Post.id) });
    expect(inDbT1AfterDel.deletedAt).toBeDefined();

    // T2 was NOT soft-deleted because caller was tenant-1
    const inDbT2AfterDel: any = await adapter.findFirst(posts, { where: (cols: any, { eq }: any) => eq(cols.id, t2Post.id) });
    expect(inDbT2AfterDel.deletedAt).toBeNull();

    // 3. Hook rejecting all IDs returns 0
    const hookRejectResource = app.defineResource({
      name: "posts_reject",
      table: posts,
      methods: ["batch-update", "batch-delete"],
      validator: z.object({ title: z.string().optional() }),
      hooks: {
        beforeBatchUpdate: async () => ({ ids: [], data: {} }),
        beforeBatchDelete: async () => [],
      },
    });

    const rejectUpdateRes = await hookRejectResource.request("/batch-update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [t1Post.id], data: { title: "Never" } }),
    });
    expect(rejectUpdateRes.status).toBe(200);
    expect((await rejectUpdateRes.json()).updated).toBe(0);

    const rejectDeleteRes = await hookRejectResource.request("/batch-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [t1Post.id] }),
    });
    expect(rejectDeleteRes.status).toBe(200);
    expect((await rejectDeleteRes.json()).deleted).toBe(0);
  });
});
