import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import {
  createTestDb,
  posts,
  tags,
  postTags,
  comments,
} from "../fixtures/db.js";

describe("Pivot (Many-to-Many) Relations & Append Strategy", () => {
  it("creates parent with nested pivot records atomically and syncs on update", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    // Seed tags
    const tag1: any = await adapter.insert(tags, { name: "Tech" });
    const tag2: any = await adapter.insert(tags, { name: "TypeScript" });
    const tag3: any = await adapter.insert(tags, { name: "Architecture" });

    const postsResource = defineResource({
      name: "posts",
      queryKey: "posts",
      table: posts,
      timestamps: true,
      validator: z.object({
        title: z.string().optional(),
      }),
      relations: {
        pivots: [
          {
            name: "tags",
            table: postTags,
            targetTable: tags,
            foreignKey: "postId",
            referenceKey: "tagId",
            targetReferenceKey: "id",
            relationName: "postTags",
            strategy: "replace",
          },
        ],
      },
    });

    // 1. Create Post with 2 tags
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Pivoted Post",
        tags: [{ tagId: tag1.id }, { tagId: tag2.id }],
      }),
    });

    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    const postId = created.data.id;

    // Verify 2 rows in post_tags
    const pivotRows = await adapter.findMany(postTags, {
      where: (cols: any, { eq }: any) => eq(cols.postId, postId),
    });
    expect(pivotRows.length).toBe(2);

    // 2. PATCH Post to replace tags with tag3
    const patchRes = await postsResource.request(`/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Updated Pivoted Post",
        tags: [{ tagId: tag3.id }],
      }),
    });
    expect(patchRes.status).toBe(200);

    // Verify post_tags now only has 1 row with tag3
    const updatedPivots = await adapter.findMany(postTags, {
      where: (cols: any, { eq }: any) => eq(cols.postId, postId),
    });
    expect(updatedPivots.length).toBe(1);
    expect((updatedPivots[0] as any).tagId).toBe(tag3.id);
  });

  it("appends child records without deleting existing ones using append strategy", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const postsResource = defineResource({
      name: "posts",
      table: posts,
      timestamps: true,
      validator: z.object({ title: z.string().optional() }),
      relations: {
        many: [
          {
            name: "comments",
            table: comments,
            foreignKey: "postId",
            referenceKey: "id",
            strategy: "append",
            schema: z.object({
              author: z.string(),
              content: z.string(),
            }),
          },
        ],
      },
    });

    // 1. Create with 1 comment
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Append Test",
        comments: [{ author: "User1", content: "Initial Comment" }],
      }),
    });
    const created = await createRes.json();
    const postId = created.data.id;

    // 2. PATCH with append strategy: adds 1 more comment
    const patchRes = await postsResource.request(`/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Append Test Updated",
        comments: [{ author: "User2", content: "Appended Comment" }],
      }),
    });
    expect(patchRes.status).toBe(200);

    // Verify database has BOTH comments (total 2)
    const allComments = await adapter.findMany(comments, {
      where: (cols: any, { eq }: any) => eq(cols.postId, postId),
    });
    expect(allComments.length).toBe(2);
  });
});
