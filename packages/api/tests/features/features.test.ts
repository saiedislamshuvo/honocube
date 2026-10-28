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

    // Strict gt and lt range comparisons: price > 100 AND price < 300 (only matches 200)
    const gtLtRes = await postsResource.request("/?price__gt=100&price__lt=300", { method: "GET" });
    const gtLtData = await gtLtRes.json();
    expect(gtLtData.data.length).toBe(1);
    expect(gtLtData.data[0].title).toBe("Beta Banana");

    // Empty query param and unallowed filter fields are safely ignored
    const ignoreRes = await postsResource.request("/?status=&unallowed_field=hack", { method: "GET" });
    expect(ignoreRes.status).toBe(200);

    // Search term that matches nothing forces empty result
    const noMatchRes = await postsResource.request("/?q=NonExistentKeywordXYZ", { method: "GET" });
    expect(noMatchRes.status).toBe(200);
    const noMatchData = await noMatchRes.json();
    expect(noMatchData.data.length).toBe(0);

    // Pagination overflow throws INVALID_PAGINATION
    const overflowRes = await postsResource.request("/?page=999999999999999999999", { method: "GET" });
    expect(overflowRes.status).toBe(400);
    const overflowJson = await overflowRes.json();
    expect(overflowJson.error.code).toBe("INVALID_PAGINATION");
  });

  it("handles data import with row chunk limits and updates existing records", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const postsResource = defineResource({
      name: "posts",
      table: posts,
      methods: ["list", "detail", "create", "update", "delete", "import-preview", "import-execute"],
      import: {
        lookupBy: "slug",
        maxRowsPerRequest: 5,
      },
      validator: z.object({
        title: z.string(),
        slug: z.string(),
      }),
    });

    // Seed 1 post
    await adapter.insert(posts, { title: "Original Row 1", slug: "row-1" });

    // Import payload: row-1 (existing -> update) and row-2 (new -> create)
    const importPayload = [
      { title: "Updated Row 1", slug: "row-1" },
      { title: "Brand New Row 2", slug: "row-2" },
    ];

    // 1. Preview
    const previewRes = await postsResource.request("/import/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(importPayload),
    });
    expect(previewRes.status).toBe(200);
    const previewJson = await previewRes.json();
    expect(previewJson.results.creates.length).toBe(1);
    expect(previewJson.results.updates.length).toBe(1);

    // 2. Execute
    const executeRes = await postsResource.request("/import/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(importPayload),
    });
    expect(executeRes.status).toBe(200);

    // Verify row-1 was updated and row-2 was created (total 2 in DB)
    const inDb = await adapter.findMany(posts, {
      orderBy: { field: "slug", direction: "asc" },
    });
    expect(inDb.length).toBe(2);
    expect((inDb[0] as any).title).toBe("Updated Row 1");
    expect((inDb[1] as any).title).toBe("Brand New Row 2");
  });
});
