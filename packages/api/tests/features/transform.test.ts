import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts } from "../fixtures/db.js";

describe("Data Transformation & Hidden Fields", () => {
  it("applies transform hook to add computed fields across CRUD responses", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        price: z.number().optional(),
      }),
      transform: (record: any) => ({
        ...record,
        formattedPrice: record.price ? `$${record.price.toFixed(2)}` : "$0.00",
        computedLabel: `${record.title} [TRANSFORMED]`,
      }),
    });

    // 1. Create response includes transformed fields
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Widget", price: 49.9 }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.data.formattedPrice).toBe("$49.90");
    expect(created.data.computedLabel).toBe("Widget [TRANSFORMED]");

    // 2. Detail response includes transformed fields
    const detailRes = await postsResource.request(`/${created.data.id}`, { method: "GET" });
    const detail = await detailRes.json();
    expect(detail.data.formattedPrice).toBe("$49.90");

    // 3. List response includes transformed fields
    const listRes = await postsResource.request("/", { method: "GET" });
    const list = await listRes.json();
    expect(list.data[0].formattedPrice).toBe("$49.90");
  });

  it("permanently hides sensitive fields declared in config.hidden", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      hidden: ["price", "tenantId"],
      validator: z.object({
        title: z.string(),
        price: z.number().optional(),
        tenantId: z.string().optional(),
      }),
    });

    // Create
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Secret Post", price: 9999, tenantId: "internal-id" }),
    });
    const created = await createRes.json();
    expect(created.data.title).toBe("Secret Post");
    expect(created.data.price).toBeUndefined(); // hidden
    expect(created.data.tenantId).toBeUndefined(); // hidden

    // Detail
    const detailRes = await postsResource.request(`/${created.data.id}`, { method: "GET" });
    const detail = await detailRes.json();
    expect(detail.data.price).toBeUndefined();

    // List
    const listRes = await postsResource.request("/", { method: "GET" });
    const list = await listRes.json();
    expect(list.data[0].price).toBeUndefined();
  });
});
