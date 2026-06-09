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

## Development

This directory contains the source code for the Honocube documentation site, built with [Docusaurus](https://docusaurus.io/).

### Running Locally

To start the documentation server in development mode:

```bash
# From the root of the monorepo
yarn dev
```

The site will be available at `http://localhost:4000`.

### Building for Production

To generate the static build:

```bash
# From the root of the monorepo
yarn build --filter=@honocube/docs
```

The output will be in the `build` directory.

---

For full documentation, visit [honocube.sugarcanedev.com](https://honocube.sugarcanedev.com) (once deployed) or run the dev server locally.
