import { describe, it, expect } from "vitest";
import { z } from "zod";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts, users, tags, postTags, comments } from "../fixtures/db.js";

describe("Framework Edge Cases & Deep Branch Coverage", () => {
  it("covers isDefaultNotFound, custom 404 responses, and default logger methods", async () => {
    const { adapter } = await createTestDb();

    // 1. App with default logger
    const defaultApp = createApp({ adapter });
    const defaultRes = defaultApp.defineResource({
      name: "users",
      table: users,
      validator: z.object({ name: z.string() }),
      actions: [
        {
          path: "/actions/fail",
          method: "get",
          handler: () => {
            throw new Error("Unhandled crash to exercise default logger");
          },
        },
      ],
    });

    const crashRes = await defaultRes.request("/actions/fail", { method: "GET" });
    expect(crashRes.status).toBe(500);

    // 2. Custom finalized 404 and 200 responses in middleware to hit all branches of isDefaultNotFound
    const custom404App = createApp({
      adapter,
      middleware: [
        async (c, next) => {
          if (c.req.path === "/custom/test-200") {
            c.res = new Response("OK", { status: 200, headers: { "content-type": "text/plain" } });
          } else if (c.req.path === "/custom/test-404-json") {
            c.res = new Response(JSON.stringify({ custom: true }), {
              status: 404,
              headers: { "content-type": "application/json" },
            });
          } else if (c.req.path === "/custom/test-404-custom-text") {
            c.res = new Response("Custom 404 Text", {
              status: 404,
              headers: { "content-type": "text/plain" },
            });
          } else if (c.req.path === "/custom/test-404-default-text") {
            c.res = new Response("404 Not Found", {
              status: 404,
              headers: { "content-type": "text/plain" },
            });
          }
          await next();
        },
      ],
    });

    const testRes = custom404App.defineResource({
      name: "users",
      table: users,
      validator: z.object({ name: z.string() }),
    });

    // 200 response -> line 44 false -> line 1816 return c.res
    const r200 = await testRes.request("/custom/test-200", { method: "GET" });
    expect(r200.status).toBe(200);

    // 404 JSON -> line 46 false -> line 1816 return c.res
    const rJson = await testRes.request("/custom/test-404-json", { method: "GET" });
    expect(rJson.status).toBe(404);
    expect(await rJson.json()).toEqual({ custom: true });

    // 404 Custom Text -> line 48 false -> line 1816 return c.res
    const rCustomText = await testRes.request("/custom/test-404-custom-text", { method: "GET" });
    expect(rCustomText.status).toBe(404);
    expect(await rCustomText.text()).toBe("Custom 404 Text");

    // 404 Default Text -> line 48 true -> replaced with ApiError envelope
    const rDefaultText = await testRes.request("/custom/test-404-default-text", { method: "GET" });
    expect(rDefaultText.status).toBe(404);
    const defaultJson = await rDefaultText.json();
    expect(defaultJson.error.code).toBe("NOT_FOUND");
  });

  it("covers search: {} empty fields fallback and custom strategy in runTransaction", async () => {
    const { adapter } = await createTestDb();

    // 1. search configured but fields is empty -> cols.id = -1 (line 640)
    const app = createApp({ adapter });
    const emptySearchRes = app.defineResource({
      name: "posts",
      table: posts,
      search: {},
      validator: z.object({ title: z.string() }),
    });

    const searchRes = await emptySearchRes.request("/?q=anything", { method: "GET" });
    expect(searchRes.status).toBe(200);
    const searchJson = await searchRes.json();
    expect(searchJson.data.length).toBe(0);

    // 2. Custom strategy fallback in runTransaction (line 726)
    const customStratApp = createApp({ adapter, strategy: "custom" as any });
    const stratRes = customStratApp.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
    });

    const createRes = await stratRes.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Custom Strat Post" }),
    });
    expect(createRes.status).toBe(201);
  });

  it("covers imperative create with afterCreate hook and imperative update 404 without OCC", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter, strategy: "transaction" });

    let afterCreateCalled = false;
    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
      hooks: {
        afterCreate: async () => {
          afterCreateCalled = true;
        },
      },
    });

    // 1. Imperative create triggers afterCreate hook (line 1129)
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Imperative Created" }),
    });
    expect(createRes.status).toBe(201);
    expect(afterCreateCalled).toBe(true);

    // 2. Imperative update on non-existent record without versionControl throws 404 (line 1309)
    const notFoundRes = await postsResource.request("/99999", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Does Not Exist" }),
    });
    expect(notFoundRes.status).toBe(404);
  });

  it("covers upsert default lookupBy, composite array lookupBy, child table without id, and append strategy", async () => {
    const { adapter, client } = await createTestDb();

    // Create a child table without an 'id' column: (post_id, meta_key, meta_value)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS post_meta (
        post_id INTEGER NOT NULL,
        meta_key TEXT NOT NULL,
        meta_value TEXT NOT NULL
      );
    `);

    const postMeta = sqliteTable("post_meta", {
      postId: integer("post_id").notNull(),
      metaKey: text("meta_key").notNull(),
      metaValue: text("meta_value").notNull(),
    });

    const app = createApp({ adapter, strategy: "transaction" });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string().optional() }),
      relations: {
        many: [
          // 1. Child table without 'id' column with string lookupBy (line 382)
          {
            name: "meta",
            table: postMeta,
            foreignKey: "postId",
            referenceKey: "postId",
            strategy: "upsert",
            lookupBy: "metaKey",
          },
          // 2. Comments with omitted lookupBy (defaults to 'id', line 360)
          {
            name: "comments",
            table: comments,
            foreignKey: "postId",
            referenceKey: "id",
            strategy: "upsert",
          },
        ],
        pivots: [
          // 3. Pivot upsert where lookupBy is omitted (defaults to referenceKey, line 359)
          {
            name: "tags",
            table: postTags,
            targetTable: tags,
            foreignKey: "postId",
            referenceKey: "tagId",
            targetReferenceKey: "id",
            relationName: "postTags",
            strategy: "upsert",
          },
        ],
      },
    });

    const tag1: any = await adapter.insert(tags, { name: "TagA" });
    const tag2: any = await adapter.insert(tags, { name: "TagB" });

    // Seed post with initial meta, comment, and tag
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Upsert Deep Post",
        meta: [{ metaKey: "color", metaValue: "blue" }],
        comments: [{ author: "Alice", content: "Hello" }],
        tags: [{ tagId: tag1.id }],
      }),
    });
    const created = await createRes.json();
    const postId = created.data.id;

    // PATCH: updates existing meta & comment, inserts new meta & comment & tag
    const patchRes = await postsResource.request(`/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Upsert Deep Post Updated",
        meta: [
          { metaKey: "color", metaValue: "red" }, // update without id column (lines 383-385)
          { metaKey: "size", metaValue: "large" }, // insert
        ],
        comments: [
          { author: "Alice", content: "Hello" }, // update existing
          { author: "Bob", content: "World" }, // insert new
        ],
        tags: [
          { tagId: tag1.id }, // existing
          { tagId: tag2.id }, // new
        ],
      }),
    });
    expect(patchRes.status).toBe(200);

    const metas = await adapter.findMany(postMeta, {
      where: (cols: any, { eq }: any) => eq(cols.postId, postId),
    });
    expect(metas.length).toBe(2);
    expect((metas.find((m: any) => m.metaKey === "color") as any)?.metaValue).toBe("red");

    // 4. Test strategy: "append" on PATCH inside syncRelations (lines 354-356)
    const appendResource = app.defineResource({
      name: "posts_append",
      table: posts,
      validator: z.any(),
      relations: {
        many: [
          {
            name: "comments",
            table: comments,
            foreignKey: "postId",
            referenceKey: "id",
            strategy: "append",
          },
        ],
      },
    });

    const appendPost: any = await adapter.insert(posts, { title: "Append Post" });
    await adapter.insert(comments, { postId: appendPost.id, author: "A1", content: "C1" });

    const patchAppendRes = await appendResource.request(`/${appendPost.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Append Post Updated",
        comments: [{ author: "A2", content: "C2" }],
      }),
    });
    expect(patchAppendRes.status).toBe(200);

    const allComments = await adapter.findMany(comments, {
      where: (cols: any, { eq }: any) => eq(cols.postId, appendPost.id),
    });
    expect(allComments.length).toBe(2);
  });

  it("covers import under strategy: 'none' for creates, updates, and OCC failure", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter, strategy: "none" }); // Exercises non-batch import lines 1623-1643 and 1721-1743

    const tag1: any = await adapter.insert(tags, { name: "NoneTag1" });
    const tag2: any = await adapter.insert(tags, { name: "NoneTag2" });

    // Seed existing post with version 1
    await adapter.insert(posts, {
      title: "Existing None Post",
      slug: "none-post-1",
      version: 1,
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      methods: ["import-execute"],
      versionControl: { field: "version" },
      import: { lookupBy: "slug", maxRowsPerRequest: 10 },
      relations: {
        many: [
          {
            name: "comments",
            table: comments,
            foreignKey: "postId",
            referenceKey: "id",
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
        version: z.number().optional(),
      }),
    });

    // 1. Create new record with relations and update existing record with relations under strategy: "none"
    const payload = [
      // Create with many and pivot (lines 1623-1643)
      {
        title: "Created in None Strategy",
        slug: "none-created-1",
        version: 1,
        comments: [{ author: "AuthorNone", content: "ContentNone" }],
        tags: [{ tagId: tag1.id }],
      },
      // Update existing with many and pivot (lines 1721-1743)
      {
        title: "Updated in None Strategy",
        slug: "none-post-1",
        version: 1,
        comments: [{ author: "AuthorNone2", content: "ContentNone2" }],
        tags: [{ tagId: tag2.id }],
      },
    ];

    const res = await postsResource.request("/import/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results.creates.length).toBe(1);
    expect(json.results.updates.length).toBe(1);

    // 2. OCC Failure in non-batch import throws 409 OCC_FAILED (line 1724)
    const occStaleRes = await postsResource.request("/import/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        {
          title: "Stale OCC None",
          slug: "none-post-1",
          version: 1, // now at version 2, so version 1 fails
        },
      ]),
    });
    expect(occStaleRes.status).toBe(409);
    const occJson = await occStaleRes.json();
    expect(occJson.error.code).toBe("OCC_FAILED");
  });

  it("covers finalize null relation and processUploads with primitives", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    // 1. Finalize null: record with null author queried with with: { author: true } (line 204)
    const orphanPost: any = await adapter.insert(posts, { title: "Orphan Post", authorId: null });
    const postsResource = app.defineResource({
      name: "posts",
      queryKey: "posts",
      table: posts,
      with: { author: true },
      relations: {
        one: [
          {
            name: "author",
            table: users,
            foreignKey: "authorId",
            referenceKey: "id",
          },
        ],
      },
      validator: z.any(),
    });

    const res = await postsResource.request(`/${orphanPost.id}`, { method: "GET" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.author).toBeNull();

    // 2. processUploads with null and primitive non-recursable data (lines 459, 469)
    await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "null",
    });
    await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "123",
    });
  });

  it("covers import with relations updates in batch mode and timestamps", async () => {
    const { adapter } = await createTestDb();
    const app = createApp<{ Bindings: Record<string, unknown> }, { tenantId: string }>({
      adapter,
      getContext: () => ({ tenantId: "t-import" }),
    });

    const tag1: any = await adapter.insert(tags, { name: "BatchTag" });

    // Seed existing post with tenantId
    const initialPost: any = await adapter.insert(posts, {
      title: "Initial Batch Import",
      slug: "import-rel-slug",
      tenantId: "t-import",
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      timestamps: true,
      scope: (cols, { eq }, ctx) => eq(cols.tenantId, ctx.tenantId),
      methods: ["import-execute"],
      import: {
        lookupBy: "slug",
        maxRowsPerRequest: 10,
      },
      relations: {
        many: [
          {
            name: "comments",
            table: comments,
            foreignKey: "postId",
            referenceKey: "id",
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
        title: z.string().optional(),
        slug: z.string(),
        tenantId: z.string().optional(),
      }),
    });

    // 1. Update existing post with new comments and tags (lines 1703-1718, and line 1688 for scoped update)
    // 2. Unchanged row with relations (line 1653)
    // 3. Create new post with timestamps (lines 1579-1580)
    // 4. Row with undefined lookup key (line 1473)
    const payload = [
      {
        title: "Initial Batch Import", // unchanged scalar title
        slug: "import-rel-slug",
        tenantId: "t-import",
        comments: [{ author: "ImportUser", content: "Imported Rel Comment" }], // hasRelations === true (line 1653)
        tags: [{ tagId: tag1.id }],
      },
      {
        title: "New Created Row",
        slug: "new-rel-slug",
        tenantId: "t-import",
      },
      {
        title: "Missing Slug Row",
      },
    ];

    const res = await postsResource.request("/import/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    const resultJson = await res.json();
    expect(resultJson.results.updates.length).toBe(1);
    expect(resultJson.results.creates.length).toBe(1);

    // Verify child comment was inserted for the updated post
    const childComments = await adapter.findMany(comments, {
      where: (cols: any, { eq }: any) => eq(cols.postId, initialPost.id),
    });
    expect(childComments.length).toBe(1);
  });
});
