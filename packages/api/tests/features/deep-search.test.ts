import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts, comments, users, tags, postTags } from "../fixtures/db.js";

describe("Deep Search via Subqueries", () => {
  it("searches across parent fields and related many child records via subqueries", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const postsResource = defineResource({
      name: "posts",
      queryKey: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
      relations: {
        many: [
          {
            name: "comments",
            table: comments,
            foreignKey: "postId",
            referenceKey: "id",
            search: ["author", "content"],
            schema: z.object({
              author: z.string(),
              content: z.string(),
            }),
          },
        ],
      },
      search: {
        fields: ["title"],
        relations: ["comments"],
      },
    });

    // Post 1: Title matches "Framework"
    const p1: any = await adapter.insert(posts, { title: "Framework Overview" });

    // Post 2: Title is "Discussion", but child comment mentions "Framework"
    const p2: any = await adapter.insert(posts, { title: "General Discussion" });
    await adapter.insert(comments, {
      postId: p2.id,
      author: "Contributor",
      content: "I really love this Framework!",
    });

    // Post 3: Neither title nor comments mention "Framework"
    await adapter.insert(posts, { title: "Random Topic" });

    // Search ?q=Framework
    const res = await postsResource.request("/?q=Framework", { method: "GET" });
    expect(res.status).toBe(200);
    const json = await res.json();

    // Should match both Post 1 (by title) and Post 2 (by child comment content)
    expect(json.data.length).toBe(2);
    const matchedIds = json.data.map((r: any) => r.id);
    expect(matchedIds).toContain(p1.id);
    expect(matchedIds).toContain(p2.id);
  });

  it("searches across 'one' and 'pivot' relations via subqueries", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    // 1. Seed author (one relation) and tag (pivot relation)
    const author1: any = await adapter.insert(users, { name: "Grace Hopper", email: "grace@navy.mil" });
    const author2: any = await adapter.insert(users, { name: "Alan Turing", email: "alan@bletchley.uk" });

    await adapter.insert(tags, { name: "Compiler" });
    const tag2: any = await adapter.insert(tags, { name: "Cryptography" });

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
            search: ["name"],
          },
        ],
        pivots: [
          {
            name: "tags",
            table: postTags,
            targetTable: tags,
            foreignKey: "postId",
            referenceKey: "tagId",
            targetReferenceKey: "id",
            relationName: "postTags",
            search: ["name"],
          },
        ],
      },
      search: {
        fields: ["title"],
        relations: ["author", "tags"],
      },
    });

    // Post A: by Grace Hopper
    const postA: any = await adapter.insert(posts, { title: "Paper A", authorId: author1.id });
    // Post B: tagged with Cryptography
    const postB: any = await adapter.insert(posts, { title: "Paper B", authorId: author2.id });
    await adapter.insert(postTags, { postId: postB.id, tagId: tag2.id });

    // Search by one relation: "Grace"
    const searchOneRes = await postsResource.request("/?q=Grace", { method: "GET" });
    expect(searchOneRes.status).toBe(200);
    const searchOneJson = await searchOneRes.json();
    expect(searchOneJson.data.length).toBe(1);
    expect(searchOneJson.data[0].id).toBe(postA.id);

    // Search by pivot relation: "Cryptography"
    const searchPivotRes = await postsResource.request("/?q=Cryptography", { method: "GET" });
    expect(searchPivotRes.status).toBe(200);
    const searchPivotJson = await searchPivotRes.json();
    expect(searchPivotJson.data.length).toBe(1);
    expect(searchPivotJson.data[0].id).toBe(postB.id);
  });
});
