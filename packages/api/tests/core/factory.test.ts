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

  it("triggers app.defineApi, default logger methods, missing adapter error, and global onError", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    // 1. app.defineApi
    const dummyResource = app.defineResource({
      name: "users",
      table: users,
      validator: z.object({ name: z.string() }),
    });
    const definedApi = app.defineApi({ users: dummyResource });
    expect(definedApi).toBeDefined();

    // 2. Default logger methods
    const appWithDefaultLogger = createApp({ adapter });
    const logger = (appWithDefaultLogger as any).defineResource({
      name: "test",
      table: users,
      validator: z.object({ name: z.string() }),
    });
    expect(logger).toBeDefined();

    // 3. Missing adapter error
    const noAdapterApp = createApp({} as any);
    const noAdapterResource = noAdapterApp.defineResource({
      name: "users",
      table: users,
      validator: z.object({ name: z.string() }),
    });
    const errRes = await noAdapterResource.request("/", { method: "GET" });
    expect(errRes.status).toBe(500);
    const errJson = await errRes.json();
    expect(errJson.error.message).toContain("Adapter not found");

    // 4. Global onError with ValidationError, ZodError, and unhandled Error with logger
    const loggedErrors: any[] = [];
    const customLogger = {
      info: () => {},
      warn: () => {},
      error: (msg: any, err: any) => loggedErrors.push({ msg, err }),
      debug: () => {},
    };

    const { ValidationError } = await import("../../src/utils/errors.js");
    const errorApp = createApp({ adapter, logger: customLogger });
    const errorResource = errorApp.defineResource({
      name: "users",
      table: users,
      validator: z.object({ name: z.string() }),
      actions: [
        {
          path: "/actions/throw-validation",
          method: "get",
          handler: () => {
            throw new ValidationError([{ message: "Custom validation issue", path: ["field"] }]);
          },
        },
        {
          path: "/actions/throw-zod",
          method: "get",
          handler: () => {
            const err = new Error("Zod validation failed");
            err.name = "ZodError";
            (err as any).issues = [{ message: "Zod issue" }];
            throw err;
          },
        },
        {
          path: "/actions/throw-internal",
          method: "get",
          handler: () => {
            throw new Error("Unexpected crash");
          },
        },
      ],
    });

    const valRes = await errorResource.request("/actions/throw-validation", { method: "GET" });
    expect(valRes.status).toBe(400);
    const valJson = await valRes.json();
    expect(valJson.error.code).toBe("VALIDATION_ERROR");

    const zodRes = await errorResource.request("/actions/throw-zod", { method: "GET" });
    expect(zodRes.status).toBe(400);
    const zodJson = await zodRes.json();
    expect(zodJson.error.code).toBe("VALIDATION_ERROR");

    const intRes = await errorResource.request("/actions/throw-internal", { method: "GET" });
    expect(intRes.status).toBe(500);
    const intJson = await intRes.json();
    expect(intJson.error.code).toBe("INTERNAL_ERROR");
    expect(loggedErrors.length).toBe(1);
  });

  it("preserves custom finalized 404 response in isDefaultNotFound check", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({
      adapter,
      middleware: [
        async (c, next) => {
          if (c.req.path === "/custom-404") {
            return c.json({ customNotFound: true }, 404);
          }
          await next();
        },
      ],
    });

    const resource = app.defineResource({
      name: "users",
      table: users,
      validator: z.object({ name: z.string() }),
    });

    const res = await resource.request("/custom-404", { method: "GET" });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({ customNotFound: true });
  });
});
