import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import {
  testResource,
  defineTestResource,
  testApp,
  defineTestApp,
} from "../../src/testing/index.js";
import { createTestDb, posts, users, comments } from "../fixtures/db.js";

describe("Automated Resource Test Suite (@honocube/api/testing)", () => {
  it("executes full contract suite programmatically with testResource.run()", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const postsResource = defineResource({
      name: "posts",
      queryKey: "posts",
      table: posts,
      methods: ["list", "detail", "create", "update", "delete", "batch-update", "batch-delete"],
      timestamps: true,
      slugs: ["slug"],
      versionControl: {
        field: "version",
      },
      validator: z.object({
        title: z.string().min(1),
        content: z.string().optional(),
        slug: z.string().optional(),
        status: z.string().optional(),
        price: z.number().optional(),
        version: z.number().optional(),
      }),
      search: {
        fields: ["title", "slug"],
      },
      filter: {
        allow: ["status", "price"],
      },
    });

    const report = await testResource.run(postsResource, {
      fixtures: {
        valid: {
          title: "Automated Test Title",
          content: "Automated content",
          slug: "automated-test-title",
          status: "published",
          price: 50,
          version: 1,
        },
        update: {
          title: "Updated Automated Title",
          price: 75,
          version: 1,
        },
        invalid: {
          title: "", // Min length 1 violation
        },
      },
      search: {
        query: "Automated",
        expectedMatch: (r: any) => r.title.includes("Automated"),
      },
      filter: {
        query: {
          status: "published",
        },
        expectedMatch: (r: any) => r.status === "published",
      },
      batch: {
        updateData: {
          status: "archived",
        },
      },
      slug: {
        field: "slug",
        value: "automated-test-title",
      },
    });

    expect(report.success).toBe(true);
    expect(report.failed).toBe(0);
    expect(report.passed).toBeGreaterThanOrEqual(10);
    expect(report.tests.some((t) => t.name.includes("POST"))).toBe(true);
    expect(report.tests.some((t) => t.name.includes("GET"))).toBe(true);
    expect(report.tests.some((t) => t.name.includes("PATCH"))).toBe(true);
    expect(report.tests.some((t) => t.name.includes("DELETE"))).toBe(true);
    expect(report.tests.some((t) => t.name.includes("OCC"))).toBe(true);
    expect(report.tests.some((t) => t.name.includes("slug"))).toBe(true);
    expect(report.tests.some((t) => t.name.includes("batch-update"))).toBe(true);
    expect(report.tests.some((t) => t.name.includes("batch-delete"))).toBe(true);
  });

  it("verifies nested relation creation in POST /", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const postsWithRelations = defineResource({
      name: "posts",
      table: posts,
      softDelete: "deletedAt",
      validator: z.object({
        title: z.string(),
      }),
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

    const report = await testResource.run(postsWithRelations, {
      fixtures: {
        valid: { title: "With Relations Post" },
        update: { title: "Updated Relations Post" },
      },
      relations: {
        many: {
          comments: [
            { author: "Tester", content: "Nice feature!" },
          ],
        },
      },
    });

    expect(report.success).toBe(true);
  });

  it("verifies read-only resources reject write operations with 404/405 and auto-discovers existing ID from list", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    // Seed an existing record directly
    await adapter.insert(users, {
      name: "Existing User",
      email: "read-only-auto@example.com",
    });

    const readOnlyUsers = defineResource({
      name: "users",
      table: users,
      methods: ["list", "detail"],
      validator: z.object({
        name: z.string(),
        email: z.string().email(),
      }),
    });

    // Omit fixtures.existingId so it tests the auto-discovery fallback path (lines 208-213)
    const report = await testResource.run(readOnlyUsers, {
      fixtures: {
        valid: {
          name: "Should Not Create",
          email: "blocked@example.com",
        },
        update: {
          name: "Should Not Update",
        },
      },
    });

    expect(report.success).toBe(true);
    expect(report.tests.some((t) => t.name.includes("Method Restrictions"))).toBe(true);
  });

  it("verifies soft delete behavior", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const softDeleteUsers = defineResource({
      name: "users",
      table: users,
      softDelete: "deletedAt",
      validator: z.object({
        name: z.string(),
        email: z.string().email(),
      }),
    });

    const report = await testResource.run(softDeleteUsers, {
      fixtures: {
        valid: {
          name: "Soft Delete Target",
          email: "soft-delete@example.com",
        },
        update: {
          name: "Soft Delete Target Updated",
        },
      },
    });

    expect(report.success).toBe(true);
  });

  it("verifies row-level authorization rejection", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({
      adapter,
      getContext: async (c) => ({
        token: c.req.header("Authorization"),
      }),
    });

    const authResource = defineResource({
      name: "users",
      table: users,
      validator: z.object({
        name: z.string(),
        email: z.string().email(),
      }),
      authorize: (appContext) => {
        return appContext.token === "Bearer allowed-token";
      },
    });

    const report = await testResource.run(authResource, {
      headers: {
        Authorization: "Bearer allowed-token",
      },
      fixtures: {
        valid: {
          name: "Auth User",
          email: "auth-user@example.com",
        },
        update: {
          name: "Auth User Updated",
        },
      },
      auth: {
        unauthorizedHeaders: {
          Authorization: "Bearer forbidden-token",
        },
      },
    });

    expect(report.success).toBe(true);
    expect(report.tests.some((t) => t.name.includes("Authorization"))).toBe(true);
  });

  it("fails fast and reports error details when a contract assertion is violated", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const strictResource = defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string().min(10), // requires at least 10 chars
      }),
    });

    // Provide a valid fixture that deliberately violates the min(10) schema rule
    await expect(
      testResource.run(strictResource, {
        fixtures: {
          valid: {
            title: "short", // Only 5 chars, will fail POST / with 400 instead of 201
          },
          update: {
            title: "updated",
          },
        },
      })
    ).rejects.toThrow("[Honocube Test Assertion Failed]");
  });

  it("executes multi-resource API test suite with testApp.run()", async () => {
    const { adapter } = await createTestDb();
    const { defineResource, defineApi } = createApp({ adapter });

    const postsResource = defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
      }),
    });

    const usersResource = defineResource({
      name: "users",
      table: users,
      validator: z.object({
        name: z.string(),
        email: z.string().email(),
      }),
    });

    const api = defineApi(
      {
        posts: postsResource,
        users: usersResource,
      },
      "v1"
    );

    const report = await testApp.run(api, {
      version: "v1",
      resources: {
        posts: {
          fixtures: {
            valid: { title: "API Post" },
            update: { title: "Updated API Post" },
          },
        },
        users: {
          fixtures: {
            valid: { name: "API User", email: "api-user@example.com" },
            update: { name: "Updated API User" },
          },
        },
      },
    });

    expect(report.success).toBe(true);
    expect(report.failed).toBe(0);
    expect(report.passed).toBeGreaterThanOrEqual(10);
    expect(report.tests.some((t) => t.name.includes("/v1/posts"))).toBe(true);
    expect(report.tests.some((t) => t.name.includes("/v1/users"))).toBe(true);
  });

  it("supports test framework hook registration via testResource and testApp with suite.describe / suite.it", async () => {
    const { adapter } = await createTestDb();
    const { defineResource, defineApi } = createApp({ adapter });

    const simpleResource = defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
    });

    const registeredDescribes: string[] = [];
    const registeredTests: { name: string; fn: () => Promise<void> }[] = [];

    const mockDescribe = (name: string, fn: () => void) => {
      registeredDescribes.push(name);
      fn();
    };

    const mockIt = (name: string, fn: () => Promise<void> | void) => {
      registeredTests.push({ name, fn: fn as () => Promise<void> });
    };

    // 1. Test testResource with suite hooks
    testResource(simpleResource, {
      fixtures: {
        valid: { title: "Hook Test" },
        update: { title: "Updated Hook" },
      },
      suite: {
        describe: mockDescribe,
        it: mockIt,
      },
    });

    expect(registeredDescribes).toContain("[posts] Automated Contract Suite");
    expect(registeredTests.length).toBeGreaterThan(0);

    // Execute the registered test blocks to exercise their runner body
    for (const test of registeredTests) {
      await test.fn();
    }

    // 2. Test testApp with suite hooks
    const api = defineApi({ posts: simpleResource });
    const appDescribes: string[] = [];
    const appTests: { name: string; fn: () => Promise<void> }[] = [];

    testApp(api, {
      resources: {
        posts: {
          fixtures: {
            valid: { title: "App Hook Test" },
            update: { title: "Updated App Hook" },
          },
        },
      },
      suite: {
        describe: (name, fn) => {
          appDescribes.push(name);
          fn();
        },
        it: (name, fn) => {
          appTests.push({ name, fn: fn as () => Promise<void> });
        },
      },
    });

    expect(appDescribes.some((d) => d.includes("Contract Suite"))).toBe(true);
    for (const test of appTests) {
      await test.fn();
    }
  });

  it("exposes defineTestResource and defineTestApp as aliases", () => {
    expect(defineTestResource).toBe(testResource);
    expect(defineTestApp).toBe(testApp);
  });
});
