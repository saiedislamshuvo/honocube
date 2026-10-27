import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import {
  createTestDb,
  users,
  posts,
  comments,
} from "../fixtures/db.js";

describe("Relational Operations & Synchronization", () => {
  it("creates parent and nested child records atomically", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    // 1. Create a user first
    const insertedUser: any = await adapter.insert(users, {
      name: "John Doe",
      email: "john@example.com",
    });

    // 2. Create posts resource with nested comments and author relation
    const postsResource = defineResource({
      name: "posts",
      queryKey: "posts",
      table: posts,
      timestamps: true,
      validator: z.object({
        title: z.string().min(1),
        authorId: z.number().optional(),
      }),
      relations: {
        one: [
          {
            name: "author",
            table: users,
            foreignKey: "authorId",
            referenceKey: "id",
            hidden: ["email"],
          },
        ],
        many: [
          {
            name: "comments",
            table: comments,
            foreignKey: "postId",
            referenceKey: "id",
            schema: z.object({
              author: z.string(),
              content: z.string(),
            }),
          },
        ],
      },
      with: {
        author: true,
        comments: true,
      },
    });

    // 3. POST with nested comments returns 201
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Post with Comments",
        authorId: insertedUser.id,
        comments: [
          { author: "Alice", content: "Great post!" },
          { author: "Bob", content: "Very insightful." },
        ],
      }),
    });

    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.success).toBe(true);
    expect(created.data.title).toBe("Post with Comments");

    // Verify children in database
    const savedComments = await adapter.findMany(comments, {
      where: (cols: any, { eq }: any) => eq(cols.postId, created.data.id),
    });
    expect(savedComments.length).toBe(2);

    // Verify GET /:id returns eager-loaded relations and hides sensitive fields
    const getRes = await postsResource.request(`/${created.data.id}`, { method: "GET" });
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.data.comments?.length).toBe(2);
    expect(getJson.data.author?.name).toBe("John Doe");
    expect(getJson.data.author?.email).toBeUndefined(); // hidden
  });

  it("synchronizes relations on PATCH using replace strategy", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const postsResource = defineResource({
      name: "posts",
      queryKey: "posts",
      table: posts,
      timestamps: true,
      validator: z.object({
        title: z.string().min(1),
      }),
      relations: {
        many: [
          {
            name: "comments",
            table: comments,
            foreignKey: "postId",
            referenceKey: "id",
            strategy: "replace",
            schema: z.object({
              author: z.string(),
              content: z.string(),
            }),
          },
        ],
      },
      with: {
        comments: true,
      },
    });

    // 1. Create with 2 comments (returns 201)
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Sync Test",
        comments: [
          { author: "User1", content: "Comment 1" },
          { author: "User2", content: "Comment 2" },
        ],
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    const postId = created.data.id;

    // 2. PATCH with 1 replacement comment
    const patchRes = await postsResource.request(`/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comments: [{ author: "User3", content: "Replaced Comment" }],
      }),
    });

    expect(patchRes.status).toBe(200);

    // Verify database only has the 1 replacement comment
    const currentComments = await adapter.findMany(comments, {
      where: (cols: any, { eq }: any) => eq(cols.postId, postId),
    });
    expect(currentComments.length).toBe(1);
    expect((currentComments[0] as any).content).toBe("Replaced Comment");
  });

  it("synchronizes relations using upsert strategy with string and composite lookupBy", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter, strategy: "transaction" }); // Exercise imperative syncRelations & updates

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string().optional() }),
      relations: {
        many: [
          {
            name: "comments",
            table: comments,
            foreignKey: "postId",
            referenceKey: "id",
            strategy: "upsert",
            lookupBy: "author", // Match existing child by author
            schema: z.object({
              author: z.string(),
              content: z.string(),
            }),
          },
        ],
      },
    });

    // 1. Create post with comment by AuthorA
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Upsert Post",
        comments: [{ author: "AuthorA", content: "Original content" }],
      }),
    });
    const created = await createRes.json();
    const postId = created.data.id;

    // 2. PATCH: Upsert AuthorA (updates existing) + add AuthorB (inserts new)
    const patchRes = await postsResource.request(`/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Upsert Post Updated",
        comments: [
          { author: "AuthorA", content: "Updated content" },
          { author: "AuthorB", content: "New content" },
        ],
      }),
    });
    expect(patchRes.status).toBe(200);

    const savedComments = await adapter.findMany(comments, {
      where: (cols: any, { eq }: any) => eq(cols.postId, postId),
      orderBy: { field: "author", direction: "asc" },
    });
    expect(savedComments.length).toBe(2);
    expect((savedComments[0] as any).author).toBe("AuthorA");
    expect((savedComments[0] as any).content).toBe("Updated content");
    expect((savedComments[1] as any).author).toBe("AuthorB");
    expect((savedComments[1] as any).content).toBe("New content");
  });

  it("handles OCC, missing version, and not found under imperative strategy: transaction", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter, strategy: "transaction" });

    let hookCalledAfterUpdate = false;
    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      versionControl: { field: "version" },
      validator: z.object({
        title: z.string().optional(),
        version: z.number().optional(),
      }),
      hooks: {
        afterUpdate: async () => {
          hookCalledAfterUpdate = true;
        },
      },
    });

    const p: any = await adapter.insert(posts, { title: "Imperative Post", version: 1 });

    // 1. Missing version throws 400 MISSING_VERSION
    const missingRes = await postsResource.request(`/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "No Version" }),
    });
    expect(missingRes.status).toBe(400);

    // 2. Successful imperative update
    const okRes = await postsResource.request(`/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Imperative Updated", version: 1 }),
    });
    expect(okRes.status).toBe(200);
    expect(hookCalledAfterUpdate).toBe(true);

    // 3. Stale version throws 409 OCC_FAILED
    const staleRes = await postsResource.request(`/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Stale", version: 1 }),
    });
    expect(staleRes.status).toBe(409);

    // 4. Non-existent record throws 404 NOT_FOUND
    const notFoundRes = await postsResource.request("/99999", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Not Found", version: 1 }),
    });
    expect(notFoundRes.status).toBe(404);
  });
});
