# @honocube/api

Honocube is an enterprise-grade, lightweight, type-safe resource framework built on top of [Hono](https://hono.dev/) and [Drizzle ORM](https://orm.drizzle.team/). It allows you to rapidly build production-ready RESTful APIs with zero boilerplate while maintaining full control over your business logic.

---

## Key Features

- **🔋 Battery-Included CRUD:** Automatic `list`, `detail`, `create`, `update`, `delete`, and atomic batch endpoints.
- **🛡️ End-to-End Type Safety:** Deep TypeScript inference with Standard Schema (Zod, Valibot, ArkType) and Hono `hc` RPC client support.
- **📖 Built-in OpenAPI 3.1 & Scalar Docs:** Zero-dependency, zero-memory lazy schema generator (`/openapi.json`) and interactive documentation UI (`/docs`).
- **⚡ Keyset & Cursor Pagination:** O(1) seeking with composite tie-breakers, bidirectional navigation, and drift protection.
- **🔁 Mutation Idempotency:** Payload fingerprinting, atomic concurrency lock resolution, and replay with `Idempotency-Key`.
- **🛡️ Distributed Edge Rate Limiting:** Sliding window counter algorithm with standard RFC 6585 headers (`RateLimit-*`, `Retry-After`).
- **📊 Analytics & Aggregations:** Dynamic metrics (`count`, `sum`, `avg`, `min`, `max`), grouping, and date-histogram bucketing.
- **🔀 Workflows & State Machines:** Declarative state transitions, role gating, and locked document protection.
- **📝 Audit Trail & Webhook Outbox:** Automated field-level diff tracking and HMAC-signed transactional outbox webhooks.
- **🏢 Multi-Tenancy & FLAC/RBAC:** Tenant scoping, Field-Level Access Control, and Row-Level Security.

---

## Quick Start

### 1. Installation

```bash
npm install @honocube/api hono drizzle-orm
```

### 2. Define Resources & API Gateway

```typescript
import { createApp, DrizzleAdapter, defineApi } from "@honocube/api";
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { z } from "zod";

// Drizzle schema
export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  content: text("content"),
});

// App initialization
export const app = createApp({
  adapter: new DrizzleAdapter(db),
});

// Resource definition
export const postsResource = app.defineResource({
  name: "posts",
  table: posts,
  validator: z.object({
    title: z.string().min(3),
    content: z.string().optional(),
  }),
  pagination: { type: "both" },
  idempotency: { enabled: true },
  rateLimit: { limit: 100, window: "1m" },
  aggregate: { enabled: true },
});

// API Gateway with Interactive Documentation
export const api = app.defineApi(
  { posts: postsResource },
  {
    docs: {
      path: "/docs",            // Interactive Scalar UI
      specPath: "/openapi.json", // Raw OpenAPI 3.1 JSON
      title: "My Application API",
      version: "2.0.2",
    },
  }
);
```

### 3. Type-Safe Client via Hono RPC (`hc`)

```typescript
import { hc } from "hono/client";
import type { api } from "./server";

const client = hc<typeof api>("http://localhost:3000");

// Fully typed queries, inputs, and response models:
const res = await client.posts.$get({ query: { limit: "10" } });
const json = await res.json();
console.log(json.data); // Post[]
```

---

## Peer Dependencies

As of v2.0.0, `@honocube/api` declares Hono, Zod, and Drizzle ORM as **peer dependencies**, ensuring that your application's single copy runs with zero duplicate class collisions:

| Package | Peer range | Notes |
| :--- | :--- | :--- |
| `hono` | `>=4.0.0` | Web framework and routing engine. |
| `drizzle-orm` | `>=0.45.0` | ORM tables and database dialect adapter. |
| `zod` | `^4.0.0` | **Optional.** Used only if your resource validators use Zod. |

---

## Documentation

For guides, concepts, and recipes, visit [honocube.com](https://honocube.com) or explore [`apps/docs`](https://github.com/saiedislamshuvo/honocube/tree/main/apps/docs).

---

## License

MIT © [Saied Islam Shuvo](https://github.com/saiedislamshuvo)
