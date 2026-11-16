import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts, users } from "../fixtures/db.js";

describe("Declarative Import Engine: Template Generation & Foreign Key Resolution", () => {
  it("generates CSV and JSON templates via GET /import/template", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      methods: ["list", "create", "import-preview", "import-execute", "import-template"],
      import: {
        lookupBy: "slug",
        templateSample: {
          title: "My Sample Title",
          slug: "sample-slug",
        },
      },
      relations: {
        one: [
          { name: "author", table: users, foreignKey: "authorId", referenceKey: "id" },
        ],
      },
      validator: z.object({
        title: z.string(),
        slug: z.string(),
        authorId: z.number().optional(),
      }),
    });

    // 1. Download CSV template
    const csvRes = await postsResource.request("/import/template", {
      method: "GET",
    });

    expect(csvRes.status).toBe(200);
    expect(csvRes.headers.get("content-type")).toContain("text/csv");
    expect(csvRes.headers.get("content-disposition")).toContain('attachment; filename="posts-template.csv"');

    const csvText = await csvRes.text();
    expect(csvText).toContain("title");
    expect(csvText).toContain("slug");
    expect(csvText).toContain("author"); // Mapped friendly relation header
    expect(csvText).toContain("My Sample Title");

    // 2. Fetch JSON template schema
    const jsonRes = await postsResource.request("/import/template?format=json", {
      method: "GET",
    });

    expect(jsonRes.status).toBe(200);
    const jsonData = await jsonRes.json();
    expect(jsonData.fields).toBeDefined();
    expect(jsonData.fields).toContain("title");
    expect(jsonData.fields).toContain("slug");
    expect(jsonData.fields).toContain("author");
    expect(jsonData.sample.title).toBe("My Sample Title");
  });

  it("resolves foreign keys in POST /import/preview and POST /import/execute via relations.one", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    // Seed users
    const alice: any = await adapter.insert(users, { name: "Alice Smith", email: "alice@example.com" });
    const bob: any = await adapter.insert(users, { name: "Bob Jones", email: "bob@example.com" });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      methods: ["list", "create", "import-preview", "import-execute"],
      import: {
        lookupBy: "slug",
      },
      relations: {
        one: [
          { name: "author", table: users, foreignKey: "authorId", referenceKey: "id" },
        ],
      },
      validator: z.object({
        title: z.string(),
        slug: z.string(),
        authorId: z.number().optional(),
      }),
    });

    // 1. Dry run preview with valid and invalid foreign keys
    const previewPayload = [
      { title: "Alice's Post", slug: "alices-post", author: "Alice Smith" },
      { title: "Bob's Post", slug: "bobs-post", author: "Bob Jones" },
      { title: "Unknown Post", slug: "unknown-post", author: "Nonexistent Author" },
    ];

    const previewRes = await postsResource.request("/import/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(previewPayload),
    });

    expect(previewRes.status).toBe(200);
    const previewJson = await previewRes.json();
    expect(previewJson.results.creates.length).toBe(2);
    expect(previewJson.results.creates[0].authorId).toBe(alice.id);
    expect(previewJson.results.creates[1].authorId).toBe(bob.id);
    expect(previewJson.results.errors.length).toBe(1);
    expect(previewJson.results.errors[0].index).toBe(2);
    expect(previewJson.results.errors[0].error).toContain("Foreign key resolution failed");

    // 2. Execute import
    const execPayload = [
      { title: "Alice Final", slug: "alices-final", author: "Alice Smith" },
    ];

    const execRes = await postsResource.request("/import/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(execPayload),
    });

    expect(execRes.status).toBe(200);
    const execJson = await execRes.json();
    expect(execJson.results.creates.length).toBe(1);

    const savedInDb: any = await adapter.findFirst(posts, {
      where: (cols: any, { eq }: any) => eq(cols.slug, "alices-final"),
    });
    expect(savedInDb).toBeDefined();
    expect(savedInDb.authorId).toBe(alice.id);
  });

  it("supports explicit foreign key resolution rules via config.import.foreignKeys", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    // Seed user with email or name
    const charlie: any = await adapter.insert(users, { name: "Charlie Brown", email: "charlie@example.com" });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      methods: ["import-execute"],
      import: {
        lookupBy: "slug",
        foreignKeys: {
          authorName: {
            table: users,
            lookupField: "name",
            referenceKey: "id",
            targetField: "authorId",
          },
        },
      },
      validator: z.object({
        title: z.string(),
        slug: z.string(),
        authorId: z.number().optional(),
      }),
    });

    const res = await postsResource.request("/import/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { title: "Charlie's Article", slug: "charlies-article", authorName: "Charlie Brown" },
        { title: "Charlie's Second", slug: "charlies-second", authorId: "Charlie Brown" },
      ]),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results.creates.length).toBe(2);

    const saved: any = await adapter.findFirst(posts, {
      where: (cols: any, { eq }: any) => eq(cols.slug, "charlies-article"),
    });
    expect(saved.authorId).toBe(charlie.id);

    const savedSecond: any = await adapter.findFirst(posts, {
      where: (cols: any, { eq }: any) => eq(cols.slug, "charlies-second"),
    });
    expect(savedSecond.authorId).toBe(charlie.id);
  });
});
