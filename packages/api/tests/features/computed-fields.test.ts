import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, users, posts } from "../fixtures/db.js";

describe("Declarative Computed & Virtual Fields Engine", () => {
  it("computes synchronous and asynchronous virtual fields on list and detail", async () => {
    const { adapter } = await createTestDb();

    const app = createApp({ adapter });

    const usersResource = app.defineResource({
      name: "users",
      table: users,
      validator: z.object({
        name: z.string(),
        email: z.string().email(),
      }),
      computed: {
        upperName: (user) => user.name.toUpperCase(),
        emailDomain: async (user) => {
          const parts = user.email.split("@");
          return parts[1] ?? "";
        },
      },
    });

    // 1. Create a user
    const createRes = await usersResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice Smith", email: "alice@example.com" }),
    });

    expect(createRes.status).toBe(201);
    const created: any = await createRes.json();
    expect(created.data.upperName).toBe("ALICE SMITH");
    expect(created.data.emailDomain).toBe("example.com");

    const userId = created.data.id;

    // 2. Fetch list (GET /)
    const listRes = await usersResource.request("/", { method: "GET" });
    expect(listRes.status).toBe(200);
    const listBody: any = await listRes.json();
    expect(listBody.data[0].upperName).toBe("ALICE SMITH");
    expect(listBody.data[0].emailDomain).toBe("example.com");

    // 3. Fetch detail (GET /:id)
    const detailRes = await usersResource.request(`/${userId}`, { method: "GET" });
    expect(detailRes.status).toBe(200);
    const detailBody: any = await detailRes.json();
    expect(detailBody.data.upperName).toBe("ALICE SMITH");
    expect(detailBody.data.emailDomain).toBe("example.com");
  });

  it("provides access to Hono Context and Application Context inside resolvers", async () => {
    const { adapter } = await createTestDb();

    // Insert authors to satisfy foreign key constraints
    await adapter.insert(users, { id: 42, name: "User 42", email: "u42@test.com" });
    await adapter.insert(users, { id: 99, name: "User 99", email: "u99@test.com" });

    const app = createApp<{ Bindings: Record<string, unknown> }, { currentUser: { id: number; role: string } }>({
      adapter,
      getContext: () => ({ currentUser: { id: 42, role: "editor" } }),
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        authorId: z.number().optional(),
      }),
      computed: {
        isOwner: (post, _c, ctx) => post.authorId === ctx.currentUser.id,
        userRole: (_post, _c, ctx) => ctx.currentUser.role,
        requestedVia: (_post, c) => c?.req.header("X-Client-App") ?? "unknown",
      },
    });

    // Post authored by user 42
    const createRes1 = await postsResource.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-App": "Mobile-iOS",
      },
      body: JSON.stringify({ title: "My Own Post", authorId: 42 }),
    });

    expect(createRes1.status).toBe(201);
    const body1: any = await createRes1.json();
    expect(body1.data.isOwner).toBe(true);
    expect(body1.data.userRole).toBe("editor");
    expect(body1.data.requestedVia).toBe("Mobile-iOS");

    // Post authored by user 99
    const createRes2 = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Someone Else Post", authorId: 99 }),
    });

    expect(createRes2.status).toBe(201);
    const body2: any = await createRes2.json();
    expect(body2.data.isOwner).toBe(false);
    expect(body2.data.requestedVia).toBe("unknown");
  });

  it("supports dependent computed fields where subsequent fields read earlier computed values", async () => {
    const { adapter } = await createTestDb();

    const app = createApp({ adapter });

    const usersResource = app.defineResource({
      name: "users",
      table: users,
      validator: z.object({
        name: z.string(),
        email: z.string(),
      }),
      computed: {
        firstName: (user) => user.name.split(" ")[0],
        lastName: (user) => user.name.split(" ")[1] ?? "",
        formalGreeting: (user) => `Dear Mr/Ms ${user.lastName}, welcome ${user.firstName}!`,
      },
    });

    const createRes = await usersResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bruce Wayne", email: "bruce@wayne.corp" }),
    });

    const body: any = await createRes.json();
    expect(body.data.firstName).toBe("Bruce");
    expect(body.data.lastName).toBe("Wayne");
    expect(body.data.formalGreeting).toBe("Dear Mr/Ms Wayne, welcome Bruce!");
  });

  it("respects methods scoping to exclude heavy fields from list queries", async () => {
    const { adapter } = await createTestDb();

    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        content: z.string().optional(),
      }),
      computed: {
        summary: (post) => (post.content ? post.content.substring(0, 10) + "..." : ""),
        heavyAnalytics: {
          methods: ["detail"], // only compute on detail, not list
          resolve: (post) => `analytics-for-${post.id}`,
        },
        listOnlyBadge: {
          methods: ["list"], // only compute on list, not detail
          resolve: () => "TRENDING",
        },
      },
    });

    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Deep Post", content: "Extensive article body text goes here" }),
    });

    const created: any = await createRes.json();
    const postId = created.data.id;

    // List query
    const listRes = await postsResource.request("/", { method: "GET" });
    const listBody: any = await listRes.json();
    expect(listBody.data[0].summary).toBe("Extensive ...");
    expect(listBody.data[0].listOnlyBadge).toBe("TRENDING");
    expect(listBody.data[0].heavyAnalytics).toBeUndefined();

    // Detail query
    const detailRes = await postsResource.request(`/${postId}`, { method: "GET" });
    const detailBody: any = await detailRes.json();
    expect(detailBody.data.summary).toBe("Extensive ...");
    expect(detailBody.data.heavyAnalytics).toBe(`analytics-for-${postId}`);
    expect(detailBody.data.listOnlyBadge).toBeUndefined();
  });

  it("handles resolver failures gracefully using fallback values", async () => {
    const { adapter } = await createTestDb();

    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
      }),
      computed: {
        failingWithFallback: {
          resolve: () => {
            throw new Error("Calculation engine error");
          },
          fallback: "DEFAULT_FALLBACK",
        },
        failingWithoutFallback: () => {
          throw new Error("Unhandled error");
        },
      },
    });

    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Safe Post" }),
    });

    expect(createRes.status).toBe(201);
    const body: any = await createRes.json();
    expect(body.data.failingWithFallback).toBe("DEFAULT_FALLBACK");
    expect(body.data.failingWithoutFallback).toBeNull();
  });

  it("integrates seamlessly with FLAC (Field-Level Access Control) for permission checks and masking", async () => {
    const { adapter } = await createTestDb();

    let clientRole = "user";

    const app = createApp<{ Bindings: Record<string, unknown> }, { role: string }>({
      adapter,
      getContext: () => ({ role: clientRole }),
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        price: z.number().optional(),
      }),
      computed: {
        margin: (post) => (post.price ? post.price * 0.25 : 0),
        secretScore: () => 98.7,
      },
      fields: {
        margin: {
          read: (ctx) => ctx.role === "admin",
          mask: "CONFIDENTIAL",
        },
        secretScore: {
          read: (ctx) => ctx.role === "admin",
        },
      },
    });

    // 1. As regular user: margin is masked, secretScore is stripped
    clientRole = "user";
    const resUser = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Confidential Report", price: 100 }),
    });
    const bodyUser: any = await resUser.json();
    expect(bodyUser.data.margin).toBe("CONFIDENTIAL");
    expect(bodyUser.data.secretScore).toBeUndefined();

    // 2. As admin: margin and secretScore are visible in cleartext
    clientRole = "admin";
    const resAdmin = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Admin Report", price: 100 }),
    });
    const bodyAdmin: any = await resAdmin.json();
    expect(bodyAdmin.data.margin).toBe(25);
    expect(bodyAdmin.data.secretScore).toBe(98.7);
  });

  it("supports virtualFields alias identically to computed", async () => {
    const { adapter } = await createTestDb();

    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
      }),
      virtualFields: {
        slugified: (post) => post.title.toLowerCase().replace(/\s+/g, "-"),
      },
    });

    const res = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Honocube Enterprise Framework" }),
    });

    const body: any = await res.json();
    expect(body.data.slugified).toBe("honocube-enterprise-framework");
  });

  it("evaluates computed fields on slug endpoints and update responses", async () => {
    const { adapter } = await createTestDb();

    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      slugs: ["slug"],
      validator: z.object({
        title: z.string(),
        slug: z.string().optional(),
      }),
      computed: {
        readingTimeMinutes: (post) => Math.max(1, Math.ceil(post.title.length / 5)),
      },
    });

    // Create
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "A Great Story", slug: "great-story" }),
    });
    const created: any = await createRes.json();
    const postId = created.data.id;
    expect(created.data.readingTimeMinutes).toBe(3);

    // Fetch via Slug (GET /slug/:val)
    const slugRes = await postsResource.request("/slug/great-story", { method: "GET" });
    expect(slugRes.status).toBe(200);
    const slugBody: any = await slugRes.json();
    expect(slugBody.data.readingTimeMinutes).toBe(3);

    // Update (PATCH /:id)
    const updateRes = await postsResource.request(`/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "An Even Longer Story Title Here" }),
    });
    expect(updateRes.status).toBe(200);
    const updateBody: any = await updateRes.json();
    expect(updateBody.data.readingTimeMinutes).toBe(7);
  });
});
