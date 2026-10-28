import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts } from "../fixtures/db.js";

describe("Read Lifecycle Hooks (beforeFetch & afterFetch)", () => {
  it("triggers beforeFetch and afterFetch on list and detail endpoints", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const fetchEvents: string[] = [];

    const p: any = await adapter.insert(posts, { title: "Original Post" });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
      hooks: {
        beforeFetch: (_c, params) => {
          if (params.list) fetchEvents.push("beforeFetch:list");
          if (params.detailId) fetchEvents.push(`beforeFetch:detail:${params.detailId}`);
        },
        afterFetch: (rows) => {
          fetchEvents.push(`afterFetch:${rows.length}`);
          // Intercept and augment rows
          return rows.map((r: any) => ({
            ...r,
            hookAugmented: true,
          }));
        },
      },
    });

    // 1. List
    const listRes = await postsResource.request("/", { method: "GET" });
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.data[0].hookAugmented).toBe(true);
    expect(fetchEvents).toContain("beforeFetch:list");

    // 2. Detail
    const detailRes = await postsResource.request(`/${p.id}`, { method: "GET" });
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json();
    expect(detail.data.hookAugmented).toBe(true);
    expect(fetchEvents).toContain(`beforeFetch:detail:${p.id}`);
  });
});
