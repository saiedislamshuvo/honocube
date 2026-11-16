import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts } from "../fixtures/db.js";

describe("Optimistic Concurrency Control & HTTP Revision Headers", () => {
  it("emits ETag header on detail and responds with 304 on matching If-None-Match", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const postsResource = defineResource({
      name: "posts",
      table: posts,
      versionControl: { field: "version" },
      validator: z.object({
        title: z.string().optional(),
        version: z.number().optional(),
      }),
    });

    const inserted: any = await adapter.insert(posts, {
      title: "Concurrency Article",
      version: 1,
    });

    // 1. GET /:id should emit ETag: W/"1"
    const getRes = await postsResource.request(`/${inserted.id}`);
    expect(getRes.status).toBe(200);
    const etag = getRes.headers.get("etag") || getRes.headers.get("ETag");
    expect(etag).toBe('W/"1"');

    // 2. GET /:id with If-None-Match: W/"1" should return 304 Not Modified
    const notModifiedRes = await postsResource.request(`/${inserted.id}`, {
      headers: { "If-None-Match": 'W/"1"' },
    });
    expect(notModifiedRes.status).toBe(304);

    // 3. GET /:id with non-matching If-None-Match should return 200 OK
    const matchFailRes = await postsResource.request(`/${inserted.id}`, {
      headers: { "If-None-Match": 'W/"99"' },
    });
    expect(matchFailRes.status).toBe(200);
  });

  it("allows mutation with valid If-Match header and updates ETag", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const postsResource = defineResource({
      name: "posts",
      table: posts,
      versionControl: { field: "version" },
      validator: z.object({
        title: z.string().optional(),
        version: z.number().optional(),
      }),
    });

    const inserted: any = await adapter.insert(posts, {
      title: "Concurrency Draft",
      version: 1,
    });

    // 1. PATCH /:id using If-Match header (without version in body)
    const patchRes = await postsResource.request(`/${inserted.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "If-Match": 'W/"1"',
      },
      body: JSON.stringify({ title: "Updated via If-Match" }),
    });

    expect(patchRes.status).toBe(200);
    const updatedEtag = patchRes.headers.get("etag") || patchRes.headers.get("ETag");
    expect(updatedEtag).toBe('W/"2"');

    const json = await patchRes.json();
    expect(json.data.title).toBe("Updated via If-Match");
    expect(json.data.version).toBe(2);

    // 2. PUT /:id works identically to PATCH
    const putRes = await postsResource.request(`/${inserted.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "If-Match": 'W/"2"',
      },
      body: JSON.stringify({ title: "Updated via PUT" }),
    });

    expect(putRes.status).toBe(200);
    const putEtag = putRes.headers.get("etag") || putRes.headers.get("ETag");
    expect(putEtag).toBe('W/"3"');
    const putJson = await putRes.json();
    expect(putJson.data.title).toBe("Updated via PUT");
    expect(putJson.data.version).toBe(3);
  });

  it("rejects PATCH and PUT with 412 Precondition Failed when If-Match is stale", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const postsResource = defineResource({
      name: "posts",
      table: posts,
      versionControl: { field: "version" },
      validator: z.object({
        title: z.string().optional(),
        version: z.number().optional(),
      }),
    });

    const inserted: any = await adapter.insert(posts, {
      title: "Conflict Target",
      version: 5,
    });

    // Outdated If-Match version 4
    const staleRes = await postsResource.request(`/${inserted.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "If-Match": 'W/"4"',
      },
      body: JSON.stringify({ title: "Will Fail" }),
    });

    expect(staleRes.status).toBe(412);
    const err = await staleRes.json();
    expect(err.error.code).toBe("PRECONDITION_FAILED");
    expect(err.error.details.currentVersion).toBe(5);
    expect(err.error.details.expectedVersion).toBe(4);
  });

  it("enforces If-Match precondition check on DELETE /:id", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const postsResource = defineResource({
      name: "posts",
      table: posts,
      versionControl: { field: "version" },
    });

    const inserted: any = await adapter.insert(posts, {
      title: "To Be Deleted",
      version: 3,
    });

    // 1. DELETE with outdated If-Match rejected with 412
    const staleDelRes = await postsResource.request(`/${inserted.id}`, {
      method: "DELETE",
      headers: { "If-Match": 'W/"2"' },
    });
    expect(staleDelRes.status).toBe(412);

    // 2. DELETE with matching If-Match succeeds with 200
    const validDelRes = await postsResource.request(`/${inserted.id}`, {
      method: "DELETE",
      headers: { "If-Match": 'W/"3"' },
    });
    expect(validDelRes.status).toBe(200);
  });

  it("supports boolean versionControl: true shorthand with default version field", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const postsResource = defineResource({
      name: "posts",
      table: posts,
      versionControl: true,
      validator: z.object({
        title: z.string().optional(),
        version: z.number().optional(),
      }),
    });

    const inserted: any = await adapter.insert(posts, {
      title: "Shorthand Resource",
      version: 1,
    });

    const res = await postsResource.request(`/${inserted.id}`);
    expect(res.headers.get("etag") || res.headers.get("ETag")).toBe('W/"1"');
  });
});
