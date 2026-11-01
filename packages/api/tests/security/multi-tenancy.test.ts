import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts, tags, users } from "../fixtures/db.js";

describe("Multi-Tenancy Engine", () => {
  it("enforces tenant query isolation across list, detail, slug, and search", async () => {
    const { adapter } = await createTestDb();

    let activeTenant: string | null = "org_a";

    const app = createApp({
      adapter,
      tenancy: {
        field: "tenantId",
        resolve: () => activeTenant,
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      slugs: ["slug"],
      search: {
        fields: ["title", "content"],
      },
      validator: z.object({
        title: z.string(),
        slug: z.string().optional(),
        content: z.string().optional(),
        tenantId: z.string().optional(),
      }),
    });

    // Seed post for org_a and post for org_b
    const postA: any = await adapter.insert(posts, {
      title: "Org A Announcement",
      slug: "org-a-announcement",
      content: "Exclusive secret info for org A",
      tenantId: "org_a",
    });

    const postB: any = await adapter.insert(posts, {
      title: "Org B Secret Roadmap",
      slug: "org-b-roadmap",
      content: "Confidential plan for org B",
      tenantId: "org_b",
    });

    // 1. List as org_a: only sees post A
    activeTenant = "org_a";
    const listResA = await postsResource.request("/", { method: "GET" });
    expect(listResA.status).toBe(200);
    const listA = await listResA.json();
    expect(listA.data.length).toBe(1);
    expect(listA.data[0].id).toBe(postA.id);

    // 2. Detail as org_a: can view post A, post B returns 404
    const detailARes = await postsResource.request(`/${postA.id}`, { method: "GET" });
    expect(detailARes.status).toBe(200);

    const detailBRes = await postsResource.request(`/${postB.id}`, { method: "GET" });
    expect(detailBRes.status).toBe(404);

    // 3. Slug as org_a: can view post A by slug, post B returns 404
    const slugARes = await postsResource.request(`/slug/org-a-announcement`, { method: "GET" });
    expect(slugARes.status).toBe(200);

    const slugBRes = await postsResource.request(`/slug/org-b-roadmap`, { method: "GET" });
    expect(slugBRes.status).toBe(404);

    // 4. Search as org_a: searching for "Confidential" (in post B) returns empty
    const searchRes = await postsResource.request("/?q=Confidential", { method: "GET" });
    expect(searchRes.status).toBe(200);
    const searchData = await searchRes.json();
    expect(searchData.data.length).toBe(0);

    // Searching for "Exclusive" returns post A
    const searchARes = await postsResource.request("/?q=Exclusive", { method: "GET" });
    const searchAData = await searchARes.json();
    expect(searchAData.data.length).toBe(1);
    expect(searchAData.data[0].id).toBe(postA.id);

    // Switch tenant to org_b
    activeTenant = "org_b";
    const listResB = await postsResource.request("/", { method: "GET" });
    const listB = await listResB.json();
    expect(listB.data.length).toBe(1);
    expect(listB.data[0].id).toBe(postB.id);
  });

  it("automatically stamps tenant ID on create and prevents client spoofing", async () => {
    const { adapter } = await createTestDb();

    const activeTenant = "org_alpha";

    const app = createApp({
      adapter,
      tenancy: {
        field: "tenantId",
        resolve: () => activeTenant,
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        tenantId: z.string().optional(),
      }),
    });

    // Case 1: Client creates record without providing tenantId
    const res1 = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Auto-stamped Post" }),
    });
    expect(res1.status).toBe(201);
    const created1 = await res1.json();
    expect(created1.data.tenantId).toBe("org_alpha");

    // Case 2: Client attempts to spoof tenantId to "evil_corp"
    const res2 = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Spoofed Post Attempt",
        tenantId: "evil_corp",
      }),
    });
    expect(res2.status).toBe(201);
    const created2 = await res2.json();
    // Overwritten with verified active tenant
    expect(created2.data.tenantId).toBe("org_alpha");

    // Verify in database directly
    const inDb: any = await adapter.findFirst(posts, {
      where: (cols: any, { eq }: any) => eq(cols.id, created2.data.id),
    });
    expect(inDb.tenantId).toBe("org_alpha");
  });

  it("enforces tenant immutability on update and blocks tenant-hopping", async () => {
    const { adapter } = await createTestDb();

    const activeTenant = "org_1";

    const app = createApp({
      adapter,
      tenancy: {
        field: "tenantId",
        resolve: () => activeTenant,
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      methods: ["list", "detail", "create", "update", "batch-update"],
      validator: z.object({
        title: z.string().optional(),
        tenantId: z.string().optional(),
      }),
    });

    const post: any = await adapter.insert(posts, {
      title: "Initial Post",
      tenantId: "org_1",
    });

    // 1. Client attempts tenant-hopping to "org_2" via single update
    const hopRes = await postsResource.request(`/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Hacked Post",
        tenantId: "org_2",
      }),
    });
    expect(hopRes.status).toBe(403);
    const hopErr = await hopRes.json();
    expect(hopErr.error.code).toBe("TENANT_IMMUTABLE");

    // 2. Client updates with same tenantId in payload (benign form submission)
    const benignRes = await postsResource.request(`/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Updated Title",
        tenantId: "org_1",
      }),
    });
    expect(benignRes.status).toBe(200);
    const updated = await benignRes.json();
    expect(updated.data.title).toBe("Updated Title");
    expect(updated.data.tenantId).toBe("org_1");

    // 3. Batch-update tenant hopping attempt
    const batchHopRes = await postsResource.request("/batch-update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [post.id],
        data: {
          title: "Batch Hacked",
          tenantId: "org_99",
        },
      }),
    });
    expect(batchHopRes.status).toBe(403);
    const batchHopErr = await batchHopRes.json();
    expect(batchHopErr.error.code).toBe("TENANT_IMMUTABLE");
  });

  it("isolates single delete, batch-update, and batch-delete across tenants", async () => {
    const { adapter } = await createTestDb();

    let activeTenant: string = "org_a";

    const app = createApp({
      adapter,
      tenancy: {
        field: "tenantId",
        resolve: () => activeTenant,
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      methods: ["list", "detail", "create", "update", "delete", "batch-update", "batch-delete"],
      validator: z.object({
        title: z.string().optional(),
      }),
    });

    const postA: any = await adapter.insert(posts, {
      title: "Post A",
      tenantId: "org_a",
    });

    const postB: any = await adapter.insert(posts, {
      title: "Post B",
      tenantId: "org_b",
    });

    // org_a tries to DELETE post B: gets 404 NOT_FOUND
    activeTenant = "org_a";
    const delRes = await postsResource.request(`/${postB.id}`, { method: "DELETE" });
    expect(delRes.status).toBe(404);

    // Verify post B is intact
    let checkB: any = await adapter.findFirst(posts, {
      where: (cols: any, { eq }: any) => eq(cols.id, postB.id),
    });
    expect(checkB).toBeTruthy();

    // org_a attempts batch-update targeting post A and post B
    const batchUpRes = await postsResource.request("/batch-update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [postA.id, postB.id],
        data: { title: "Modified Title" },
      }),
    });
    expect(batchUpRes.status).toBe(200);

    // Post A should be updated, Post B should remain unchanged
    const checkA: any = await adapter.findFirst(posts, {
      where: (cols: any, { eq }: any) => eq(cols.id, postA.id),
    });
    checkB = await adapter.findFirst(posts, {
      where: (cols: any, { eq }: any) => eq(cols.id, postB.id),
    });
    expect(checkA.title).toBe("Modified Title");
    expect(checkB.title).toBe("Post B");

    // org_a attempts batch-delete targeting post A and post B
    const batchDelRes = await postsResource.request("/batch-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [postA.id, postB.id],
      }),
    });
    expect(batchDelRes.status).toBe(200);

    // Post A is deleted, Post B is still intact
    const postAInDb = await adapter.findFirst(posts, {
      where: (cols: any, { eq }: any) => eq(cols.id, postA.id),
    });
    const postBInDb = await adapter.findFirst(posts, {
      where: (cols: any, { eq }: any) => eq(cols.id, postB.id),
    });
    expect(postAInDb).toBeNull();
    expect(postBInDb).toBeTruthy();
  });

  it("supports holding company / multiple tenant IDs (array resolution)", async () => {
    const { adapter } = await createTestDb();

    // Holding company holds subsidiary org_1 and subsidiary org_2
    const holdingTenants = ["sub_org_1", "sub_org_2"];

    const app = createApp({
      adapter,
      tenancy: {
        field: "tenantId",
        resolve: () => holdingTenants,
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        tenantId: z.string().optional(),
      }),
    });

    // Seed data
    const p1: any = await adapter.insert(posts, { title: "Sub 1 Post", tenantId: "sub_org_1" });
    const p2: any = await adapter.insert(posts, { title: "Sub 2 Post", tenantId: "sub_org_2" });
    const pOther: any = await adapter.insert(posts, { title: "Unrelated Org Post", tenantId: "unrelated_org" });

    // 1. List query: matches WHERE tenant_id IN ('sub_org_1', 'sub_org_2')
    const listRes = await postsResource.request("/", { method: "GET" });
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    const ids = listData.data.map((r: any) => r.id);
    expect(ids).toContain(p1.id);
    expect(ids).toContain(p2.id);
    expect(ids).not.toContain(pOther.id);

    // 2. Create specifying one of the authorized tenant IDs
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "New Post for Sub 2",
        tenantId: "sub_org_2",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.data.tenantId).toBe("sub_org_2");

    // 3. Create specifying an unauthorized tenant ID outside the array
    const unauthRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Hacked Post",
        tenantId: "unrelated_org",
      }),
    });
    expect(unauthRes.status).toBe(403);
    const unauthErr = await unauthRes.json();
    expect(unauthErr.error.code).toBe("TENANT_ACCESS_DENIED");

    // 4. Create omitting tenantId when array has multiple IDs: ambiguous error
    const ambiguousRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Ambiguous Post",
      }),
    });
    expect(ambiguousRes.status).toBe(400);
    const ambErr = await ambiguousRes.json();
    expect(ambErr.error.code).toBe("TENANT_REQUIRED");
  });

  it("supports superadmin bypass and header-based impersonation", async () => {
    const { adapter } = await createTestDb();

    const app = createApp({
      adapter,
      tenancy: {
        field: "tenantId",
        resolve: (c) => c.req.header("x-organization-id") || null,
        bypass: (c) => c.req.header("x-superadmin-bypass") === "true",
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        tenantId: z.string().optional(),
      }),
    });

    await adapter.insert(posts, { title: "Org 10 Post", tenantId: "org_10" });
    await adapter.insert(posts, { title: "Org 20 Post", tenantId: "org_20" });

    // 1. Superadmin with global bypass sees all records
    const bypassRes = await postsResource.request("/", {
      method: "GET",
      headers: { "x-superadmin-bypass": "true" },
    });
    expect(bypassRes.status).toBe(200);
    const bypassData = await bypassRes.json();
    expect(bypassData.data.length).toBe(2);

    // 2. Superadmin impersonation: scopes to org_10 via header
    const impRes = await postsResource.request("/", {
      method: "GET",
      headers: { "x-organization-id": "org_10" },
    });
    expect(impRes.status).toBe(200);
    const impData = await impRes.json();
    expect(impData.data.length).toBe(1);
    expect(impData.data[0].tenantId).toBe("org_10");

    // 3. Superadmin create with explicit tenantId when bypassed
    const superCreateRes = await postsResource.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-superadmin-bypass": "true",
      },
      body: JSON.stringify({
        title: "Superadmin Created Post",
        tenantId: "org_special",
      }),
    });
    expect(superCreateRes.status).toBe(201);
    const superCreated = await superCreateRes.json();
    expect(superCreated.data.tenantId).toBe("org_special");
  });

  it("enforces tenant presence and supports custom error messages", async () => {
    const { adapter } = await createTestDb();

    // App where resolve returns null (e.g. unauthenticated or no active org)
    const app = createApp({
      adapter,
      tenancy: {
        field: "tenantId",
        resolve: () => null,
        errorMessage: "Please select an active organization before accessing resources.",
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
    });

    const res = await postsResource.request("/", { method: "GET" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("TENANT_REQUIRED");
    expect(body.error.message).toBe("Please select an active organization before accessing resources.");
  });

  it("allows resources to opt out of tenancy (tenancy: false)", async () => {
    const { adapter } = await createTestDb();

    const app = createApp({
      adapter,
      tenancy: {
        field: "tenantId",
        resolve: () => "org_1",
      },
    });

    // Shared global tags table does not have a tenantId column
    const tagsResource = app.defineResource({
      name: "tags",
      table: tags,
      tenancy: false, // Explicitly opted out
      validator: z.object({ name: z.string() }),
    });

    // Create a global tag
    const createRes = await tagsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Global Announcement" }),
    });
    expect(createRes.status).toBe(201);

    // List global tags: works without tenant filter
    const listRes = await tagsResource.request("/", { method: "GET" });
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.data.length).toBe(1);
    expect(listData.data[0].name).toBe("Global Announcement");
  });

  it("isolates cache keys by tenant preventing cross-tenant cache contamination", async () => {
    const { adapter } = await createTestDb();

    const cacheStore = new Map<string, any>();
    const mockCache = {
      get: async (key: string) => cacheStore.get(key),
      set: async (key: string, value: any) => {
        cacheStore.set(key, value);
      },
      delete: async (key: string) => {
        cacheStore.delete(key);
      },
      clear: async (prefix?: string) => {
        if (!prefix) cacheStore.clear();
        else {
          for (const k of cacheStore.keys()) {
            if (k.startsWith(prefix)) cacheStore.delete(k);
          }
        }
      },
    };

    let activeTenant = "tenant_1";

    const app = createApp({
      adapter,
      cache: mockCache,
      tenancy: {
        field: "tenantId",
        resolve: () => activeTenant,
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      cache: {
        enabled: true,
        keyBy: () => "authenticated-user",
      },
      validator: z.object({ title: z.string() }),
    });

    await adapter.insert(posts, { title: "Tenant 1 Exclusive", tenantId: "tenant_1" });
    await adapter.insert(posts, { title: "Tenant 2 Exclusive", tenantId: "tenant_2" });

    // Request as tenant_1
    activeTenant = "tenant_1";
    const res1 = await postsResource.request("/", { method: "GET" });
    const data1 = await res1.json();
    expect(data1.data[0].title).toBe("Tenant 1 Exclusive");

    // Verify cache store has key containing tenant_1
    const keys = Array.from(cacheStore.keys());
    expect(keys.some((k) => k.includes(":tenant:tenant_1"))).toBe(true);

    // Request as tenant_2: MUST NOT receive tenant_1 cached data!
    activeTenant = "tenant_2";
    const res2 = await postsResource.request("/", { method: "GET" });
    const data2 = await res2.json();
    expect(data2.data[0].title).toBe("Tenant 2 Exclusive");

    // Verify cache store now has separate key containing tenant_2
    const keys2 = Array.from(cacheStore.keys());
    expect(keys2.some((k) => k.includes(":tenant:tenant_2"))).toBe(true);
  });

  it("enforces tenant isolation and auto-stamping on batch import", async () => {
    const { adapter } = await createTestDb();

    let activeTenant = "org_a";

    const app = createApp({
      adapter,
      tenancy: {
        field: "tenantId",
        resolve: () => activeTenant,
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      methods: ["list", "import-preview", "import-execute"],
      import: {
        lookupBy: "slug",
      },
      validator: z.object({
        title: z.string(),
        slug: z.string(),
        tenantId: z.string().optional(),
      }),
    });

    // Pre-insert post for org_b with slug "shared-slug"
    await adapter.insert(posts, {
      title: "Org B Post",
      slug: "shared-slug",
      tenantId: "org_b",
    });

    // org_a executes import:
    // Row 1: New post "org-a-post"
    // Row 2: Attempting to update "shared-slug" belonging to org_b
    activeTenant = "org_a";
    const importRes = await postsResource.request("/import/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { title: "Org A Post", slug: "org-a-post" },
        { title: "Hijacked Post", slug: "shared-slug" },
      ]),
    });

    expect(importRes.status).toBe(200);
    const result = await importRes.json();

    // Row 1 should be created under org_a
    expect(result.results.creates.length).toBe(1);
    expect(result.results.creates[0].tenantId).toBe("org_a");

    // Row 2 should be flagged as error (cannot touch record outside caller's scope/tenant)
    expect(result.results.errors.length).toBe(1);
    expect(result.results.errors[0].index).toBe(1);

    // Verify Org B's post was not mutated
    const postBInDb: any = await adapter.findFirst(posts, {
      where: (cols: any, { eq }: any) => eq(cols.slug, "shared-slug"),
    });
    expect(postBInDb.title).toBe("Org B Post");
    expect(postBInDb.tenantId).toBe("org_b");
  });

  it("fails closed with 500 CONFIG_ERROR when table lacks tenant column and is not skipped", async () => {
    const { adapter } = await createTestDb();

    const app = createApp({
      adapter,
      tenancy: {
        field: "tenantId",
        resolve: () => "org_1",
      },
    });

    // tags table does NOT have a tenantId column and developer forgot tenancy: false
    const brokenResource = app.defineResource({
      name: "tags",
      table: tags,
      validator: z.object({ name: z.string() }),
    });

    const res = await brokenResource.request("/", { method: "GET" });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("CONFIG_ERROR");
    expect(body.error.message).toContain("table does not have tenant column 'tenantId'");
  });

  it("supports resource-level { skip: true } and custom field override", async () => {
    const { adapter } = await createTestDb();

    const app = createApp({
      adapter,
      tenancy: {
        field: "tenantId",
        resolve: () => "org_custom",
      },
    });

    // 1. Resource using { skip: true }
    const skippedResource = app.defineResource({
      name: "tags",
      table: tags,
      tenancy: { skip: true },
      validator: z.object({ name: z.string() }),
    });

    const skipRes = await skippedResource.request("/", { method: "GET" });
    expect(skipRes.status).toBe(200);

    // 2. Resource with custom column name override on users table
    const usersResource = app.defineResource({
      name: "users",
      table: users,
      tenancy: { field: "tenantId" },
      validator: z.object({ name: z.string(), email: z.string(), tenantId: z.string().optional() }),
    });

    const userCreateRes = await usersResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice", email: "alice@example.com" }),
    });
    expect(userCreateRes.status).toBe(201);
    const createdUser = await userCreateRes.json();
    expect(createdUser.data.tenantId).toBe("org_custom");
  });

  it("supports dynamic enforce predicate and enforce: false", async () => {
    const { adapter } = await createTestDb();

    // Enforce is false when path is /public
    const app = createApp({
      adapter,
      tenancy: {
        field: "tenantId",
        resolve: (c) => c.req.header("x-tenant-id") || null,
        enforce: (c) => !c.req.path.includes("/public"),
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
    });

    await adapter.insert(posts, { title: "Public Article", tenantId: "org_x" });

    // 1. Without tenant header on non-public path: rejected with 400 TENANT_REQUIRED
    const rejectRes = await postsResource.request("/", { method: "GET" });
    expect(rejectRes.status).toBe(400);

    // 2. On /public route with enforce function evaluating to false: allowed through
    const allowRes = await postsResource.request("/public", { method: "GET" });
    expect(allowRes.status).not.toBe(400);

    // 3. Static enforce: false allows unauthenticated access unscoped
    const unscopedApp = createApp({
      adapter,
      tenancy: {
        field: "tenantId",
        resolve: () => null,
        enforce: false,
      },
    });

    const unscopedResource = unscopedApp.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
    });

    const unscopedRes = await unscopedResource.request("/", { method: "GET" });
    expect(unscopedRes.status).toBe(200);
    const unscopedData = await unscopedRes.json();
    expect(unscopedData.data.length).toBe(1);
  });

  it("auto-defaults tenant ID when array has exactly 1 element and payload omits tenantId", async () => {
    const { adapter } = await createTestDb();

    const app = createApp({
      adapter,
      tenancy: {
        field: "tenantId",
        resolve: () => ["single_assigned_org"],
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        tenantId: z.string().optional(),
      }),
    });

    const res = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Auto-defaulted Single Element Post" }),
    });

    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.data.tenantId).toBe("single_assigned_org");
  });

  it("supports numeric (integer) tenant IDs", async () => {
    const { adapter } = await createTestDb();

    let activeTenant: number | number[] = 101;

    const app = createApp({
      adapter,
      tenancy: {
        field: "tenantId",
        resolve: () => activeTenant,
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        tenantId: z.union([z.string(), z.number()]).optional(),
      }),
    });

    // Create record as numeric tenant 101
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Numeric Tenant Post" }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(Number(created.data.tenantId)).toBe(101);

    // Switch to holding array with numbers [101, 202]
    activeTenant = [101, 202];
    const listRes = await postsResource.request("/", { method: "GET" });
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.data.length).toBe(1);
  });

  it("validates and auto-stamps in import/preview mode without writing to DB", async () => {
    const { adapter } = await createTestDb();

    const app = createApp({
      adapter,
      tenancy: {
        field: "tenantId",
        resolve: () => "org_preview",
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      methods: ["import-preview", "import-execute"],
      import: {
        lookupBy: "slug",
      },
      validator: z.object({
        title: z.string(),
        slug: z.string(),
        tenantId: z.string().optional(),
      }),
    });

    const previewRes = await postsResource.request("/import/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { title: "Preview Post", slug: "preview-post" },
      ]),
    });

    expect(previewRes.status).toBe(200);
    const previewData = await previewRes.json();
    expect(previewData.results.creates.length).toBe(1);
    expect(previewData.results.creates[0].tenantId).toBe("org_preview");

    // Verify nothing was actually inserted in the database
    const inDb = await adapter.findFirst(posts, {
      where: (cols: any, { eq }: any) => eq(cols.slug, "preview-post"),
    });
    expect(inDb).toBeNull();
  });

  it("works seamlessly with @honocube/api/testing harness (testResource.run)", async () => {
    const { adapter } = await createTestDb();

    const { testResource } = await import("../../src/testing/index.js");

    const app = createApp({
      adapter,
      tenancy: {
        field: "tenantId",
        resolve: () => "tenant_test_harness",
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string(), tenantId: z.string().optional() }),
    });

    const report = await testResource.run(postsResource, {
      fixtures: {
        valid: { title: "Harness Created" },
        update: { title: "Harness Updated" },
        invalid: { title: 123 as any },
      },
    });

    expect(report.success).toBe(true);
    expect(report.failed).toBe(0);
    expect(report.passed).toBeGreaterThan(0);
  });
});
