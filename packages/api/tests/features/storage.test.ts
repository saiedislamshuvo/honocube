import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { AppStorage } from "../../src/types.js";
import { createTestDb, posts } from "../fixtures/db.js";

class MockStorage implements AppStorage {
  public uploads: { file: any; options: { folder?: string; name: string } }[] = [];

  async upload(file: any, options: { folder?: string; name: string }) {
    this.uploads.push({ file, options });
    return `${options.folder || "uploads"}/${options.name}`;
  }

  async delete(_path: string) {}
}

describe("File Storage & Upload Processing", () => {
  it("processes file uploads and prepends mediaBaseUrl in responses", async () => {
    const { adapter } = await createTestDb();
    const storage = new MockStorage();

    const app = createApp({
      adapter,
      storage,
      mediaBaseUrl: "https://cdn.example.com/",
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      uploads: {
        content: { folder: "posts/covers" },
      },
      validator: z.object({
        title: z.string(),
        content: z.any().optional(),
      }),
    });

    // 1. Create with a file-like object
    const filePayload = { name: "banner.png", type: "image/png" };
    const createRes = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Post with Image",
        content: filePayload,
      }),
    });

    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(storage.uploads.length).toBe(1);
    expect(storage.uploads[0]?.options.folder).toBe("posts/covers");
    expect(storage.uploads[0]?.options.name).toBe("banner.png");

    // 2. Response has mediaBaseUrl prepended
    expect(created.data.content).toBe("https://cdn.example.com/posts/covers/banner.png");
  });

  it("regression #12: does not spread primitive values in relation fields", async () => {
    const { adapter } = await createTestDb();
    let hookedData: any;

    const app = createApp({
      adapter,
      storage: new MockStorage(),
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      uploads: {
        content: { folder: "posts" },
      },
      relations: {
        many: [
          {
            name: "comments",
            table: posts,
            foreignKey: "id",
            referenceKey: "id",
            schema: z.any(),
          },
        ],
      },
      hooks: {
        beforeCreate: (data) => {
          hookedData = data;
          return data;
        },
      },
      validator: z.object({
        title: z.string(),
        comments: z.any().optional(),
      }),
    });

    // Send primitive values in relation property
    await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Primitive Guard Test",
        comments: "not-an-array-or-object",
      }),
    });

    // Expect the string was not mutated or spread into characters { 0: 'n', 1: 'o', ... }
    expect(hookedData.comments).toBe("not-an-array-or-object");
  });
});
