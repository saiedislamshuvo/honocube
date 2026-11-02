import { describe, it, expect } from "vitest";
import { hc } from "hono/client";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts, users } from "../fixtures/db.js";

describe("End-to-End Type Safety with Hono hc RPC Client", () => {
  it("provides full compile-time and runtime type safety with unversioned defineApi", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        content: z.string().optional(),
      }),
    });

    const usersResource = app.defineResource({
      name: "users",
      table: users,
      validator: z.object({
        name: z.string(),
        email: z.string().email(),
      }),
    });

    const api = app.defineApi({
      posts: postsResource,
      users: usersResource,
    });

    type ApiType = typeof api;

    // Initialize hc client with api.request
    const client = hc<ApiType>("http://localhost", {
      fetch: api.request.bind(api) as any,
    });

    // 1. Create a post (type checked input)
    const createRes = await client.posts.$post({
      json: { title: "First Type-Safe Post", content: "Hello world" },
    });
    expect(createRes.status).toBe(201);
    const createdJson = await createRes.json();
    expect(createdJson.success).toBe(true);
    expect(createdJson.data.title).toBe("First Type-Safe Post");

    // Inferred return type check:
    const createdTitle: string = createdJson.data.title;
    expect(createdTitle).toBe("First Type-Safe Post");

    // 2. List posts (type checked query parameters)
    const listRes = await client.posts.$get({
      query: { limit: "10" },
    });
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    expect(listJson.success).toBe(true);
    expect(listJson.data.length).toBe(1);

    // Inferred return type check:
    const fetchedId: number = listJson.data[0].id;
    expect(fetchedId).toBe(createdJson.data.id);

    // 3. Detail post by ID
    const detailRes = await client.posts[":id"].$get({
      param: { id: String(createdJson.data.id) },
    });
    expect(detailRes.status).toBe(200);
    const detailJson = await detailRes.json();
    expect(detailJson.success).toBe(true);
    expect(detailJson.data.id).toBe(createdJson.data.id);

    // 4. Update post by ID
    const updateRes = await client.posts[":id"].$patch({
      param: { id: String(createdJson.data.id) },
      json: { title: "Updated Title" },
    });
    expect(updateRes.status).toBe(200);
    const updateJson = await updateRes.json();
    expect(updateJson.data.title).toBe("Updated Title");

    // 5. Create and list users on second resource
    const userRes = await client.users.$post({
      json: { name: "Alice", email: "alice@example.com" },
    });
    expect(userRes.status).toBe(201);
    const userJson = await userRes.json();
    expect(userJson.data.name).toBe("Alice");

    // 6. Delete post
    const deleteRes = await client.posts[":id"].$delete({
      param: { id: String(createdJson.data.id) },
    });
    expect(deleteRes.status).toBe(200);

    // Type assertion & negative compile tests:
    const typeAssert = () => {
      // @ts-expect-error nonExistentResource does not exist on ApiType
      return client.nonExistentResource;
    };
    const badBodyAssert = () => {
      // @ts-expect-error title must be string, not number
      return client.posts.$post({ json: { title: 12345 } });
    };
    expect(typeAssert).toBeDefined();
    expect(badBodyAssert).toBeDefined();
  });

  it("provides full compile-time and runtime type safety with versioned defineApi string prefix", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
    });

    const v1Api = app.defineApi(
      { posts: postsResource },
      "v1"
    );

    type V1ApiType = typeof v1Api;

    const client = hc<V1ApiType>("http://localhost", {
      fetch: v1Api.request.bind(v1Api) as any,
    });

    const createRes = await client.v1.posts.$post({
      json: { title: "Versioned Post" },
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.data.title).toBe("Versioned Post");

    const listRes = await client.v1.posts.$get();
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.data.length).toBe(1);

    const unversionedAssert = () => {
      // @ts-expect-error unversioned client.posts does not exist on v1 API
      return client.posts.$get();
    };
    expect(unversionedAssert).toBeDefined();
  });

  it("provides full compile-time and runtime type safety with versioned options object", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
    });

    const v2Api = app.defineApi(
      { posts: postsResource },
      { version: "v2", docs: true }
    );

    type V2ApiType = typeof v2Api;

    const client = hc<V2ApiType>("http://localhost", {
      fetch: v2Api.request.bind(v2Api) as any,
    });

    const res = await client.v2.posts.$post({
      json: { title: "V2 Options Post" },
    });
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.data.title).toBe("V2 Options Post");
  });
});
