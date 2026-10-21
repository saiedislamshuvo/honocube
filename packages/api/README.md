# Honocube

Honocube is a lightweight, type-safe resource framework built on top of [Hono](https://hono.dev/) and [Drizzle ORM](https://orm.drizzle.team/). It allows you to rapidly build robust RESTful APIs with minimal boilerplate while maintaining full control over your business logic.

## Motivation

Building APIs often involves repetitive tasks: setting up CRUD endpoints, handling pagination, filtering, searching, file uploads, and permissions. Honocube abstracts these patterns into a declarative "Resource" model, allowing you to focus on what makes your application unique.

## Key Features

- **🔋 Battery-included CRUD:** Automatic list, detail, create, update, and delete endpoints.
- **🛡️ Type Safety:** End-to-end TypeScript support with Zod validation.
- **🔌 Adapter Architecture:** Currently optimized for Drizzle ORM, with a flexible base for other adapters.
- **📁 Integrated Uploads:** Seamlessly handle file uploads and associate them with your records.
- **🔐 Granular Auth:** Declarative permission strings and functional Row-Level Security (RLS).
- **🚀 Performance:** Built on Hono, the fastest web framework for the edge.
- **📦 Relations & Pivots:** First-class support for `one-to-one`, `one-to-many`, and `many-to-many` (pivot) relationships.
- **🔍 Advanced Querying:** Built-in support for search, filtering, and pagination.

## Architecture at a Glance

Honocube operates on three main levels:

1.  **App Config (`createApp`):** Define global behaviors like database adapters, storage providers, authentication logic, and global middleware.
2.  **Resources (`defineResource`):** Define a single entity (e.g., "Users", "Posts") with its schema, validators, hooks, and relationships.
3.  **API Gateway (`defineApi`):** Group multiple resources into a versioned API.

## Migrating from 1.x

The API surface did not change in 2.0.0 — only the dependency model did. The
[migration guide](https://honocube.com/docs/guides/v2-migration) covers what to install, what to check,
and what to do when a peer dependency is missing.

## Peer Dependencies

As of v2.0.0, Honocube no longer bundles its own copy of Hono, Zod, or Drizzle ORM. They are declared as
**peer dependencies**, which means **your** installed versions are the ones that run — no duplicate copies,
no version conflicts, and no risk of two different Hono or Zod instances in the same process.

```bash
npm install @honocube/api hono zod drizzle-orm
```

| Package     | Peer range         | Notes                                                     |
| ----------- | ------------------ | --------------------------------------------------------- |
| `hono`      | `>=4.0.0`          | The version you mount your API with.                      |
| `zod`       | `^4.0.0`           | The version your resource validators are built with.      |
| `drizzle-orm` | `>=0.45.0`      | The version your tables and adapter are built with.       |

If you are on npm 7+ or Yarn 2+, these are installed automatically if missing. With Yarn 1 they are not —
install them yourself.

## Development

This directory contains the source code for the Honocube framework itself.

### Running Locally

```bash
# From the root of the monorepo
yarn install
yarn build
```

The compiled output is written to `dist/`.

### Checking Types

```bash
yarn workspace @honocube/api check-types
```

---

For full documentation, visit [honocube.com](https://honocube.com) or run the docs site locally with
`yarn dev` from the repository root.
