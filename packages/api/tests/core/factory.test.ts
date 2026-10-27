import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { z } from "zod";
import { createApp, defineApi } from "../../src/core/factory.js";
import { createTestDb, users } from "../fixtures/db.js";

describe("Core Factory & App Configuration", () => {
  it("initializes createApp with default strategy and default logger", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    expect(app.defineResource).toBeDefined();
    expect(app.defineApi).toBeDefined();
  });

  it("respects custom strategy, logger, and storage options", async () => {
    const { adapter } = await createTestDb();
    const loggedMessages: string[] = [];

    const customLogger = {
      info: (msg: string) => loggedMessages.push(msg),
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    const app = createApp({
      adapter,
      strategy: "transaction",
      logger: customLogger,
    });

    expect(app).toBeDefined();
  });

  it("groups resources under defineApi and supports versioning", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const usersResource = defineResource({
      name: "users",
      table: users,
      validator: z.object({
        name: z.string(),
        email: z.string().email(),
        createdAt: z.string(),
      }),
    });

    const api = defineApi({
      users: usersResource,
    });

    const versionedApi = defineApi(
      {
        users: usersResource,
      },
      "v1"
    );

    // Test unversioned
    const rootApp = new Hono();
    rootApp.route("/api", api);
    const unversionedRes = await rootApp.request("/api/users", { method: "GET" });
    expect(unversionedRes.status).toBe(200);

    // Test versioned
    const versionedRootApp = new Hono();
    versionedRootApp.route("/api", versionedApi);
    const versionedRes = await versionedRootApp.request("/api/v1/users", { method: "GET" });
    expect(versionedRes.status).toBe(200);
  });

  it("answers unknown routes with a structured 404 error envelope", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const resource = defineResource({
      name: "users",
      table: users,
      validator: z.object({
        name: z.string(),
        email: z.string().email(),
        createdAt: z.string(),
      }),
    });

    const rootApp = new Hono();
    rootApp.route("/api/users", resource);

    // 1. A record that does not exist on a registered path
    const notFoundRecord = await rootApp.request("/api/users/99999", { method: "GET" });
    expect(notFoundRecord.status).toBe(404);
    const recordJson = await notFoundRecord.json();
    expect(recordJson).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Not Found",
      },
    });

    // 2. An unregistered multi-segment path under the resource
    const res = await rootApp.request("/api/users/1/unregistered/subpath", { method: "GET" });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Not Found",
        details: {
          path: "/api/users/1/unregistered/subpath",
          method: "GET",
        },
      },
    });
  });

  it("handles custom actions on resource", async () => {
    const { adapter } = await createTestDb();
    const { defineResource } = createApp({ adapter });

    const resource = defineResource({
      name: "users",
      table: users,
      validator: z.object({
        name: z.string(),
        email: z.string().email(),
        createdAt: z.string(),
      }),
      actions: [
        {
          path: "/actions/ping",
          method: "get",
          handler: () => ({ pong: true }),
        },
        {
          path: "/calculate",
          method: "post",
          validator: z.object({ num: z.number() }),
          handler: (_c, _ctx, data) => ({ doubled: data.num * 2 }),
        },
      ],
    });

    const pingRes = await resource.request("/actions/ping", { method: "GET" });
    expect(pingRes.status).toBe(200);
    const pingJson = await pingRes.json();
    expect(pingJson).toEqual({ success: true, data: { pong: true } });

    const calcRes = await resource.request("/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ num: 21 }),
    });
    expect(calcRes.status).toBe(200);
    const calcJson = await calcRes.json();
    expect(calcJson).toEqual({ success: true, data: { doubled: 42 } });
  });
});
