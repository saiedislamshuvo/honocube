import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts, comments } from "../fixtures/db.js";
import { sanitizeFts5Query, resolveSearchStrategy } from "../../src/search/engine.js";

describe("Full-Text Search Engine & Virtual Table Management", () => {
  describe("sanitizeFts5Query", () => {
    it("handles single words, multiple words, and adds prefix wildcards", () => {
      expect(sanitizeFts5Query("framework")).toBe("framework*");
      expect(sanitizeFts5Query("web framework")).toBe("web* framework*");
    });

    it("preserves exact phrases in double quotes", () => {
      expect(sanitizeFts5Query('"lightweight web framework"')).toBe('"lightweight web framework"');
    });

    it("recovers gracefully from unbalanced or broken quotes", () => {
      const res = sanitizeFts5Query('"unclosed query');
      expect(res).toBe("unclosed* query*");
    });

    it("quotes reserved FTS5 operators to prevent syntax errors", () => {
      expect(sanitizeFts5Query("AND")).toBe('"AND"');
      expect(sanitizeFts5Query("OR")).toBe('"OR"');
      expect(sanitizeFts5Query("NOT")).toBe('"NOT"');
      expect(sanitizeFts5Query("NEAR")).toBe('"NEAR"');
    });

    it("strips dangerous punctuation and leading wildcards", () => {
      expect(sanitizeFts5Query("*leadingAsterisk")).toBe("leadingAsterisk*");
      expect(sanitizeFts5Query("hello:world")).toBe("helloworld*");
      expect(sanitizeFts5Query("special!@#$%chars")).toBe("specialchars*");
      expect(sanitizeFts5Query("(unclosed paren")).toBe("unclosed* paren*");
    });

    it("returns empty string for empty or whitespace-only inputs", () => {
      expect(sanitizeFts5Query("")).toBe("");
      expect(sanitizeFts5Query("   ")).toBe("");
    });
  });

  describe("resolveSearchStrategy", () => {
    it("resolves fts5 when virtualTable is present on sqlite dialect", () => {
      expect(
        resolveSearchStrategy(
          { fields: ["title"], virtualTable: { tableName: "posts_fts" } },
          "sqlite"
        )
      ).toBe("fts5");
    });

    it("resolves tsvector on postgresql dialect", () => {
      expect(
        resolveSearchStrategy(
          { fields: ["title"], tsvector: { column: "search_vector" } },
          "postgresql"
        )
      ).toBe("tsvector");
    });

    it("falls back to like when no virtualTable or tsvector is configured", () => {
      expect(
        resolveSearchStrategy(
          { fields: ["title"] },
          "sqlite"
        )
      ).toBe("like");
    });

    it("respects explicit strategy overrides", () => {
      expect(
        resolveSearchStrategy(
          { fields: ["title"], strategy: "like", virtualTable: { tableName: "posts_fts" } },
          "sqlite"
        )
      ).toBe("like");
    });
  });

  describe("FTS5 Query Execution & Lifecycle Hook Sync", () => {
    it("synchronizes create, update, delete into FTS5 virtual table and ranks by BM25", async () => {
      const { client, adapter } = await createTestDb();

      // Create FTS5 virtual table
      await client.execute(`
        CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
          title,
          content
        );
      `);

      const { defineResource } = createApp({ adapter });

      const postsResource = defineResource({
        name: "posts",
        queryKey: "posts",
        table: posts,
        methods: ["list", "detail", "create", "update", "delete", "batch-delete"],
        validator: z.object({
          title: z.string(),
          content: z.string().optional(),
        }),
        search: {
          fields: ["title", "content"],
          strategy: "fts5",
          virtualTable: {
            tableName: "posts_fts",
            sync: "hooks",
            ranking: true,
            weights: { title: 5.0, content: 1.0 },
          },
        },
      });

      // 1. Create Post 1: has "Fulltext" in Title (weight 5.0)
      const res1 = await postsResource.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Fulltext Search Architecture",
          content: "Comprehensive database guide",
        }),
      });
      expect(res1.status).toBe(201);
      const { data: post1 } = await res1.json();

      // 2. Create Post 2: has "fulltext" only in Content (weight 1.0)
      const res2 = await postsResource.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Storage Performance",
          content: "Details on fulltext query indexing",
        }),
      });
      expect(res2.status).toBe(201);
      const { data: post2 } = await res2.json();

      // 3. Create Post 3: completely unrelated
      const res3 = await postsResource.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Unrelated Article",
          content: "Random notes",
        }),
      });
      expect(res3.status).toBe(201);
      const { data: post3 } = await res3.json();

      // 4. Verify FTS5 query with prefix matching
      const searchRes = await postsResource.request("/?q=Fulltext", { method: "GET" });
      expect(searchRes.status).toBe(200);
      const searchData = await searchRes.json();
      expect(searchData.data.length).toBe(2);

      // Verify BM25 ranking: Post 1 (title match, weight 5.0) should be ahead of Post 2 (content match, weight 1.0)
      expect(searchData.data[0].id).toBe(post1.id);
      expect(searchData.data[1].id).toBe(post2.id);

      // 5. Test explicit sort=relevance
      const relevanceRes = await postsResource.request("/?q=Fulltext&sort=relevance", { method: "GET" });
      expect(relevanceRes.status).toBe(200);
      const relevanceData = await relevanceRes.json();
      expect(relevanceData.data[0].id).toBe(post1.id);

      // 6. Test update hook sync: update Post 3 to contain searchable keyword
      const updateRes = await postsResource.request(`/${post3.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Updated Fulltext Document",
        }),
      });
      expect(updateRes.status).toBe(200);

      // Post 3 should now appear in search results
      const afterUpdateRes = await postsResource.request("/?q=Fulltext", { method: "GET" });
      const afterUpdateData = await afterUpdateRes.json();
      expect(afterUpdateData.data.length).toBe(3);
      const post3InSearch = afterUpdateData.data.find((p: any) => p.id === post3.id);
      expect(post3InSearch).toBeDefined();

      // 7. Test delete hook sync: delete Post 1
      const deleteRes = await postsResource.request(`/${post1.id}`, { method: "DELETE" });
      expect(deleteRes.status).toBe(200);

      // Post 1 should no longer be returned
      const afterDeleteRes = await postsResource.request("/?q=Fulltext", { method: "GET" });
      const afterDeleteData = await afterDeleteRes.json();
      expect(afterDeleteData.data.length).toBe(2);
      expect(afterDeleteData.data.some((p: any) => p.id === post1.id)).toBe(false);

      // 8. Test search input resilience against broken query syntax (unclosed quotes, bare operators)
      const brokenSyntaxRes = await postsResource.request('/?q="broken quote AND OR NOT', { method: "GET" });
      expect(brokenSyntaxRes.status).toBe(200);

      // 9. Test explicit sort overriding BM25 ranking (e.g., sort by id desc)
      const explicitSortRes = await postsResource.request("/?q=Fulltext&sort=id&order=desc", { method: "GET" });
      expect(explicitSortRes.status).toBe(200);
      const explicitSortData = await explicitSortRes.json();
      expect(explicitSortData.data[0].id).toBe(post3.id); // post3 has highest id

      // 10. Test batch delete synchronization
      const batchDeleteRes = await postsResource.request("/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [post2.id, post3.id] }),
      });
      expect(batchDeleteRes.status).toBe(200);

      // Both post2 and post3 should be removed from virtual table
      const finalSearchRes = await postsResource.request("/?q=Fulltext", { method: "GET" });
      const finalSearchData = await finalSearchRes.json();
      expect(finalSearchData.data.length).toBe(0);
    });

    it("gracefully falls back to LIKE search when virtual table does not exist", async () => {
      const { adapter } = await createTestDb();
      const { defineResource } = createApp({ adapter });

      // Note: non_existent_fts table is NOT created in SQLite
      const postsResource = defineResource({
        name: "posts",
        queryKey: "posts",
        table: posts,
        methods: ["list", "detail", "create", "update", "delete", "batch-delete"],
        validator: z.object({
          title: z.string(),
          content: z.string().optional(),
        }),
        search: {
          fields: ["title", "content"],
          strategy: "fts5",
          virtualTable: {
            tableName: "non_existent_fts",
            sync: "hooks",
            ranking: true,
          },
        },
      });

      // Insert test posts directly
      const p1: any = await adapter.insert(posts, {
        title: "Fallback Post",
        content: "Contains unique keyword resilient",
      });
      await adapter.insert(posts, {
        title: "Other Post",
        content: "Unrelated content",
      });

      // Query should gracefully fall back to LIKE without throwing 500
      const searchRes = await postsResource.request("/?q=resilient", { method: "GET" });
      expect(searchRes.status).toBe(200);
      const searchJson = await searchRes.json();
      expect(searchJson.data.length).toBe(1);
      expect(searchJson.data[0].id).toBe(p1.id);
    });

    it("supports combining FTS5 local search with relational search across child records", async () => {
      const { client, adapter } = await createTestDb();

      await client.execute(`
        CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
          title,
          content
        );
      `);

      const { defineResource } = createApp({ adapter });

      const postsResource = defineResource({
        name: "posts",
        queryKey: "posts",
        table: posts,
        methods: ["list", "detail", "create", "update", "delete", "batch-delete"],
        validator: z.object({
          title: z.string(),
          content: z.string().optional(),
        }),
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
          fields: ["title", "content"],
          relations: ["comments"],
          strategy: "fts5",
          virtualTable: {
            tableName: "posts_fts",
            sync: "hooks",
          },
        },
      });

      // Post 1 matches via local FTS5 fields
      const p1Res = await postsResource.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Microservices Architecture",
          content: "Distributed system patterns",
        }),
      });
      const { data: p1 } = await p1Res.json();

      // Post 2 title is unrelated, but comment contains search term
      const p2Res = await postsResource.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "General Blog",
          content: "Daily discussions",
        }),
      });
      const { data: p2 } = await p2Res.json();

      await adapter.insert(comments, {
        postId: p2.id,
        author: "Dev",
        content: "Great discussion on Microservices!",
      });

      // Search matches both Post 1 (via FTS5) and Post 2 (via relations)
      const res = await postsResource.request("/?q=Microservices", { method: "GET" });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.length).toBe(2);
      const ids = json.data.map((p: any) => p.id);
      expect(ids).toContain(p1.id);
      expect(ids).toContain(p2.id);
    });
  });
});
