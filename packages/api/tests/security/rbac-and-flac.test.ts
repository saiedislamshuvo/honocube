import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts, users } from "../fixtures/db.js";

describe("RBAC and FLAC (Role-Based & Field-Level Access Control)", () => {
  describe("Method-Level RBAC", () => {
    it("restricts all endpoints when config.roles is an array", async () => {
      const { adapter } = await createTestDb();

      let currentRole = "viewer";
      const app = createApp<{ Bindings: Record<string, unknown> }, { role: string }>({
        adapter,
        getContext: () => ({ role: currentRole }),
      });

      const postsResource = app.defineResource({
        name: "posts",
        table: posts,
        validator: z.object({ title: z.string() }),
        roles: ["admin"],
      });

      // 1. Viewer is blocked on GET /
      const listRes = await postsResource.request("/", { method: "GET" });
      expect(listRes.status).toBe(403);
      const listErr = await listRes.json();
      expect(listErr.error.code).toBe("FORBIDDEN");
      expect(listErr.error.message).toContain("User role is not authorized");

      // 2. Viewer is blocked on POST /
      const createRes = await postsResource.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Forbidden Post" }),
      });
      expect(createRes.status).toBe(403);

      // 3. Admin is allowed
      currentRole = "admin";
      const adminCreateRes = await postsResource.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Admin Post" }),
      });
      expect(adminCreateRes.status).toBe(201);
      const created = await adminCreateRes.json();

      const adminListRes = await postsResource.request("/", { method: "GET" });
      expect(adminListRes.status).toBe(200);
      const listData = await adminListRes.json();
      expect(listData.data.length).toBe(1);
      expect(listData.data[0].id).toBe(created.data.id);
    });

    it("supports granular per-method roles mapping", async () => {
      const { adapter } = await createTestDb();

      let currentRole = "viewer";
      const app = createApp<{ Bindings: Record<string, unknown> }, { role: string }>({
        adapter,
        getContext: () => ({ role: currentRole }),
      });

      const postsResource = app.defineResource({
        name: "posts",
        table: posts,
        validator: z.object({ title: z.string() }),
        roles: {
          list: ["admin", "viewer"],
          detail: ["admin", "viewer"],
          create: ["admin", "editor"],
          delete: ["admin"],
        },
      });

      const seed: any = await adapter.insert(posts, { title: "Initial Post" });

      // 1. Viewer can list and get detail
      const listRes = await postsResource.request("/", { method: "GET" });
      expect(listRes.status).toBe(200);

      const detailRes = await postsResource.request(`/${seed.id}`, { method: "GET" });
      expect(detailRes.status).toBe(200);

      // 2. Viewer cannot create or delete
      const createRes = await postsResource.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Viewer Post" }),
      });
      expect(createRes.status).toBe(403);

      const deleteRes = await postsResource.request(`/${seed.id}`, { method: "DELETE" });
      expect(deleteRes.status).toBe(403);

      // 3. Editor can create, but cannot delete
      currentRole = "editor";
      const editorCreateRes = await postsResource.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Editor Post" }),
      });
      expect(editorCreateRes.status).toBe(201);

      const editorDeleteRes = await postsResource.request(`/${seed.id}`, { method: "DELETE" });
      expect(editorDeleteRes.status).toBe(403);

      // 4. Admin can delete
      currentRole = "admin";
      const adminDeleteRes = await postsResource.request(`/${seed.id}`, { method: "DELETE" });
      expect(adminDeleteRes.status).toBe(200);
    });
  });

  describe("Role Extraction & Better Auth Compatibility", () => {
    it("extracts roles from Better Auth session.user.role and session.member.role", async () => {
      const { adapter } = await createTestDb();

      // Better Auth session context structure
      let mockContext: any = {
        session: {
          user: { id: "u1", role: "user" },
          member: { id: "m1", role: "org-admin" },
        },
      };

      const app = createApp({
        adapter,
        getContext: () => mockContext,
      });

      const postsResource = app.defineResource({
        name: "posts",
        table: posts,
        validator: z.object({ title: z.string() }),
        roles: {
          create: ["org-admin"],
        },
      });

      // Allowed because member.role is "org-admin"
      const res = await postsResource.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Org Post" }),
      });
      expect(res.status).toBe(201);

      // Fails when member.role is regular "member"
      mockContext = {
        session: {
          user: { id: "u1", role: "user" },
          member: { id: "m1", role: "member" },
        },
      };

      const failRes = await postsResource.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Another Post" }),
      });
      expect(failRes.status).toBe(403);
    });

    it("respects custom appConfig.auth.getRole resolution", async () => {
      const { adapter } = await createTestDb();

      let callerLevel = 10;
      const app = createApp<{ Bindings: Record<string, unknown> }, { level: number }>({
        adapter,
        getContext: () => ({ level: callerLevel }),
        auth: {
          getRole: (ctx) => (ctx.level >= 50 ? ["superadmin"] : ["user"]),
        },
      });

      const postsResource = app.defineResource({
        name: "posts",
        table: posts,
        validator: z.object({ title: z.string() }),
        roles: ["superadmin"],
      });

      // Level 10 -> "user" -> 403
      const res1 = await postsResource.request("/", { method: "GET" });
      expect(res1.status).toBe(403);

      // Level 99 -> "superadmin" -> 200
      callerLevel = 99;
      const res2 = await postsResource.request("/", { method: "GET" });
      expect(res2.status).toBe(200);
    });
  });

  describe("Read FLAC (Field-Level Access Control)", () => {
    it("strips fields when read is false or role unauthorized", async () => {
      const { adapter } = await createTestDb();

      let currentRole = "viewer";
      const app = createApp<{ Bindings: Record<string, unknown> }, { role: string }>({
        adapter,
        getContext: () => ({ role: currentRole }),
      });

      const postsResource = app.defineResource({
        name: "posts",
        table: posts,
        validator: z.object({ title: z.string() }),
        slugs: ["slug"],
        fields: {
          price: { read: ["admin", "accountant"] },
          version: { read: false }, // always hidden via FLAC
        },
      });

      const seed: any = await adapter.insert(posts, {
        title: "FLAC Post",
        slug: "flac-post",
        price: 5000,
        version: 3,
      });

      // 1. Viewer: price and version are stripped
      const viewerList = await (await postsResource.request("/", { method: "GET" })).json();
      expect(viewerList.data[0].price).toBeUndefined();
      expect(viewerList.data[0].version).toBeUndefined();
      expect(viewerList.data[0].title).toBe("FLAC Post");

      const viewerDetail = await (await postsResource.request(`/${seed.id}`, { method: "GET" })).json();
      expect(viewerDetail.data.price).toBeUndefined();
      expect(viewerDetail.data.version).toBeUndefined();

      const viewerSlug = await (await postsResource.request(`/slug/flac-post`, { method: "GET" })).json();
      expect(viewerSlug.data.price).toBeUndefined();
      expect(viewerSlug.data.version).toBeUndefined();

      // 2. Accountant: price is visible, version is still stripped
      currentRole = "accountant";
      const accountantDetail = await (await postsResource.request(`/${seed.id}`, { method: "GET" })).json();
      expect(accountantDetail.data.price).toBe(5000);
      expect(accountantDetail.data.version).toBeUndefined();
    });

    it("supports static string and dynamic function field masking", async () => {
      const { adapter } = await createTestDb();

      let currentRole = "viewer";
      const app = createApp<{ Bindings: Record<string, unknown> }, { role: string }>({
        adapter,
        getContext: () => ({ role: currentRole }),
      });

      const postsResource = app.defineResource({
        name: "posts",
        table: posts,
        validator: z.object({ title: z.string() }),
        fields: {
          content: {
            read: ["admin"],
            mask: "CONFIDENTIAL",
          },
          price: {
            read: ["admin"],
            mask: (val) => (val != null ? 999999 : null),
          },
        },
      });

      const seed: any = await adapter.insert(posts, {
        title: "Masked Post",
        content: "Top secret content",
        price: 1200,
      });

      // 1. Viewer receives masked values
      const res = await (await postsResource.request(`/${seed.id}`, { method: "GET" })).json();
      expect(res.data.content).toBe("CONFIDENTIAL");
      expect(res.data.price).toBe(999999);

      // 2. Admin receives real values
      currentRole = "admin";
      const adminRes = await (await postsResource.request(`/${seed.id}`, { method: "GET" })).json();
      expect(adminRes.data.content).toBe("Top secret content");
      expect(adminRes.data.price).toBe(1200);
    });

    it("evaluates dynamic ownership predicates on read", async () => {
      const { adapter } = await createTestDb();

      const user1: any = await adapter.insert(users, { name: "User 1", email: "u1@example.com" });
      const user2: any = await adapter.insert(users, { name: "User 2", email: "u2@example.com" });

      let currentUserId = user1.id;
      const app = createApp<{ Bindings: Record<string, unknown> }, { userId: number }>({
        adapter,
        getContext: () => ({ userId: currentUserId }),
      });

      const postsResource = app.defineResource({
        name: "posts",
        table: posts,
        validator: z.object({ title: z.string() }),
        fields: {
          content: {
            read: (ctx, post) => ctx.userId === post.authorId,
          },
        },
      });

      const post1: any = await adapter.insert(posts, {
        title: "Post by User 1",
        content: "Private Diary of User 1",
        authorId: user1.id,
      });

      // Caller is user 1 -> can see their own content
      currentUserId = user1.id;
      const res1 = await (await postsResource.request(`/${post1.id}`, { method: "GET" })).json();
      expect(res1.data.content).toBe("Private Diary of User 1");

      // Caller is user 2 -> content is stripped
      currentUserId = user2.id;
      const res2 = await (await postsResource.request(`/${post1.id}`, { method: "GET" })).json();
      expect(res2.data.content).toBeUndefined();
      expect(res2.data.title).toBe("Post by User 1");
    });
  });

  describe("Write FLAC (Create, Update, Batch, and Import)", () => {
    it("silently strips unauthorized fields on create by default", async () => {
      const { adapter } = await createTestDb();

      const currentRole = "viewer";
      const app = createApp<{ Bindings: Record<string, unknown> }, { role: string }>({
        adapter,
        getContext: () => ({ role: currentRole }),
      });

      const postsResource = app.defineResource({
        name: "posts",
        table: posts,
        validator: z.object({
          title: z.string(),
          status: z.string().optional(),
        }),
        fields: {
          status: { write: ["admin"] },
        },
      });

      // Viewer attempts privilege escalation by setting status = "published"
      const res = await postsResource.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Viewer Post",
          status: "published",
        }),
      });

      expect(res.status).toBe(201);
      const created = await res.json();
      // DB schema default applies ("draft") because status was stripped
      expect(created.data.status).toBe("draft");

      // Verify in DB directly
      const inDb: any = await adapter.findFirst(posts, {
        where: (cols: any, { eq }: any) => eq(cols.id, created.data.id),
      });
      expect(inDb.status).toBe("draft");
    });

    it("rejects unauthorized write fields with 403 when fieldViolationStrategy is 'reject'", async () => {
      const { adapter } = await createTestDb();

      const currentRole = "viewer";
      const app = createApp<{ Bindings: Record<string, unknown> }, { role: string }>({
        adapter,
        getContext: () => ({ role: currentRole }),
      });

      const postsResource = app.defineResource({
        name: "posts",
        table: posts,
        validator: z.object({
          title: z.string(),
          status: z.string().optional(),
        }),
        fieldViolationStrategy: "reject",
        fields: {
          status: { write: ["admin"] },
        },
      });

      // 1. Rejected on POST
      const res = await postsResource.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Hacker Post",
          status: "published",
        }),
      });

      expect(res.status).toBe(403);
      const err = await res.json();
      expect(err.error.code).toBe("FIELD_FORBIDDEN");
      expect(err.error.message).toContain("Not authorized to modify field 'status'");

      // 2. Allowed when client sends only authorized fields
      const okRes = await postsResource.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Honest Post" }),
      });
      expect(okRes.status).toBe(201);
    });

    it("protects fields on update (PATCH /:id)", async () => {
      const { adapter } = await createTestDb();

      const currentRole = "viewer";
      const app = createApp<{ Bindings: Record<string, unknown> }, { role: string }>({
        adapter,
        getContext: () => ({ role: currentRole }),
      });

      const postsResource = app.defineResource({
        name: "posts",
        table: posts,
        validator: z.object({
          title: z.string().optional(),
          status: z.string().optional(),
        }),
        fields: {
          status: { write: ["admin"] },
        },
      });

      const seed: any = await adapter.insert(posts, { title: "Original Title", status: "draft" });

      // Viewer updates title and attempts to update status
      const res = await postsResource.request(`/${seed.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Updated Title",
          status: "published",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.title).toBe("Updated Title");
      expect(body.data.status).toBe("draft"); // Unchanged
    });

    it("protects fields on batch-update", async () => {
      const { adapter } = await createTestDb();

      const currentRole = "viewer";
      const app = createApp<{ Bindings: Record<string, unknown> }, { role: string }>({
        adapter,
        getContext: () => ({ role: currentRole }),
      });

      const postsResource = app.defineResource({
        name: "posts",
        table: posts,
        methods: ["list", "detail", "create", "update", "batch-update"],
        validator: z.object({
          title: z.string().optional(),
          status: z.string().optional(),
        }),
        fieldViolationStrategy: "reject",
        fields: {
          status: { write: ["admin"] },
        },
      });

      const seed1: any = await adapter.insert(posts, { title: "Post 1", status: "draft" });
      const seed2: any = await adapter.insert(posts, { title: "Post 2", status: "draft" });

      // Viewer tries batch update with forbidden field
      const failRes = await postsResource.request("/batch-update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [seed1.id, seed2.id],
          data: { status: "published" },
        }),
      });

      expect(failRes.status).toBe(403);
      const err = await failRes.json();
      expect(err.error.code).toBe("FIELD_FORBIDDEN");

      // Allowed when updating permitted field
      const okRes = await postsResource.request("/batch-update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [seed1.id, seed2.id],
          data: { title: "Batch Updated" },
        }),
      });

      expect(okRes.status).toBe(200);
      const updated = await okRes.json();
      expect(updated.success).toBe(true);
      expect(updated.updated).toBe(2);

      const inDb1: any = await adapter.findFirst(posts, {
        where: (cols: any, { eq }: any) => eq(cols.id, seed1.id),
      });
      expect(inDb1.title).toBe("Batch Updated");
      expect(inDb1.status).toBe("draft");
    });

    it("protects fields during import", async () => {
      const { adapter } = await createTestDb();

      const currentRole = "viewer";
      const app = createApp<{ Bindings: Record<string, unknown> }, { role: string }>({
        adapter,
        getContext: () => ({ role: currentRole }),
      });

      const postsResource = app.defineResource({
        name: "posts",
        table: posts,
        methods: ["list", "detail", "create", "update", "import-execute"],
        validator: z.object({
          title: z.string(),
          status: z.string().optional(),
        }),
        fieldViolationStrategy: "reject",
        fields: {
          status: { write: ["admin"] },
        },
        import: {
          lookupBy: "title",
        },
      });

      const importPayload = [
        { title: "Import 1", status: "published" }, // forbidden field
        { title: "Import 2" },                      // valid
      ];

      const res = await postsResource.request("/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importPayload),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      // Import 1 fails with FIELD_FORBIDDEN error
      expect(json.results.errors.length).toBe(1);
      expect(json.results.errors[0].index).toBe(0);
      expect(json.results.errors[0].error).toContain("Not authorized to modify field 'status'");

      // Import 2 succeeds
      expect(json.results.creates.length).toBe(1);
    });
  });
});
