# API Gateway

Once you have defined your resources, you can group them into a single Hono application using `defineApi`.

## Registering Resources

`defineApi` takes an object where the keys are the base paths for each resource.

```typescript
import { defineApi } from "../honocube";
import { usersResource } from "./users";
import { postsResource } from "./posts";

export const api = defineApi({
  users: usersResource,
  posts: postsResource,
});
```

This will create a Hono instance with the following routing structure:
- `/users/*` (mounted with `usersResource` apps)
- `/posts/*` (mounted with `postsResource` apps)

## Versioning & Options

You can provide either a version string or an options object to configure route prefixing and automated API documentation:

```typescript
export const v1Api = defineApi({
  users: usersResource,
}, "v1");
```
Resulting path: `/v1/users`

### Automated OpenAPI & Scalar Documentation

You can also pass an options object with `docs`:

```typescript
export const api = defineApi(
  {
    users: usersResource,
    posts: postsResource,
  },
  {
    version: "v1", // Optional prefix
    docs: {
      path: "/docs",            // Interactive Scalar UI
      specPath: "/openapi.json", // Raw OpenAPI 3.1 JSON
      title: "My Application API",
      version: "2.0.2",
    },
  }
);
```

For more details, see the [OpenAPI & Scalar Documentation](./openapi-docs.md) guide.

## End-to-End Type Safety with Hono Client (`hc`)

HonoCube's `defineApi` automatically maps and merges standard Hono schema types across all mounted resources, enabling 100% compile-time type-safe RPC using Hono's official client (`hc`):

```typescript
import { hc } from "hono/client";
import type { api } from "./server";

const client = hc<typeof api>("https://api.example.com");

// Query parameters, paths, and response envelopes are fully inferred!
const res = await client.posts.$get({ query: { limit: "20" } });
const json = await res.json();
console.log(json.data); // Strongly typed as Post[]!

// Type-checked request bodies on mutations:
await client.posts.$post({
  json: { title: "New Blog Post" },
});

// Versioned APIs (e.g. defineApi(resources, "v1")):
const v1Res = await client.v1.posts.$get();
```

## Mounting to a Main App

The result of `defineApi` is a standard Hono instance, so you can mount it to your main server application easily.

```typescript
import { Hono } from "hono";
import { api } from "./resources";

const app = new Hono();

// Mount the Honocube API
app.route("/api", api);

export default app;
```

## Custom Global Middleware

Since the gateway is just a Hono app, you can apply global middleware (like CORS or Auth) before mounting the resources.

```typescript
import { cors } from "hono/cors";

const api = defineApi({ ... });
api.use("*", cors());
```

---

Congratulations! You've learned the core concepts of Honocube. For more specific patterns, check out the [Guides](../guides/custom-actions.md).
