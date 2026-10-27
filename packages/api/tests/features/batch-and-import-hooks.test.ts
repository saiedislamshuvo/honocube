import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts } from "../fixtures/db.js";

describe("Batch and Import Lifecycle Hooks", () => {
  it("triggers beforeBatchUpdate and afterBatchUpdate and can filter IDs", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });
    const hookEvents: string[] = [];

    // Seed 2 posts
    const p1: any = await adapter.insert(posts, { title: "Post 1", status: "draft" });
    const p2: any = await adapter.insert(posts, { title: "Post 2", status: "draft" });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      methods: ["list", "detail", "create", "update", "delete", "batch-update", "batch-delete"],
      validator: z.object({
        title: z.string().optional(),
        status: z.string().optional(),
      }),
      hooks: {
        beforeBatchUpdate: (ids, data) => {
          hookEvents.push(`beforeBatchUpdate:${ids.length}`);
          // Hook filters out p2, only allowing p1 to be updated
          return { ids: [p1.id], data };
        },
        afterBatchUpdate: (ids) => {
          hookEvents.push(`afterBatchUpdate:${ids.length}`);
        },
      },
    });

    const res = await postsResource.request("/batch-update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [p1.id, p2.id],
        data: { status: "published" },
      }),
    });

    expect(res.status).toBe(200);
    expect(hookEvents).toEqual(["beforeBatchUpdate:2", "afterBatchUpdate:1"]);

    // Verify p1 was updated to published, but p2 remained draft because hook excluded it
    const updatedP1: any = await adapter.findFirst(posts, {
      where: (cols: any, { eq }: any) => eq(cols.id, p1.id),
    });
    const updatedP2: any = await adapter.findFirst(posts, {
      where: (cols: any, { eq }: any) => eq(cols.id, p2.id),
    });

    expect(updatedP1.status).toBe("published");
    expect(updatedP2.status).toBe("draft");
  });

  it("triggers beforeImport and afterImport with stats", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });
    let afterImportResults: any;

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      methods: ["list", "detail", "create", "update", "delete", "import-preview", "import-execute"],
      import: { lookupBy: "slug", maxRowsPerRequest: 10 },
      validator: z.object({ title: z.string(), slug: z.string() }),
      hooks: {
        beforeImport: (rows) => {
          return rows.map((r) => ({ ...r, title: `${r.title} [IMPORTED]` }));
        },
        afterImport: (results) => {
          afterImportResults = results;
        },
      },
    });

    const res = await postsResource.request("/import/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ title: "Doc", slug: "doc-1" }]),
    });

    expect(res.status).toBe(200);
    expect(afterImportResults).toBeDefined();
    expect(afterImportResults.creates.length).toBe(1);

    const inDb: any = await adapter.findFirst(posts, {
      where: (cols: any, { eq }: any) => eq(cols.slug, "doc-1"),
    });
    expect(inDb.title).toBe("Doc [IMPORTED]");
  });

  it("enforces import payload validation, max row limits, and empty payload handling", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      methods: ["import-execute"],
      import: { lookupBy: "slug", maxRowsPerRequest: 2 },
      validator: z.object({ title: z.string(), slug: z.string() }),
    });

    // 1. Non-array payload throws 400
    const nonArrayRes = await postsResource.request("/import/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notAnArray: true }),
    });
    expect(nonArrayRes.status).toBe(400);
    const nonArrayJson = await nonArrayRes.json();
    expect(nonArrayJson.error.code).toBe("INVALID_PAYLOAD");

    // 2. Exceeding maxRowsPerRequest throws 400
    const excessRes = await postsResource.request("/import/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { title: "Row 1", slug: "r1" },
        { title: "Row 2", slug: "r2" },
        { title: "Row 3", slug: "r3" },
      ]),
    });
    expect(excessRes.status).toBe(400);
    const excessJson = await excessRes.json();
    expect(excessJson.error.message).toContain("limit for 'posts' is 2");

    // 3. Empty array returns empty results
    const emptyRes = await postsResource.request("/import/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([]),
    });
    expect(emptyRes.status).toBe(200);
    const emptyJson = await emptyRes.json();
    expect(emptyJson.results.creates.length).toBe(0);
  });

  it("handles scope and soft-delete collisions, validation errors, and unchanged rows during import", async () => {
    const { adapter } = await createTestDb();
    const tenant = "tenant-A";
    const app = createApp<{ Bindings: Record<string, unknown> }, { tenantId: string }>({
      adapter,
      getContext: () => ({ tenantId: tenant }),
    });

    // Seed: Tenant B record (outside scope) and soft-deleted record
    await adapter.insert(posts, { title: "Tenant B Post", slug: "slug-b", tenantId: "tenant-B" });
    await adapter.insert(posts, {
      title: "Soft Deleted",
      slug: "slug-del",
      tenantId: "tenant-A",
      deletedAt: new Date().toISOString(),
    });
    // Seed existing identical record (to test unchanged)
    await adapter.insert(posts, { title: "Unchanged Title", slug: "slug-unchanged", tenantId: "tenant-A" });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      methods: ["import-execute"],
      softDelete: "deletedAt",
      scope: (cols, { eq }, ctx) => eq(cols.tenantId, ctx.tenantId),
      import: { lookupBy: "slug", maxRowsPerRequest: 10 },
      validator: z.object({
        title: z.string().min(3),
        slug: z.string(),
      }),
    });

    const payload = [
      // 1. Matches tenant B -> outside scope error
      { title: "Attempt Update B", slug: "slug-b" },
      // 2. Matches soft-deleted record -> soft-deleted error
      { title: "Attempt Update Del", slug: "slug-del" },
      // 3. Fails schema validation (title too short) -> validation error
      { title: "A", slug: "slug-invalid" },
      // 4. Identical to existing record -> unchanged
      { title: "Unchanged Title", slug: "slug-unchanged" },
    ];

    const res = await postsResource.request("/import/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    const results = json.results;

    // Verify errors
    expect(results.errors.length).toBe(3);
    expect(results.errors[0].error).toContain("outside the caller's scope");
    expect(results.errors[1].error).toContain("soft-deleted record");
    expect(results.errors[2].error).toBeDefined();

    // Verify unchanged
    expect(results.unchanged.length).toBe(1);
    expect(results.unchanged[0].slug).toBe("slug-unchanged");
  });

  it("handles composite and alternative lookupBy keys, OCC, and relations in import", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter }); // default batch strategy

    const { comments, postTags, tags } = await import("../fixtures/db.js");
    const tag1: any = await adapter.insert(tags, { name: "ImportTag" });

    // Seed existing post with version 1
    await adapter.insert(posts, { title: "Composite Exists", slug: "comp-1", tenantId: "t-comp", version: 1 });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      methods: ["import-execute"],
      versionControl: { field: "version" },
      import: {
        // Compound lookup key: [tenantId, slug]
        lookupBy: ["tenantId", "slug"],
        maxRowsPerRequest: 10,
      },
      relations: {
        many: [
          {
            name: "comments",
            table: comments,
            foreignKey: "postId",
            referenceKey: "id",
            schema: z.object({ author: z.string(), content: z.string() }),
          },
        ],
        pivots: [
          {
            name: "tags",
            table: postTags,
            targetTable: tags,
            foreignKey: "postId",
            referenceKey: "tagId",
            targetReferenceKey: "id",
            relationName: "postTags",
          },
        ],
      },
      validator: z.object({
        title: z.string(),
        slug: z.string(),
        tenantId: z.string(),
        version: z.number().optional(),
        comments: z.any().optional(),
        tags: z.any().optional(),
      }),
    });

    // 1. Missing version in update payload triggers version error
    const missingVerRes = await postsResource.request("/import/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { title: "No Version Update", slug: "comp-1", tenantId: "t-comp" },
      ]),
    });
    const missingVerJson = await missingVerRes.json();
    expect(missingVerJson.results.errors.length).toBe(1);
    expect(missingVerJson.results.errors[0].error).toContain("Version control field");

    // 2. Create new record with nested relations under transaction mode
    const createPayload = [
      {
        title: "Brand New Composite",
        slug: "comp-new",
        tenantId: "t-comp",
        version: 1,
        comments: [{ author: "ImportAuthor", content: "Imported comment" }],
        tags: [{ tagId: tag1.id }],
      },
    ];

    const createRes = await postsResource.request("/import/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createPayload),
    });
    expect(createRes.status).toBe(200);
    const createJson = await createRes.json();
    expect(createJson.results.creates.length).toBe(1);

    // 3. Alternative array-of-arrays lookup keys: [["slug"], ["title"]]
    const altLookupResource = app.defineResource({
      name: "posts_alt",
      table: posts,
      methods: ["import-execute"],
      import: {
        lookupBy: [["slug"], ["title"]],
      },
      validator: z.object({ title: z.string(), slug: z.string(), tenantId: z.string() }),
    });

    const altRes = await altLookupResource.request("/import/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { title: "Brand New Composite", slug: "comp-different", tenantId: "t-comp" },
      ]),
    });
    expect(altRes.status).toBe(200);
    const altJson = await altRes.json();
    // Matches existing "Brand New Composite" by title
    expect(altJson.results.updates.length).toBe(1);
  });
});
