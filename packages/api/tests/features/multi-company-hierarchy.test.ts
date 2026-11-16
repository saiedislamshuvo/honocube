import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts } from "../fixtures/db.js";

describe("Multi-Company Holding Hierarchy & Master Data Synchronization (Issue #137)", () => {
  it("enables subsidiary workspaces to inherit parent master catalog records while preventing mutation", async () => {
    const { adapter } = await createTestDb();

    // Setup holding hierarchy:
    // "holding" is parent of "sub-1" and "sub-2"
    const hierarchyMap: Record<string, string | null> = {
      "sub-1": "holding",
      "sub-2": "holding",
      "holding": null,
    };

    let activeTenant = "holding";

    const app = createApp({
      adapter,
      tenancy: {
        field: "tenantId",
        resolve: () => activeTenant,
        hierarchy: {
          getParentId: (tid) => hierarchyMap[String(tid)] || null,
          getSubsidiaryIds: (tid) => {
            if (tid === "holding") return ["sub-1", "sub-2"];
            return [];
          },
        },
      },
    });

    const categoriesResource = app.defineResource({
      name: "categories",
      table: posts,
      validator: z.object({
        title: z.string(),
        slug: z.string().optional(),
      }),
      tenancy: {
        inheritFromParent: true, // Master data inherited by subsidiaries
      },
    });

    // 1. Holding company creates master category
    activeTenant = "holding";
    const parentRes = await categoriesResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Global Electronics", slug: "electronics" }),
    });
    expect(parentRes.status).toBe(201);
    const parentCategory = await parentRes.json();
    const parentId = parentCategory.data.id;

    // 2. Subsidiary "sub-1" creates local category
    activeTenant = "sub-1";
    const subRes = await categoriesResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Local Perishables", slug: "perishables" }),
    });
    expect(subRes.status).toBe(201);
    const subCategory = await subRes.json();
    const subId = subCategory.data.id;

    // 3. Subsidiary lists categories -> sees BOTH parent master catalog and local category
    const listRes = await categoriesResource.request("/");
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.data).toHaveLength(2);
    const titles = listData.data.map((c: any) => c.title);
    expect(titles).toContain("Global Electronics");
    expect(titles).toContain("Local Perishables");

    // 4. Subsidiary cannot update parent master record (strict writeTenantCondition isolation)
    const patchParentRes = await categoriesResource.request(`/${parentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hacked Global Electronics" }),
    });
    expect(patchParentRes.status).toBe(404);

    // 5. Subsidiary cannot delete parent master record
    const deleteParentRes = await categoriesResource.request(`/${parentId}`, {
      method: "DELETE",
    });
    expect(deleteParentRes.status).toBe(404);

    // 6. Subsidiary can update its own local record
    const patchSubRes = await categoriesResource.request(`/${subId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Perishables" }),
    });
    expect(patchSubRes.status).toBe(200);
    const patchedSub = await patchSubRes.json();
    expect(patchedSub.data.title).toBe("Updated Perishables");
  });

  it("synchronizes master catalog records downstream to designated subsidiaries", async () => {
    const { adapter } = await createTestDb();

    const app = createApp({
      adapter,
      tenancy: {
        field: "tenantId",
        resolve: (c) => c.req.header("x-tenant-id") || "holding",
        hierarchy: {
          getSubsidiaryIds: (tid) => {
            if (tid === "holding") return ["sub-east", "sub-west"];
            return [];
          },
        },
      },
    });

    const catalogResource = app.defineResource({
      name: "brands",
      table: posts,
      validator: z.object({
        title: z.string(),
        slug: z.string().optional(),
      }),
      tenancy: {
        allowDownstreamSync: true,
      },
    });

    // 1. Create 2 master records in holding company
    await catalogResource.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": "holding",
      },
      body: JSON.stringify({ title: "Brand Alpha", slug: "brand-alpha" }),
    });
    await catalogResource.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": "holding",
      },
      body: JSON.stringify({ title: "Brand Beta", slug: "brand-beta" }),
    });

    // 2. Reject sync to unauthorized non-subsidiary tenant
    const unauthorizedSync = await catalogResource.request("/sync-downstream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": "holding",
      },
      body: JSON.stringify({
        targetTenantIds: ["rogue-company"],
      }),
    });
    expect(unauthorizedSync.status).toBe(403);

    // 3. Synchronize downstream to sub-east and sub-west
    const syncRes = await catalogResource.request("/sync-downstream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": "holding",
      },
      body: JSON.stringify({
        targetTenantIds: ["sub-east", "sub-west"],
        strategy: "overwrite",
        matchField: "slug",
      }),
    });
    expect(syncRes.status).toBe(200);
    const syncData = await syncRes.json();
    expect(syncData.success).toBe(true);
    expect(syncData.created).toBe(4); // 2 brands * 2 subsidiaries
    expect(syncData.updated).toBe(0);

    // 4. Verify sub-east received the synced records
    const subEastList = await catalogResource.request("/", {
      headers: { "x-tenant-id": "sub-east" },
    });
    const subEastData = await subEastList.json();
    expect(subEastData.data).toHaveLength(2);
    expect(subEastData.data.map((b: any) => b.title)).toEqual(
      expect.arrayContaining(["Brand Alpha", "Brand Beta"])
    );

    // 5. Re-running sync with strategy 'skip' leaves existing untouched
    const skipSyncRes = await catalogResource.request("/sync-downstream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": "holding",
      },
      body: JSON.stringify({
        targetTenantIds: ["sub-east"],
        strategy: "skip",
        matchField: "slug",
      }),
    });
    const skipData = await skipSyncRes.json();
    expect(skipData.skipped).toBe(2);
    expect(skipData.created).toBe(0);
  });
});
