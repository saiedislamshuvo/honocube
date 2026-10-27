import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts, users } from "../fixtures/db.js";

describe("Security, Scoping & Authorization", () => {
  it("enforces mandatory scope across all endpoints (isolation)", async () => {
    const { adapter } = await createTestDb();

    // 1. Create app with tenant context resolution
    let currentTenant = "tenant-A";
    const app = createApp<{ Bindings: Record<string, unknown> }, { tenantId: string }>({
      adapter,
      getContext: () => ({ tenantId: currentTenant }),
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        tenantId: z.string().optional(),
      }),
      // Mandatory scope: only return posts belonging to current tenant
      scope: (cols, { eq }, appContext) => eq(cols.tenantId, appContext.tenantId),
    });

    // Seed: Tenant-A post and Tenant-B post
    const postA: any = await adapter.insert(posts, {
      title: "Post for Tenant A",
      tenantId: "tenant-A",
    });
    const postB: any = await adapter.insert(posts, {
      title: "Post for Tenant B",
      tenantId: "tenant-B",
    });

    // --- Caller is Tenant-A ---
    currentTenant = "tenant-A";

    // 1. List: Should only see Post A
    const listRes = await postsResource.request("/", { method: "GET" });
    const list = await listRes.json();
    expect(list.data.length).toBe(1);
    expect(list.data[0].id).toBe(postA.id);

    // 2. Detail: Tenant A can read Post A
    const detailARes = await postsResource.request(`/${postA.id}`, { method: "GET" });
    expect(detailARes.status).toBe(200);

    // 3. Detail: Tenant A cannot read Post B (answers 404 NOT_FOUND, no leak of existence)
    const detailBRes = await postsResource.request(`/${postB.id}`, { method: "GET" });
    expect(detailBRes.status).toBe(404);

    // 4. Update: Tenant A cannot update Post B
    const updateBRes = await postsResource.request(`/${postB.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hacked Title" }),
    });
    expect(updateBRes.status).toBe(404);

    // 5. Delete: Tenant A cannot delete Post B
    const deleteBRes = await postsResource.request(`/${postB.id}`, { method: "DELETE" });
    expect(deleteBRes.status).toBe(404);

    // Verify Post B is completely unchanged in DB
    const postBInDb: any = await adapter.findFirst(posts, {
      where: (cols: any, { eq }: any) => eq(cols.id, postB.id),
    });
    expect(postBInDb.title).toBe("Post for Tenant B");
  });

  it("checks declarative permissions and row-level authorize callbacks", async () => {
    const { adapter } = await createTestDb();

    // Create 2 users for ownership testing
    const user1: any = await adapter.insert(users, { name: "User 1", email: "user1@example.com" });
    const user2: any = await adapter.insert(users, { name: "User 2", email: "user2@example.com" });

    let userRole = "viewer";
    const app = createApp<{ Bindings: Record<string, unknown> }, { role: string; userId: number }>({
      adapter,
      getContext: () => ({ role: userRole, userId: user1.id }),
      auth: {
        can: async (ctx, permission) => {
          if (permission === "posts.write") return ctx.role === "editor";
          if (permission === "posts.read") return true;
          return false;
        },
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
      permissions: {
        list: "posts.read",
        create: "posts.write",
        update: "posts.write",
        delete: "posts.write",
      },
      authorize: async (ctx, action, record) => {
        // Only author can delete their post
        if (action === "delete") {
          return record?.authorId === ctx.userId;
        }
        return true;
      },
    });

    // 1. Viewer can list
    userRole = "viewer";
    const listRes = await postsResource.request("/", { method: "GET" });
    expect(listRes.status).toBe(200);

    // 2. Viewer cannot create (403 Forbidden)
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Post" }),
    });
    expect(createRes.status).toBe(403);

    // 3. Editor can create (returns 201)
    userRole = "editor";
    const editorCreateRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Editor Post" }),
    });
    expect(editorCreateRes.status).toBe(201);
    const created = await editorCreateRes.json();

    // 4. Authorize check on delete: assign to user2 (different from current caller user1)
    await adapter.update(posts, created.data.id, { authorId: user2.id });
    const deleteRes = await postsResource.request(`/${created.data.id}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(403);
  });
});
