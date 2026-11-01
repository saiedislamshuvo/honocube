import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { generateOpenApiSpec } from "../../src/utils/openapi.js";
import { createTestDb, posts, users } from "../fixtures/db.js";

describe("OpenAPI 3.1 & Interactive Scalar Documentation Engine", () => {
  it("serves OpenAPI 3.1 JSON at /openapi.json with complete resource paths and schemas", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        price: z.number().optional(),
      }),
      pagination: { type: "both" },
      search: { fields: ["title", "content"] },
      filter: { allow: ["status", "price"] },
      idempotency: { enabled: true },
      rateLimit: { limit: 10, window: "1m" },
      aggregate: { enabled: true },
    });

    const api = app.defineApi(
      { posts: postsResource },
      {
        docs: {
          title: "Blog API",
          version: "2.0.2",
          description: "Enterprise Blog API Services",
        },
      }
    );

    // Request the OpenAPI specification
    const specRes = await api.request("/openapi.json");
    expect(specRes.status).toBe(200);
    expect(specRes.headers.get("content-type")).toContain("application/json");

    const spec = await specRes.json();
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toBe("Blog API");
    expect(spec.info.version).toBe("2.0.2");
    expect(spec.info.description).toBe("Enterprise Blog API Services");

    // Check paths
    expect(spec.paths["/posts"]).toBeDefined();
    expect(spec.paths["/posts"].get).toBeDefined();
    expect(spec.paths["/posts"].post).toBeDefined();
    expect(spec.paths["/posts/{id}"]).toBeDefined();
    expect(spec.paths["/posts/{id}"].get).toBeDefined();
    expect(spec.paths["/posts/{id}"].patch).toBeDefined();
    expect(spec.paths["/posts/{id}"].delete).toBeDefined();
    expect(spec.paths["/posts/aggregate"]).toBeDefined();
    expect(spec.paths["/posts/batch-update"]).toBeDefined();
    expect(spec.paths["/posts/batch-delete"]).toBeDefined();

    // Check components
    expect(spec.components.schemas.Post).toBeDefined();
    expect(spec.components.schemas.PostCreate).toBeDefined();
    expect(spec.components.schemas.PostUpdate).toBeDefined();
    expect(spec.components.schemas.PaginationMeta).toBeDefined();
    expect(spec.components.schemas.ErrorEnvelope).toBeDefined();

    // Check query parameters on GET /posts
    const getParams = spec.paths["/posts"].get.parameters;
    expect(getParams.some((p: any) => p.name === "limit")).toBe(true);
    expect(getParams.some((p: any) => p.name === "cursor")).toBe(true);
    expect(getParams.some((p: any) => p.name === "page")).toBe(true);
    expect(getParams.some((p: any) => p.name === "q")).toBe(true);
    expect(getParams.some((p: any) => p.name === "status")).toBe(true);
    expect(getParams.some((p: any) => p.name === "price")).toBe(true);

    // Check Idempotency header on POST /posts
    const postParams = spec.paths["/posts"].post.parameters;
    expect(postParams.some((p: any) => p.name === "Idempotency-Key" && p.in === "header")).toBe(true);
  });

  it("serves interactive Scalar documentation HTML at /docs", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
    });

    const api = app.defineApi(
      { posts: postsResource },
      { docs: { title: "Documentation Explorer" } }
    );

    const docsRes = await api.request("/docs");
    expect(docsRes.status).toBe(200);
    expect(docsRes.headers.get("content-type")).toContain("text/html");

    const html = await docsRes.text();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>Documentation Explorer</title>");
    expect(html).toContain('data-url="/openapi.json"');
    expect(html).toContain("https://cdn.jsdelivr.net/npm/@scalar/api-reference");
  });

  it("supports versioned APIs and mounts spec correctly under version prefix", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
    });

    const versionedApi = app.defineApi(
      { posts: postsResource },
      {
        version: "v1",
        docs: {
          path: "/docs",
          specPath: "/openapi.json",
        },
      }
    );

    // Verify /v1/openapi.json
    const specRes = await versionedApi.request("/v1/openapi.json");
    expect(specRes.status).toBe(200);
    const spec = await specRes.json();
    expect(spec.paths["/posts"]).toBeDefined();

    // Verify /v1/docs points to /v1/openapi.json
    const docsRes = await versionedApi.request("/v1/docs");
    expect(docsRes.status).toBe(200);
    const html = await docsRes.text();
    expect(html).toContain('data-url="/v1/openapi.json"');
  });

  it("supports custom specUrl pointing to an external CDN without runtime generation", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
    });

    const cdnUrl = "https://cdn.mycompany.com/specs/v2.0.2/openapi.json";
    const api = app.defineApi(
      { posts: postsResource },
      {
        docs: {
          specUrl: cdnUrl,
        },
      }
    );

    const docsRes = await api.request("/docs");
    expect(docsRes.status).toBe(200);
    const html = await docsRes.text();
    expect(html).toContain(`data-url="${cdnUrl}"`);
  });

  it("supports standalone static export via generateOpenApiSpec for CI/CD pipelines", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
    });

    const usersResource = app.defineResource({
      name: "users",
      table: users,
      validator: z.object({ name: z.string(), email: z.string().email() }),
    });

    const spec = generateOpenApiSpec(
      { posts: postsResource, users: usersResource },
      {
        title: "Exported API",
        version: "2.0.2",
        include: ["posts"], // Only include posts
      }
    );

    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toBe("Exported API");
    expect(spec.paths["/posts"]).toBeDefined();
    expect(spec.paths["/users"]).toBeUndefined(); // Excluded
  });

  it("does not mount docs when docs is disabled or omitted", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
    });

    // Docs omitted
    const api = app.defineApi({ posts: postsResource });
    const resDocs = await api.request("/docs");
    expect(resDocs.status).toBe(404);

    // Docs explicitly disabled
    const apiDisabled = app.defineApi(
      { posts: postsResource },
      { docs: { enabled: false } }
    );
    const resDisabled = await apiDisabled.request("/docs");
    expect(resDisabled.status).toBe(404);
  });

  it("supports docs: true boolean shorthand option", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
    });

    const api = app.defineApi(
      { posts: postsResource },
      { docs: true }
    );

    const docsRes = await api.request("/docs");
    expect(docsRes.status).toBe(200);

    const specRes = await api.request("/openapi.json");
    expect(specRes.status).toBe(200);
    const spec = await specRes.json();
    expect(spec.info.title).toBe("HonoCube API");
  });

  it("respects restricted resource methods in OpenAPI paths (e.g. read-only list/detail)", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      methods: ["list", "detail"], // read-only
      validator: z.object({ title: z.string() }),
    });

    const api = app.defineApi(
      { posts: postsResource },
      { docs: true }
    );

    const specRes = await api.request("/openapi.json");
    const spec = await specRes.json();

    expect(spec.paths["/posts"]).toBeDefined();
    expect(spec.paths["/posts"].get).toBeDefined();
    expect(spec.paths["/posts"].post).toBeUndefined(); // POST omitted

    expect(spec.paths["/posts/{id}"]).toBeDefined();
    expect(spec.paths["/posts/{id}"].get).toBeDefined();
    expect(spec.paths["/posts/{id}"].patch).toBeUndefined(); // PATCH omitted
    expect(spec.paths["/posts/{id}"].delete).toBeUndefined(); // DELETE omitted

    expect(spec.paths["/posts/aggregate"]).toBeUndefined();
    expect(spec.paths["/posts/batch-update"]).toBeUndefined();
    expect(spec.paths["/posts/batch-delete"]).toBeUndefined();
  });

  it("handles separate create/update validators and array of validators in schema components", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    // Object shape validator: { create, update }
    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: {
        create: z.object({ title: z.string() }),
        update: z.object({ title: z.string().optional() }),
      },
    });

    // Array shape validator: [create, update]
    const usersResource = app.defineResource({
      name: "users",
      table: users,
      validator: [
        z.object({ name: z.string(), email: z.string().email() }),
        z.object({ name: z.string().optional() }),
      ],
    });

    const spec = generateOpenApiSpec({ posts: postsResource, users: usersResource });

    expect(spec.components.schemas.PostCreate).toBeDefined();
    expect(spec.components.schemas.PostUpdate).toBeDefined();
    expect(spec.components.schemas.UserCreate).toBeDefined();
    expect(spec.components.schemas.UserUpdate).toBeDefined();
  });

  it("respects pagination.type: 'cursor' vs 'offset' in list query parameters", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const cursorResource = app.defineResource({
      name: "posts",
      table: posts,
      pagination: { type: "cursor" },
    });

    const offsetResource = app.defineResource({
      name: "users",
      table: users,
      pagination: { type: "offset" },
    });

    const spec = generateOpenApiSpec({ posts: cursorResource, users: offsetResource });

    // Cursor only: has cursor/after/before, does not have page
    const cursorParams = spec.paths["/posts"].get.parameters;
    expect(cursorParams.some((p: any) => p.name === "cursor")).toBe(true);
    expect(cursorParams.some((p: any) => p.name === "page")).toBe(false);

    // Offset only: has page, does not have cursor
    const offsetParams = spec.paths["/users"].get.parameters;
    expect(offsetParams.some((p: any) => p.name === "page")).toBe(true);
    expect(offsetParams.some((p: any) => p.name === "cursor")).toBe(false);
  });
});
