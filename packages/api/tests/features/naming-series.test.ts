import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts } from "../fixtures/db.js";

describe("Configurable Naming Series Engine", () => {
  it("generates standard sequential series numbers on create (INV-{YYYY}-{#####})", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const currentYear = new Date().getFullYear();

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        slug: z.string().optional(),
      }),
      namingSeries: {
        field: "slug",
        pattern: "INV-{YYYY}-{#####}",
      },
    });

    // 1. Create first document
    const res1 = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Invoice 1" }),
    });
    expect(res1.status).toBe(201);
    const data1 = await res1.json();
    expect(data1.data.slug).toBe(`INV-${currentYear}-00001`);

    // 2. Create second document
    const res2 = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Invoice 2" }),
    });
    expect(res2.status).toBe(201);
    const data2 = await res2.json();
    expect(data2.data.slug).toBe(`INV-${currentYear}-00002`);

    // 3. Verify in database
    const inDb1: any = await adapter.findFirst(posts, {
      where: (cols: any, { eq }: any) => eq(cols.id, data1.data.id),
    });
    expect(inDb1.slug).toBe(`INV-${currentYear}-00001`);

    const inDb2: any = await adapter.findFirst(posts, {
      where: (cols: any, { eq }: any) => eq(cols.id, data2.data.id),
    });
    expect(inDb2.slug).toBe(`INV-${currentYear}-00002`);
  });

  it("supports date tokens {YY}, {MM}, and {DD}", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const now = new Date();
    const YY = String(now.getFullYear()).slice(-2);
    const MM = String(now.getMonth() + 1).padStart(2, "0");
    const DD = String(now.getDate()).padStart(2, "0");

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        slug: z.string().optional(),
      }),
      namingSeries: {
        field: "slug",
        pattern: "PO-{YY}{MM}{DD}-{####}",
      },
    });

    const res = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Purchase Order 1" }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.slug).toBe(`PO-${YY}${MM}${DD}-0001`);
  });

  it("isolates counters per tenant in multi-tenant resources", async () => {
    const { adapter } = await createTestDb();

    let currentTenant = "tenant-A";
    const app = createApp<{ Bindings: Record<string, unknown> }, { tenantId: string }>({
      adapter,
      getContext: () => ({ tenantId: currentTenant }),
      tenancy: {
        field: "tenantId",
        resolve: (c, ctx) => ctx.tenantId,
      },
    });

    const currentYear = new Date().getFullYear();

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      tenancy: true,
      validator: z.object({
        title: z.string(),
        slug: z.string().optional(),
      }),
      namingSeries: {
        field: "slug",
        pattern: "INV-{YYYY}-{#####}",
      },
    });

    // 1. Tenant A creates record #1
    currentTenant = "tenant-A";
    const resA1 = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Tenant A Order 1" }),
    });
    expect(resA1.status).toBe(201);
    const dataA1 = await resA1.json();
    expect(dataA1.data.slug).toBe(`INV-${currentYear}-00001`);

    // 2. Tenant B creates record #1 -> gets 00001 (isolated counter!)
    currentTenant = "tenant-B";
    const resB1 = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Tenant B Order 1" }),
    });
    expect(resB1.status).toBe(201);
    const dataB1 = await resB1.json();
    expect(dataB1.data.slug).toBe(`INV-${currentYear}-00001`);

    // 3. Tenant A creates record #2 -> gets 00002
    currentTenant = "tenant-A";
    const resA2 = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Tenant A Order 2" }),
    });
    expect(resA2.status).toBe(201);
    const dataA2 = await resA2.json();
    expect(dataA2.data.slug).toBe(`INV-${currentYear}-00002`);
  });

  it("evaluates dynamic pattern function based on payload attributes", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        status: z.string().optional(),
        slug: z.string().optional(),
      }),
      namingSeries: {
        field: "slug",
        pattern: (ctx, data) =>
          data.status === "published"
            ? "PUB-{YYYY}-{#####}"
            : "DRAFT-{YYYY}-{#####}",
      },
    });

    const currentYear = new Date().getFullYear();

    // 1. Draft post
    const res1 = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Draft Post", status: "draft" }),
    });
    expect(res1.status).toBe(201);
    const data1 = await res1.json();
    expect(data1.data.slug).toBe(`DRAFT-${currentYear}-00001`);

    // 2. Published post -> distinct series prefix
    const res2 = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Live Post", status: "published" }),
    });
    expect(res2.status).toBe(201);
    const data2 = await res2.json();
    expect(data2.data.slug).toBe(`PUB-${currentYear}-00001`);
  });

  it("interpolates dynamic payload field placeholders like {title}", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        slug: z.string().optional(),
      }),
      namingSeries: {
        field: "slug",
        pattern: "{title}-{#####}",
      },
    });

    const res = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "NEWS" }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.data.slug).toBe("NEWS-00001");
  });

  it("overrides client-supplied value when allowManual is false (default)", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        slug: z.string().optional(),
      }),
      namingSeries: {
        field: "slug",
        pattern: "DOC-{#####}",
        allowManual: false,
      },
    });

    // Client attempts to spoof slug
    const res = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Client Document",
        slug: "SPOOFED-999",
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    // Overwritten with series number
    expect(data.data.slug).toBe("DOC-00001");
  });

  it("preserves client-supplied value when allowManual is true", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        slug: z.string().optional(),
      }),
      namingSeries: {
        field: "slug",
        pattern: "DOC-{#####}",
        allowManual: true,
      },
    });

    // 1. Client supplies custom value -> preserved
    const res1 = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Manual Doc",
        slug: "CUSTOM-CODE-100",
      }),
    });

    expect(res1.status).toBe(201);
    const data1 = await res1.json();
    expect(data1.data.slug).toBe("CUSTOM-CODE-100");

    // 2. Client omits value -> auto-generated
    const res2 = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Auto Doc" }),
    });

    expect(res2.status).toBe(201);
    const data2 = await res2.json();
    expect(data2.data.slug).toBe("DOC-00001");
  });

  it("delegates sequence increment to custom counter provider", async () => {
    const { adapter } = await createTestDb();

    let customCallCount = 0;
    const mockCounter = {
      getNext: async (_prefix: string) => {
        customCallCount++;
        return 777 + customCallCount;
      },
    };

    const app = createApp({
      adapter,
      namingSeries: {
        counter: mockCounter,
      },
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        slug: z.string().optional(),
      }),
      namingSeries: {
        field: "slug",
        pattern: "TICK-{#####}",
      },
    });

    const res1 = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Ticket 1" }),
    });
    expect(res1.status).toBe(201);
    const data1 = await res1.json();
    expect(data1.data.slug).toBe("TICK-00778");
    expect(customCallCount).toBe(1);

    const res2 = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Ticket 2" }),
    });
    expect(res2.status).toBe(201);
    const data2 = await res2.json();
    expect(data2.data.slug).toBe("TICK-00779");
    expect(customCallCount).toBe(2);
  });

  it("integrates seamlessly with slug query endpoint (GET /slug/:slug)", async () => {
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
      namingSeries: {
        field: "slug",
        pattern: "INV-{#####}",
      },
    });

    // 1. Create document
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Audited Invoice" }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.data.slug).toBe("INV-00001");

    // 2. Retrieve document by generated series number
    const getRes = await postsResource.request("/slug/INV-00001", { method: "GET" });
    expect(getRes.status).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.data.id).toBe(created.data.id);
    expect(fetched.data.title).toBe("Audited Invoice");
    expect(fetched.data.slug).toBe("INV-00001");
  });

  it("assigns sequential series numbers to rows during batch import", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      methods: ["list", "detail", "create", "import-execute"],
      validator: z.object({
        title: z.string(),
        slug: z.string().optional(),
      }),
      namingSeries: {
        field: "slug",
        pattern: "IMP-{#####}",
      },
      import: {
        lookupBy: "title",
      },
    });

    const importPayload = [
      { title: "Import Row 1" },
      { title: "Import Row 2" },
      { title: "Import Row 3" },
    ];

    const res = await postsResource.request("/import/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(importPayload),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results.creates.length).toBe(3);

    // Verify sequential assignment in database
    const allPosts: any = await adapter.findMany(posts, {
      orderBy: { field: "id", direction: "asc" },
    });
    expect(allPosts.length).toBe(3);
    expect(allPosts[0].slug).toBe("IMP-00001");
    expect(allPosts[1].slug).toBe("IMP-00002");
    expect(allPosts[2].slug).toBe("IMP-00003");
  });
});
