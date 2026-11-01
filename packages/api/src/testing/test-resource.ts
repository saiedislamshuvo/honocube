import type { Hono } from "hono";
import { RESOURCE_CONFIG, API_CONFIG } from "../core/factory.js";
import type { ResourceConfig } from "../types.js";
import type { TestResourceParams, TestAppParams, TestExecutionReport, TestCaseResult } from "./types.js";

function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[Honocube Test Assertion Failed] ${message}`);
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(
      `[Honocube Test Assertion Failed] ${message}. Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`
    );
  }
}

interface InternalTestCase {
  name: string;
  fn: () => Promise<void>;
  skip?: boolean;
}

const cleanPath = (prefix: string, path: string): string => {
  const [p = "", q] = path.split("?");
  let norm = `${prefix}${p.startsWith("/") ? p : `/${p}`}`.replace(/\/+/g, "/");
  if (norm.length > 1 && norm.endsWith("/")) {
    norm = norm.slice(0, -1);
  }
  if (!norm.startsWith("/")) {
    norm = `/${norm}`;
  }
  return q !== undefined ? `${norm}?${q}` : norm;
};

/**
 * Builds the test case battery for a resource.
 */
function buildResourceTestCases(
  resourceApp: Hono<any>,
  params: TestResourceParams,
  pathPrefix: string = ""
): { testCases: InternalTestCase[]; resourceName: string } {
  const config: ResourceConfig<any, any, any> | undefined = (resourceApp as any)[RESOURCE_CONFIG];
  const resourceName = config?.name ?? "Resource";
  const methods = new Set(config?.methods ?? ["list", "detail", "create", "update", "delete"]);

  let createdId: string | number | null = params.fixtures.existingId ?? null;
  let secondId: string | number | null = null;

  const req = async (
    path: string,
    init?: RequestInit,
    extraHeaders?: Record<string, string>,
    extraContext?: Record<string, unknown>
  ) => {
    const fullPath = cleanPath(pathPrefix, path);
    const url = `http://localhost${fullPath}`;
    const headers = new Headers(init?.headers);
    if (!headers.has("Content-Type") && init?.body) {
      headers.set("Content-Type", "application/json");
    }
    if (params.headers) {
      for (const [k, v] of Object.entries(params.headers)) {
        if (!headers.has(k)) headers.set(k, v);
      }
    }
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) {
        headers.set(k, v);
      }
    }
    const env = { ...(params.context ?? {}), ...(extraContext ?? {}) };
    const res = await resourceApp.request(url, { ...init, headers }, env);
    let json: any = null;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        json = await res.json();
      } catch {
        json = null;
      }
    }
    return { res, json, status: res.status };
  };

  const testCases: InternalTestCase[] = [
    // 1. POST / (Create)
    {
      name: `POST ${pathPrefix}/ - creates a record and returns 201 Created`,
      skip: !methods.has("create"),
      fn: async () => {
        let payload: any = { ...params.fixtures.valid };
        if (params.relations?.many) {
          payload = { ...payload, ...params.relations.many };
        }
        if (params.relations?.pivots) {
          payload = { ...payload, ...params.relations.pivots };
        }

        const { status, json } = await req("/", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        assertEqual(status, 201, `POST ${pathPrefix}/ should return 201 Created`);
        assert(json?.success === true, "Response envelope should have success: true");
        assert(json?.data?.id !== undefined, "Created record must have an id");

        if (config?.timestamps) {
          assert(json?.data?.createdAt !== undefined, "Record should include createdAt timestamp");
          assert(json?.data?.updatedAt !== undefined, "Record should include updatedAt timestamp");
        }

        createdId = json.data.id;
      },
    },

    // 2. POST / (Validation Rejection)
    {
      name: `POST ${pathPrefix}/ - rejects invalid payload with 400 Bad Request`,
      skip: !methods.has("create"),
      fn: async () => {
        const invalidPayload = params.fixtures.invalid !== undefined ? params.fixtures.invalid : {};
        const { status, json } = await req("/", {
          method: "POST",
          body: JSON.stringify(invalidPayload),
        });

        assertEqual(status, 400, `POST ${pathPrefix}/ with invalid payload should return 400 Bad Request`);
        assert(json?.success === false, "Validation failure envelope should have success: false");
        assert(
          json?.error?.code === "VALIDATION_ERROR" || json?.error?.code === "INVALID_INPUT",
          `Error code should be VALIDATION_ERROR or INVALID_INPUT, got: ${json?.error?.code}`
        );
        assert(
          Array.isArray(json?.error?.details || json?.error?.issues),
          "Error envelope should include details or issues array"
        );
      },
    },

    // 3. GET /:id (Detail)
    {
      name: `GET ${pathPrefix}/:id - retrieves record detail by ID`,
      skip: !methods.has("detail"),
      fn: async () => {
        if (createdId === null) {
          if (params.fixtures.existingId !== undefined) {
            createdId = params.fixtures.existingId;
          } else if (methods.has("list")) {
            const listRes = await req("/?limit=1", { method: "GET" });
            if (listRes.status === 200 && Array.isArray(listRes.json?.data) && listRes.json.data.length > 0) {
              createdId = listRes.json.data[0].id;
            }
          }
        }

        assert(createdId !== null, "Cannot test detail without a valid record ID");
        const { status, json } = await req(`/${createdId}`, { method: "GET" });

        assertEqual(status, 200, `GET ${pathPrefix}/:id should return 200 OK`);
        assert(json?.success === true, "GET /:id response envelope should have success: true");
        assertEqual(String(json?.data?.id), String(createdId), "Record ID should match requested ID");
      },
    },

    // 4. GET /:id (Not Found)
    {
      name: `GET ${pathPrefix}/:id - returns 404 NOT_FOUND for non-existent ID`,
      skip: !methods.has("detail"),
      fn: async () => {
        const { status, json } = await req("/99999999", { method: "GET" });

        assertEqual(status, 404, `GET ${pathPrefix}/99999999 should return 404 Not Found`);
        assert(json?.success === false, "404 response should have success: false");
        assert(
          json?.error?.code === "NOT_FOUND" || json?.error?.code === "RECORD_NOT_FOUND",
          `Error code should be NOT_FOUND, got: ${json?.error?.code}`
        );
      },
    },

    // 5. Slug Lookup (GET /:slug/:value)
    {
      name: `GET ${pathPrefix}/:slug/:val - resolves record by slug field`,
      skip: !config?.slugs || config.slugs.length === 0 || !params.slug,
      fn: async () => {
        if (!params.slug) return;
        const { status, json } = await req(`/${params.slug.field}/${params.slug.value}`, { method: "GET" });

        assertEqual(status, 200, `GET ${pathPrefix}/${params.slug.field}/${params.slug.value} should return 200 OK`);
        assert(json?.success === true, "Slug lookup should return success: true");
        if (createdId !== null) {
          assertEqual(String(json?.data?.id), String(createdId), "Slug lookup should resolve the created record ID");
        }
      },
    },

    // 6. PATCH /:id (Update)
    {
      name: `PATCH ${pathPrefix}/:id - updates record attributes`,
      skip: !methods.has("update"),
      fn: async () => {
        if (createdId === null) {
          if (params.fixtures.existingId !== undefined) {
            createdId = params.fixtures.existingId;
          } else if (methods.has("list")) {
            const listRes = await req("/?limit=1", { method: "GET" });
            if (listRes.status === 200 && Array.isArray(listRes.json?.data) && listRes.json.data.length > 0) {
              createdId = listRes.json.data[0].id;
            }
          }
        }

        assert(createdId !== null, "Cannot test update without a valid record ID");
        const { status, json } = await req(`/${createdId}`, {
          method: "PATCH",
          body: JSON.stringify(params.fixtures.update),
        });

        assertEqual(status, 200, `PATCH ${pathPrefix}/:id should return 200 OK`);
        assert(json?.success === true, "PATCH /:id envelope should have success: true");

        for (const [key, expectedValue] of Object.entries(params.fixtures.update)) {
          if (config?.versionControl?.field && key === config.versionControl.field) {
            assertEqual(
              json?.data?.[key],
              Number(expectedValue) + 1,
              `PATCH ${pathPrefix}/:id should increment version field "${key}"`
            );
          } else {
            assertEqual(
              json?.data?.[key],
              expectedValue,
              `PATCH ${pathPrefix}/:id should update field "${key}" to match update fixture`
            );
          }
        }
      },
    },

    // 7. PATCH /:id (Optimistic Concurrency Control)
    {
      name: `PATCH ${pathPrefix}/:id - enforces optimistic concurrency control (OCC)`,
      skip: !methods.has("update") || !config?.versionControl?.field,
      fn: async () => {
        assert(createdId !== null, "Cannot test OCC without a valid record ID");
        const versionField = config!.versionControl!.field;
        const { status, json } = await req(`/${createdId}`, {
          method: "PATCH",
          body: JSON.stringify({
            ...params.fixtures.update,
            [versionField]: 0, // Outdated version
          }),
        });

        assertEqual(status, 409, `PATCH ${pathPrefix}/:id with outdated version should return 409 Conflict`);
        assert(
          json?.error?.code === "OCC_FAILED" || json?.error?.code === "CONFLICT",
          `Error code should be OCC_FAILED or CONFLICT, got: ${json?.error?.code}`
        );
      },
    },

    // 8. GET / (List & Pagination)
    {
      name: `GET ${pathPrefix}/ - lists records with pagination metadata`,
      skip: !methods.has("list"),
      fn: async () => {
        const { status, json } = await req("/?limit=10&page=1", { method: "GET" });

        assertEqual(status, 200, `GET ${pathPrefix}/ should return 200 OK`);
        assert(json?.success === true, "List response envelope should have success: true");
        assert(Array.isArray(json?.data), "Response data should be an array of records");
        assert(typeof json?.meta?.total === "number", "Response meta should contain total count");
        assertEqual(json?.meta?.page, 1, "meta.page should be 1");
        assertEqual(json?.meta?.limit, 10, "meta.limit should be 10");
        assert(typeof json?.meta?.totalPages === "number", "meta.totalPages should be a number");
      },
    },

    // 9. GET / (Pagination Validation Boundaries)
    {
      name: `GET ${pathPrefix}/ - validates pagination inputs (rejects limit=0 or page=0)`,
      skip: !methods.has("list"),
      fn: async () => {
        const resLimit0 = await req("/?limit=0", { method: "GET" });
        assertEqual(resLimit0.status, 400, "GET / with limit=0 should return 400 Bad Request");
        assertEqual(resLimit0.json?.error?.code, "INVALID_PAGINATION", "Error code should be INVALID_PAGINATION");

        const resPage0 = await req("/?page=0", { method: "GET" });
        assertEqual(resPage0.status, 400, "GET / with page=0 should return 400 Bad Request");
        assertEqual(resPage0.json?.error?.code, "INVALID_PAGINATION", "Error code should be INVALID_PAGINATION");
      },
    },

    // 10. GET /?q=... (Search Query)
    {
      name: `GET ${pathPrefix}/?q=... - executes search query`,
      skip: !methods.has("list") || !config?.search || !params.search,
      fn: async () => {
        if (!params.search) return;
        const { status, json } = await req(`/?q=${encodeURIComponent(params.search.query)}`, {
          method: "GET",
        });

        assertEqual(status, 200, `Search request should return 200 OK`);
        assert(json?.success === true, "Search envelope should have success: true");
        if (params.search.expectedMatch) {
          assert(
            json?.data?.some(params.search.expectedMatch),
            "Search results should contain expected record matching criteria"
          );
        }
      },
    },

    // 11. GET /?filter=... (Direct Filtering)
    {
      name: `GET ${pathPrefix}/?filter=... - applies direct and operator filters`,
      skip: !methods.has("list") || !params.filter,
      fn: async () => {
        if (!params.filter) return;
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(params.filter.query)) {
          qs.set(k, String(v));
        }

        const { status, json } = await req(`/?${qs.toString()}`, { method: "GET" });
        assertEqual(status, 200, `Filter request should return 200 OK`);
        assert(json?.success === true, "Filter envelope should have success: true");
        if (params.filter.expectedMatch) {
          assert(
            json?.data?.some(params.filter.expectedMatch),
            "Filtered results should contain expected record matching criteria"
          );
        }
      },
    },

    // 12. PATCH /batch-update
    {
      name: `PATCH ${pathPrefix}/batch-update - batch updates records`,
      skip: !methods.has("batch-update") || !params.batch?.updateData,
      fn: async () => {
        assert(createdId !== null, "Cannot test batch-update without a valid record ID");
        const { status, json } = await req("/batch-update", {
          method: "PATCH",
          body: JSON.stringify({
            ids: [createdId],
            data: params.batch!.updateData,
          }),
        });

        assertEqual(status, 200, `PATCH ${pathPrefix}/batch-update should return 200 OK`);
        assert(json?.success === true, "Batch update envelope should have success: true");
        assert(
          json?.updated !== undefined || json?.data?.count !== undefined,
          "Batch update response should include updated count or record"
        );
      },
    },

    // 13. POST /batch-delete
    {
      name: `POST ${pathPrefix}/batch-delete - batch deletes records`,
      skip: !methods.has("batch-delete") || !methods.has("create"),
      fn: async () => {
        // Create a secondary record to batch delete
        const createRes = await req("/", {
          method: "POST",
          body: JSON.stringify(params.fixtures.valid),
        });
        if (createRes.status === 201) {
          secondId = createRes.json.data.id;
          const { status, json } = await req("/batch-delete", {
            method: "POST",
            body: JSON.stringify({ ids: [secondId] }),
          });

          assertEqual(status, 200, `POST ${pathPrefix}/batch-delete should return 200 OK`);
          assert(json?.success === true, "Batch delete envelope should have success: true");
          assert(
            json?.deleted !== undefined || json?.data?.count !== undefined,
            "Batch delete response should include deleted count"
          );
        }
      },
    },

    // 14. Method Restrictions (Disabled route methods)
    {
      name: `Method Restrictions - rejects disabled route methods with 404 Not Found`,
      skip: !config?.methods || config.methods.length === 5,
      fn: async () => {
        if (!methods.has("create")) {
          const res = await req("/", {
            method: "POST",
            body: JSON.stringify(params.fixtures.valid),
          });
          assert(
            res.status === 404 || res.status === 405,
            `Disabled create should return 404 or 405, got ${res.status}`
          );
        }
        if (!methods.has("update") && createdId) {
          const res = await req(`/${createdId}`, {
            method: "PATCH",
            body: JSON.stringify(params.fixtures.update),
          });
          assert(
            res.status === 404 || res.status === 405,
            `Disabled update should return 404 or 405, got ${res.status}`
          );
        }
        if (!methods.has("delete") && createdId) {
          const res = await req(`/${createdId}`, { method: "DELETE" });
          assert(
            res.status === 404 || res.status === 405,
            `Disabled delete should return 404 or 405, got ${res.status}`
          );
        }
      },
    },

    // 15. Authorization & Scope (403 Forbidden / Inaccessible)
    {
      name: `Authorization - verifies forbidden access for unauthorized credentials`,
      skip: !params.auth?.unauthorizedHeaders && !params.auth?.unauthorizedContext,
      fn: async () => {
        assert(createdId !== null, "Cannot test auth without a valid record ID");
        const { status } = await req(
          `/${createdId}`,
          { method: "GET" },
          params.auth?.unauthorizedHeaders,
          params.auth?.unauthorizedContext
        );

        assert(
          status === 403 || status === 404,
          `Unauthorized request should return 403 Forbidden or 404 Not Found, got ${status}`
        );
      },
    },

    // 16. DELETE /:id (Delete)
    {
      name: `DELETE ${pathPrefix}/:id - deletes record and handles subsequent fetches`,
      skip: !methods.has("delete"),
      fn: async () => {
        assert(createdId !== null, "Cannot test delete without a valid record ID");
        const { status, json } = await req(`/${createdId}`, { method: "DELETE" });

        assertEqual(status, 200, `DELETE ${pathPrefix}/:id should return 200 OK`);
        assert(json?.success === true, "DELETE response envelope should have success: true");

        if (methods.has("detail")) {
          const verifyRes = await req(`/${createdId}`, { method: "GET" });
          assertEqual(
            verifyRes.status,
            404,
            "Subsequent GET /:id after delete should return 404 Not Found"
          );
        }
      },
    },
  ];

  return { testCases, resourceName };
}

/**
 * Automatically executes a comprehensive contract test suite against a Honocube resource.
 *
 * When called inside a test framework (`describe`/`it` in Vitest or Jest), it registers
 * individual test blocks for each capability.
 *
 * Can also be executed programmatically via `testResource.run(resource, params)`.
 */
export function testResource(resourceApp: Hono<any>, params: TestResourceParams): void {
  const { testCases, resourceName } = buildResourceTestCases(resourceApp, params);

  const globalEnv = globalThis as {
    describe?: (name: string, fn: () => void) => void;
    it?: (name: string, fn: () => Promise<void> | void) => void;
  };

  const suiteDescribe = params.suite?.describe ?? globalEnv.describe;
  const suiteIt = params.suite?.it ?? globalEnv.it;

  if (suiteDescribe && suiteIt) {
    suiteDescribe(`[${resourceName}] Automated Contract Suite`, () => {
      for (const tc of testCases) {
        if (!tc.skip) {
          suiteIt(tc.name, tc.fn);
        }
      }
    });
  } else if (suiteIt) {
    for (const tc of testCases) {
      if (!tc.skip) {
        suiteIt(tc.name, tc.fn);
      }
    }
  } else {
    // If called outside test runner, run sequentially
    testResource.run(resourceApp, params).catch((err) => {
      throw err;
    });
  }
}

/**
 * Programmatically runs the complete contract test suite and returns a detailed report.
 */
testResource.run = async function run(
  resourceApp: Hono<any>,
  params: TestResourceParams,
  pathPrefix: string = ""
): Promise<TestExecutionReport> {
  const { testCases } = buildResourceTestCases(resourceApp, params, pathPrefix);
  const results: TestCaseResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    if (tc.skip) continue;
    const start = Date.now();
    try {
      await tc.fn();
      passed++;
      results.push({
        name: tc.name,
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (err: any) {
      failed++;
      results.push({
        name: tc.name,
        passed: false,
        error: err.message,
        durationMs: Date.now() - start,
      });
      throw err;
    }
  }

  return {
    success: failed === 0,
    passed,
    failed,
    tests: results,
  };
};

/**
 * Automatically executes contract test suites across all resources mounted on an API.
 */
export function testApp(apiApp: Hono<any>, params: TestAppParams): void {
  const apiConfig = (apiApp as any)[API_CONFIG];
  const versionPrefix = params.version ?? (apiConfig?.version ? `/${apiConfig.version}` : "");

  const globalEnv = globalThis as {
    describe?: (name: string, fn: () => void) => void;
    it?: (name: string, fn: () => Promise<void> | void) => void;
  };

  const suiteDescribe = params.suite?.describe ?? globalEnv.describe;
  const suiteIt = params.suite?.it ?? globalEnv.it;

  const runAll = () => {
    // Test 404 envelope on unregistered path
    const testUnregistered = async () => {
      const fullPath = cleanPath(versionPrefix, "/unregistered_contract_path_test");
      const res = await apiApp.request(`http://localhost${fullPath}`);
      assertEqual(res.status, 404, `Unregistered path should return 404`);
      const json: any = await res.json().catch(() => null);
      if (json && typeof json === "object") {
        assert(json.success === false, "404 response should have success: false");
      }
    };

    if (suiteIt) {
      suiteIt(`API - returns 404 envelope on unregistered route`, testUnregistered);
    }

    for (const [resourcePath, resourceParams] of Object.entries(params.resources)) {
      const mergedPrefix = cleanPath(versionPrefix, resourcePath);
      const { testCases, resourceName } = buildResourceTestCases(
        apiApp,
        {
          ...resourceParams,
          headers: { ...(params.headers ?? {}), ...(resourceParams.headers ?? {}) },
          context: { ...(params.context ?? {}), ...(resourceParams.context ?? {}) },
        },
        mergedPrefix
      );

      if (suiteDescribe && suiteIt) {
        suiteDescribe(`[${resourceName}] at ${mergedPrefix}`, () => {
          for (const tc of testCases) {
            if (!tc.skip) {
              suiteIt(tc.name, tc.fn);
            }
          }
        });
      } else if (suiteIt) {
        for (const tc of testCases) {
          if (!tc.skip) {
            suiteIt(tc.name, tc.fn);
          }
        }
      }
    }
  };

  if (suiteDescribe) {
    suiteDescribe(`[Honocube API] Contract Suite`, runAll);
  } else {
    runAll();
  }
}

/**
 * Programmatically runs the testApp contract suite and returns a detailed report.
 */
testApp.run = async function run(
  apiApp: Hono<any>,
  params: TestAppParams
): Promise<TestExecutionReport> {
  const apiConfig = (apiApp as any)[API_CONFIG];
  const versionPrefix = params.version ?? (apiConfig?.version ? `/${apiConfig.version}` : "");

  const allResults: TestCaseResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;

  for (const [resourcePath, resourceParams] of Object.entries(params.resources)) {
    const mergedPrefix = cleanPath(versionPrefix, resourcePath);
    const report = await testResource.run(
      apiApp,
      {
        ...resourceParams,
        headers: { ...(params.headers ?? {}), ...(resourceParams.headers ?? {}) },
        context: { ...(params.context ?? {}), ...(resourceParams.context ?? {}) },
      },
      mergedPrefix
    );

    totalPassed += report.passed;
    totalFailed += report.failed;
    allResults.push(...report.tests);
  }

  return {
    success: totalFailed === 0,
    passed: totalPassed,
    failed: totalFailed,
    tests: allResults,
  };
};

/**
 * Aliases matching the Honocube define* convention.
 */
export const defineTestResource = testResource;
export const defineTestApp = testApp;
