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
});
