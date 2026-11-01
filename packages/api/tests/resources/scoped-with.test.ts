import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import {
  createTestDb,
  users,
  posts,
  comments,
} from "../fixtures/db.js";

describe("Granular Relation Loading (Scoped 'with')", () => {
  it("preserves uniform with: { ... } for list, detail, and slug (backward compatibility)", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const user: any = await adapter.insert(users, {
      name: "Alice",
      email: "alice@example.com",
    });

    const postsResource = defineResource({
      name: "posts",
      queryKey: "posts",
      table: posts,
      slugs: ["slug"],
      validator: z.object({
        title: z.string(),
        slug: z.string().optional(),
        authorId: z.number().optional(),
      }),
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
      // Uniform with
      with: {
        author: true,
      },
    });

    const post: any = await adapter.insert(posts, {
      title: "Uniform Post",
      slug: "uniform-post",
      authorId: user.id,
    });

    // 1. List has author
    const listRes = await postsResource.request("/", { method: "GET" });
    const listData = await listRes.json();
    expect(listData.data[0].author).toBeDefined();
    expect(listData.data[0].author.name).toBe("Alice");

    // 2. Detail has author
    const detailRes = await postsResource.request(`/${post.id}`, { method: "GET" });
    const detailData = await detailRes.json();
    expect(detailData.data.author).toBeDefined();
    expect(detailData.data.author.name).toBe("Alice");

    // 3. Slug has author
    const slugRes = await postsResource.request(`/slug/uniform-post`, { method: "GET" });
    const slugData = await slugRes.json();
    expect(slugData.data.author).toBeDefined();
    expect(slugData.data.author.name).toBe("Alice");
  });

  it("disables relations on list (list: false) while loading relations on detail", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const user: any = await adapter.insert(users, {
      name: "Bob",
      email: "bob@example.com",
    });

    const postsResource = defineResource({
      name: "posts",
      queryKey: "posts",
      table: posts,
      slugs: ["slug"],
      validator: z.object({
        title: z.string(),
        slug: z.string().optional(),
        authorId: z.number().optional(),
      }),
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
      // Scoped: list is false, detail has author
      with: {
        list: false,
        detail: {
          author: true,
        },
      },
    });

    const post: any = await adapter.insert(posts, {
      title: "Scoped List Off Post",
      slug: "scoped-list-off",
      authorId: user.id,
    });

    // 1. List does NOT have author relation
    const listRes = await postsResource.request("/", { method: "GET" });
    const listData = await listRes.json();
    expect(listData.data[0].author).toBeUndefined();

    // 2. Detail DOES have author relation
    const detailRes = await postsResource.request(`/${post.id}`, { method: "GET" });
    const detailData = await detailRes.json();
    expect(detailData.data.author).toBeDefined();
    expect(detailData.data.author.name).toBe("Bob");

    // 3. Slug falls back to detail -> has author relation
    const slugRes = await postsResource.request(`/slug/scoped-list-off`, { method: "GET" });
    const slugData = await slugRes.json();
    expect(slugData.data.author).toBeDefined();
    expect(slugData.data.author.name).toBe("Bob");
  });

  it("supports independent granular relations for list, detail, and slug", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const user: any = await adapter.insert(users, {
      name: "Charlie",
      email: "charlie@example.com",
    });

    const postsResource = defineResource({
      name: "posts",
      queryKey: "posts",
      table: posts,
      slugs: ["slug"],
      validator: z.object({
        title: z.string(),
        slug: z.string().optional(),
        authorId: z.number().optional(),
      }),
      relations: {
        one: [
          {
            name: "author",
            table: users,
            foreignKey: "authorId",
            referenceKey: "id",
          },
        ],
        many: [
          {
            name: "comments",
            table: comments,
            foreignKey: "postId",
            referenceKey: "id",
          },
        ],
      },
      // Granular:
      // - list: only author
      // - detail: both author and comments
      // - slug: only comments
      with: {
        list: {
          author: true,
        },
        detail: {
          author: true,
          comments: true,
        },
        slug: {
          comments: true,
        },
      },
    });

    const post: any = await adapter.insert(posts, {
      title: "Granular Relations Post",
      slug: "granular-post",
      authorId: user.id,
    });

    await adapter.insert(comments, {
      postId: post.id,
      author: "Dave",
      content: "Great post!",
    });

    // 1. List: has author, but NOT comments
    const listRes = await postsResource.request("/", { method: "GET" });
    const listData = await listRes.json();
    expect(listData.data[0].author).toBeDefined();
    expect(listData.data[0].author.name).toBe("Charlie");
    expect(listData.data[0].comments).toBeUndefined();

    // 2. Detail: has BOTH author and comments
    const detailRes = await postsResource.request(`/${post.id}`, { method: "GET" });
    const detailData = await detailRes.json();
    expect(detailData.data.author).toBeDefined();
    expect(detailData.data.author.name).toBe("Charlie");
    expect(detailData.data.comments).toBeDefined();
    expect(detailData.data.comments.length).toBe(1);
    expect(detailData.data.comments[0].content).toBe("Great post!");

    // 3. Slug: has comments, but NOT author
    const slugRes = await postsResource.request(`/slug/granular-post`, { method: "GET" });
    const slugData = await slugRes.json();
    expect(slugData.data.comments).toBeDefined();
    expect(slugData.data.comments.length).toBe(1);
    expect(slugData.data.author).toBeUndefined();
  });

  it("supports explicit slug: false to disable relations on slug queries", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const user: any = await adapter.insert(users, {
      name: "Eve",
      email: "eve@example.com",
    });

    const postsResource = defineResource({
      name: "posts",
      queryKey: "posts",
      table: posts,
      slugs: ["slug"],
      validator: z.object({
        title: z.string(),
        slug: z.string().optional(),
        authorId: z.number().optional(),
      }),
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
      // Detail has author, but slug is explicitly disabled
      with: {
        list: false,
        detail: {
          author: true,
        },
        slug: false,
      },
    });

    const post: any = await adapter.insert(posts, {
      title: "Slug False Post",
      slug: "slug-false",
      authorId: user.id,
    });

    // Detail has author
    const detailRes = await postsResource.request(`/${post.id}`, { method: "GET" });
    const detailData = await detailRes.json();
    expect(detailData.data.author).toBeDefined();

    // Slug has NO relations
    const slugRes = await postsResource.request(`/slug/slug-false`, { method: "GET" });
    const slugData = await slugRes.json();
    expect(slugData.data.author).toBeUndefined();
  });

  it("reloads created and updated records using detail relations", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const user: any = await adapter.insert(users, {
      name: "Frank",
      email: "frank@example.com",
    });

    const postsResource = defineResource({
      name: "posts",
      queryKey: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        authorId: z.number().optional(),
      }),
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
      // List has no relations; detail has author
      with: {
        list: false,
        detail: {
          author: true,
        },
      },
    });

    // POST / creates record and returns with detail relations
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Created Post With Reload",
        authorId: user.id,
      }),
    });
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    expect(createData.data.author).toBeDefined();
    expect(createData.data.author.name).toBe("Frank");

    // PATCH /:id updates record and returns with detail relations
    const updateRes = await postsResource.request(`/${createData.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Updated Title",
      }),
    });
    expect(updateRes.status).toBe(200);
    const updateData = await updateRes.json();
    expect(updateData.data.title).toBe("Updated Title");
    expect(updateData.data.author).toBeDefined();
    expect(updateData.data.author.name).toBe("Frank");
  });
});
