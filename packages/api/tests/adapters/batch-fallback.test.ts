import { describe, it, expect } from "vitest";
import { z } from "zod";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { pgTable, serial, text as pgText } from "drizzle-orm/pg-core";
import { createApp } from "../../src/core/factory.js";
import { DrizzleAdapter } from "../../src/adapters/drizzle.js";
import { createTestDb, posts, comments } from "../fixtures/db.js";

describe("Batch Strategy Fallback & Dialect Portability", () => {
  it("falls back to transaction strategy when adapter reports supportsBatch() === false", async () => {
    const { adapter } = await createTestDb();

    // Create an adapter that hides batch support (simulating postgres-js or mysql2)
    const nonBatchAdapter = new Proxy(adapter, {
      get(target, prop, receiver) {
        if (prop === "supportsBatch") return () => false;
        if (prop === "batch") return undefined;
        return Reflect.get(target, prop, receiver);
      },
    });

    const app = createApp({
      adapter: nonBatchAdapter as any,
      strategy: "batch", // Ask for batch, but driver cannot do it
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
      relations: {
        many: [
          {
            name: "comments",
            table: comments,
            foreignKey: "postId",
            referenceKey: "id",
            schema: z.object({
              author: z.string(),
              content: z.string(),
            }),
          },
        ],
      },
    });

    // Create with relations: should fall back to transaction without throwing "tx.batch is not a function"
    const res = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fallback Post",
        comments: [{ author: "FallbackUser", content: "Fallback Comment" }],
      }),
    });

    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.data.title).toBe("Fallback Post");

    // Verify written to database
    const inDb = await adapter.findMany(comments, {
      where: (cols: any, { eq }: any) => eq(cols.postId, created.data.id),
    });
    expect(inDb.length).toBe(1);
  });

  it("regression #4: parentIdExpression avoids last_insert_rowid() across dialects", () => {
    const dialect = new SQLiteSyncDialect();
    const pgPosts = pgTable("posts", { id: serial("id").primaryKey(), title: pgText("title") });

    const sqliteAdapter = new DrizzleAdapter({} as any, { dialect: "sqlite" });
    const pgAdapter = new DrizzleAdapter({} as any, { dialect: "postgresql" });
    const mysqlAdapter = new DrizzleAdapter({} as any, { dialect: "mysql" });

    const sqliteSql = dialect.sqlToQuery(sqliteAdapter.parentIdExpression(posts) as any).sql;
    const pgSql = dialect.sqlToQuery(pgAdapter.parentIdExpression(pgPosts) as any).sql;
    const mysqlSql = dialect.sqlToQuery(mysqlAdapter.parentIdExpression(posts) as any).sql;

    // None should contain last_insert_rowid
    expect(sqliteSql).not.toContain("last_insert_rowid");
    expect(pgSql).not.toContain("last_insert_rowid");
    expect(mysqlSql).not.toContain("last_insert_rowid");

    // Postgres expression contains currval sequence logic
    expect(pgSql).toContain("currval");
  });
});
