# Migrating from 1.x to 2.0

`@honocube/api` 2.0.0 changes **how the package gets its dependencies**. The API itself did not change:
`createApp`, `defineResource`, `defineApi`, the config shape, the error envelope and the execution
strategies are the same as in 1.x.

If your project already installs `hono`, `zod` and `drizzle-orm` itself, upgrading is a version bump.

## What changed

| | 1.x | 2.0.0 |
| :--- | :--- | :--- |
| `hono`, `zod`, `drizzle-orm` | `dependencies` — the package installed a copy of its own | `peerDependencies` — **your** installed copy is the one that runs |
| `prettier`, `turbo`, `typescript` | shipped as runtime dependencies | not published any more — they were build tools |
| `exports` map | none | `.` with the `types` condition first, plus a `"./*": "./*"` catch-all |
| `sideEffects` | not declared | `false` |
| `engines.node` | not declared | `>=18` |
| Module format | ESM only | ESM only (unchanged) |

### Why the dependency model changed

In 1.x, `@honocube/api` depended on `hono`, `zod` and `drizzle-orm`. When the version your project
had did not satisfy the range of the package, the package manager installed a **second copy** inside
`node_modules/@honocube/api/node_modules`. Two copies of Hono or of Zod in one process are two
different classes, and an `instanceof` check against one of them fails against the other — the kind of
bug that is very hard to trace back to the dependency tree.

With peer dependencies there is exactly one copy, and it is yours.

## What did not change

- `createApp`, `defineResource`, `defineApi` and every option of a resource.
- The error envelope: `{ success: false, error: { code, message, details } }`.
- The response envelope and the pagination metadata.
- The execution strategies: `batch`, `transaction` and `none`.
- The routes a resource generates.

Existing 1.x code continues to work as it is.

## Your `package.json`, before and after

**Before (1.x)** — the peers were installed with the package, so they were not in your own manifest:

```json
{
  "dependencies": {
    "@honocube/api": "^1.0.8"
  }
}
```

**After (2.0.0)** — the peers are declared in your own manifest, because the package no longer
installs them:

```json
{
  "dependencies": {
    "@honocube/api": "^2.0.0",
    "hono": "^4.0.0",
    "drizzle-orm": "^0.45.2"
  }
}
```

`zod` is an **optional** peer dependency in 2.0.0: the framework validates with the
[Standard Schema](https://standardschema.dev) protocol, so it only needs `zod` if your own resources
use it. A project that validates with Valibot or with ArkType does not have to install `zod` at all.

## Steps to upgrade

1. **Install the peers in your own project.**

   ```bash
   npm install hono drizzle-orm
   ```

   `zod` only if you use it. npm 7+ installs missing peers automatically; Yarn 1 does not — see
   [Troubleshooting](#troubleshooting).

2. **Check the version floors.** `hono >= 4.0.0`, `drizzle-orm >= 0.45.0`, `zod ^4.0.0`.

3. **Dedupe.** After the upgrade, one copy of each of them should be in your lockfile:

   ```bash
   npm dedupe
   # or
   yarn-deduplicate
   ```

4. **Use Node 18 or newer.**

5. **Run your tests.** The API surface did not change, so a failure after the upgrade is almost always
   a missing peer or a duplicated one.

## Troubleshooting

### `unmet peer dependency`

npm 7+ installs a missing peer dependency and tells you about it. Yarn 1 does not — it only warns, and
the import fails at runtime. Install the peers yourself:

```bash
yarn add hono drizzle-orm
```

### `Cannot find module 'hono'` / `Cannot find module 'drizzle-orm'`

The peer is missing from your project. The framework does not bundle them, so they have to be there.

### The same library is loaded twice

```
Cannot read properties of undefined (reading 'prototype')
```

or a validation that suddenly stops rejecting anything. A second copy of `hono` or `zod` in the tree
means two different classes, and an `instanceof` check in your own code — or in a library you use —
fails against the other copy. Dedupe the tree, or pin the offending dependency with a resolution.

### A validator that is not a Zod schema

In 1.x the framework only understood Zod schemas. In 2.0.0 it understands any
[Standard Schema](https://standardschema.dev) validator — Zod 3.25+, Zod 4, Valibot, ArkType, or one
of your own. A Zod schema keeps working unchanged:

```typescript
validator: z.object({ email: z.string().email() })
```

A schema of another library is used the same way. One thing to know: the update of a **single** schema
is a partial of it, and only Zod can produce a partial of itself. With another library, declare a
separate `update` schema:

```typescript
validator: {
  create: v.object({ email: v.string(), name: v.string() }),
  update: v.object({ name: v.optional(v.string()) }),
}
```

### A deep import no longer resolves

2.0.0 adds an `exports` map. The catch-all `"./*": "./*"` keeps the deep imports of the `dist`
directory working, and `./package.json` is exported explicitly. If you import the package by a path
that is not part of the published files, import it from the root instead:

```typescript
import { createApp, DrizzleAdapter, ApiError } from "@honocube/api";
```

## Is 1.x deprecated?

1.x stays installable and keeps working. The `npm deprecate` notice of `1.x` points at this page — it
is a notice, not a removal. Nothing is taken down.

## Related

- [Validation & Error Handling](./validation-errors.md)
- [Installation](../getting-started/installation.md)
