# OpenAPI & Scalar Documentation

HonoCube includes a built-in, zero-dependency **OpenAPI 3.1.0 specification generator** and an interactive **Scalar API Reference** viewer.

It generates standard OpenAPI metadata by introspecting your Drizzle tables and Standard Schema (Zod, Valibot, ArkType) validators—requiring zero duplicate route schemas or JSDoc annotations.

---

## Quick Setup

Enable documentation in `defineApi` with a single configuration option:

```typescript
import { createApp, DrizzleAdapter, defineApi } from "@honocube/api";
import { postsResource, usersResource } from "./resources";

export const api = defineApi(
  {
    posts: postsResource,
    users: usersResource,
  },
  {
    docs: {
      path: "/docs",            // Interactive Scalar UI endpoint
      specPath: "/openapi.json", // Raw OpenAPI 3.1 JSON endpoint
      title: "My Application API",
      version: "2.0.2",
      description: "Production API services built with HonoCube",
    },
  }
);
```

When you start your server:
- Open `http://localhost:3000/docs` to view the interactive Scalar dashboard with instant request testing and schema explorer.
- Fetch `http://localhost:3000/openapi.json` to inspect the raw OpenAPI 3.1.0 JSON document.

---

## Configuration Options

Pass an object to `docs` in `defineApi`:

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enabled` | `boolean` | `true` | Set to `false` to disable docs in production or testing. |
| `path` | `string` | `"/docs"` | The path where the interactive Scalar UI is served. |
| `specPath` | `string` | `"/openapi.json"` | The path where the OpenAPI JSON schema is served. |
| `title` | `string` | `"HonoCube API"` | The title displayed in the API documentation. |
| `version` | `string` | `"2.0.2"` | The semantic API version in the OpenAPI metadata. |
| `description`| `string` | `undefined` | High-level summary of the API. |
| `specUrl` | `string` | `undefined` | External URL (e.g., CDN or S3) to load the spec from instead of generating locally. |
| `include` | `string[]` | `undefined` | Whitelist specific resource keys to document, omitting internal tables. |

You can also pass `docs: true` as a shorthand to enable documentation with default settings.

---

## What Gets Documented Automatically

HonoCube inspects your resource configuration and generates:

1. **Operations**:
   - `GET /` — List records (documents pagination, sorting, search `q`, and allowed filter fields).
   - `POST /` — Create record (documents request body schema and `Idempotency-Key` header).
   - `GET /:id` — Get single record with path parameter `{id}`.
   - `PATCH /:id` — Update record with partial validator schema.
   - `DELETE /:id` — Delete record.
   - `GET /aggregate` — Documented if `aggregate.enabled` is configured.
   - `PATCH /batch-update` and `POST /batch-delete` — Documented if batch methods are allowed.

2. **Schemas (`components.schemas`)**:
   - **Data Models**: Inferred directly from Drizzle table columns (`text` → `string`, `integer` → `integer`, `timestamp` → `date-time`, etc.).
   - **Request Bodies**: Inferred from your `validator` (Standard Schema / Zod).
   - **Envelopes**: Standard success envelopes and `{ success: false, error: { code, message, details } }`.
   - **Pagination**: `PaginationMeta` (`total`, `limit`, `nextCursor`, `hasNext`, etc.).

3. **Enterprise Headers**:
   - `Idempotency-Key` (in request) and `Idempotent-Replayed` (in response) when idempotency is enabled.
   - `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` when rate limiting is enabled.

---

## Zero Startup Overhead & Edge Memory Safety

### Lazy Spec Generation
To prevent boot latency or memory spikes in serverless environments (Cloudflare Workers, AWS Lambda, Vercel Edge):
- The OpenAPI specification is **lazily generated** on the very first request to `/openapi.json`.
- Standard API requests (`POST /orders`, `GET /users`) never trigger the documentation generator and incur 0ms overhead.

### Static CDN Mode
In ultra-constrained environments, you can host your `openapi.json` statically on a CDN and instruct the Scalar UI to point directly to it:

```typescript
export const api = defineApi(resources, {
  docs: {
    specUrl: "https://cdn.example.com/specs/v2.0.2/openapi.json",
  },
});
```
When `specUrl` is provided, HonoCube does not compute or store any OpenAPI schema in server RAM.

---

## Static Export for CI/CD & SDK Generation

If you need a physical `openapi.json` file for client code generators (such as OpenAPI TypeScript, Orval, or Swagger CLI):

```typescript
import { generateOpenApiSpec } from "@honocube/api";
import { postsResource, usersResource } from "./resources";
import fs from "node:fs";

const spec = generateOpenApiSpec({
  posts: postsResource,
  users: usersResource,
}, {
  title: "My Application API",
  version: "2.0.2",
});

fs.writeFileSync("openapi.json", JSON.stringify(spec, null, 2));
console.log("Successfully exported openapi.json");
```
