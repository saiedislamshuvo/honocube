import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts } from "../fixtures/db.js";

describe("Enterprise & Core Features", () => {
  it("enforces optimistic concurrency control (OCC)", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const postsResource = defineResource({
      name: "posts",
      table: posts,
      versionControl: { field: "version" },
      validator: z.object({
        title: z.string().optional(),
        version: z.number().optional(),
      }),
    });

    const p: any = await adapter.insert(posts, {
      title: "Initial Title",
      version: 1,
    });

    // 1. Missing version field throws 400 MISSING_VERSION
    const missingRes = await postsResource.request(`/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "No Version" }),
    });
    expect(missingRes.status).toBe(400);

    // 2. Successful update increments version to 2
    const successRes = await postsResource.request(`/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Once", version: 1 }),
    });
    expect(successRes.status).toBe(200);
    const updated = await successRes.json();
    expect(updated.data.version).toBe(2);

    // 3. Stale update with version 1 throws 409 OCC_FAILED
    const staleRes = await postsResource.request(`/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Stale Update", version: 1 }),
    });
    expect(staleRes.status).toBe(409);
    const staleJson = await staleRes.json();
    expect(staleJson.error.code).toBe("OCC_FAILED");
  });

  it("handles soft deletes seamlessly", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const postsResource = defineResource({
      name: "posts",
      table: posts,
      softDelete: "deletedAt",
      validator: z.object({ title: z.string() }),
    });

    const p: any = await adapter.insert(posts, {
      title: "Soft Delete Post",
    });

    // 1. Soft delete the post
    const deleteRes = await postsResource.request(`/${p.id}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(200);

    // 2. Row still exists in database, but has deletedAt populated
    const inDb: any = await adapter.findFirst(posts, {
      where: (cols: any, { eq }: any) => eq(cols.id, p.id),
    });
    expect(inDb).toBeDefined();
    expect(inDb.deletedAt).not.toBeNull();

    // 3. GET /:id returns 404 (excluded)
    const getRes = await postsResource.request(`/${p.id}`, { method: "GET" });
    expect(getRes.status).toBe(404);

    // 4. GET / (list) excludes it
    const listRes = await postsResource.request("/", { method: "GET" });
    const list = await listRes.json();
    expect(list.data.length).toBe(0);
  });

  it("supports search (q) and advanced comparison operators", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const postsResource = defineResource({
      name: "posts",
      table: posts,
      search: { fields: ["title", "content"] },
      filter: { allow: ["price", "status"] },
      validator: z.object({
        title: z.string(),
        price: z.number().optional(),
        status: z.string().optional(),
      }),
    });

    await adapter.insert(posts, { title: "Alpha Apple", price: 100, status: "active" });
    await adapter.insert(posts, { title: "Beta Banana", price: 200, status: "active" });
    await adapter.insert(posts, { title: "Gamma Cherry", price: 300, status: "archived" });

    // Search 'Banana'
    const qRes = await postsResource.request("/?q=Banana", { method: "GET" });
    const qData = await qRes.json();
    expect(qData.data.length).toBe(1);
    expect(qData.data[0].title).toBe("Beta Banana");

    // Range comparison: price >= 150 AND price <= 250
    const rangeRes = await postsResource.request("/?price__gte=150&price__lte=250", { method: "GET" });
    const rangeData = await rangeRes.json();
    expect(rangeData.data.length).toBe(1);
    expect(rangeData.data[0].title).toBe("Beta Banana");

    // LIKE comparison: status__like=act (matches 'active', does not match 'archived')
    const likeRes = await postsResource.request("/?status__like=act", { method: "GET" });
    const likeData = await likeRes.json();
    expect(likeData.data.length).toBe(2);
  });

  it("handles data import with row chunk limits", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const postsResource = defineResource({
      name: "posts",
      table: posts,
      methods: ["list", "detail", "create", "update", "delete", "import-preview", "import-execute"],
      import: {
        lookupBy: "slug",
        maxRowsPerRequest: 2,
      },
      validator: z.object({
        title: z.string(),
        slug: z.string().optional(),
      }),
    });

    // 1. Exceeding maxRowsPerRequest throws 400
    const overLimitRes = await postsResource.request("/import/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { title: "Row 1", slug: "row-1" },
        { title: "Row 2", slug: "row-2" },
        { title: "Row 3", slug: "row-3" },
      ]),
    });
    expect(overLimitRes.status).toBe(400);

    // 2. Preview 2 rows
    const previewRes = await postsResource.request("/import/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { title: "Row 1", slug: "row-1" },
        { title: "Row 2", slug: "row-2" },
      ]),
    });
    expect(previewRes.status).toBe(200);
    const previewJson = await previewRes.json();
    expect(previewJson.results.creates.length).toBe(2);

    // 3. Execute 2 rows
    const executeRes = await postsResource.request("/import/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { title: "Row 1", slug: "row-1" },
        { title: "Row 2", slug: "row-2" },
      ]),
    });
    expect(executeRes.status).toBe(200);

    const count = await adapter.count(posts);
    expect(count).toBe(2);
  });
});
