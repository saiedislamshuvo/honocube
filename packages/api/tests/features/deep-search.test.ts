import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts, comments } from "../fixtures/db.js";

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
});
