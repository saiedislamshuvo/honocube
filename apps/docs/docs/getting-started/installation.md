# Installation

Honocube is designed to work within a TypeScript environment, typically as part of a monorepo or a standalone Hono project.

## Prerequisites

- **Node.js:** v18 or higher.
- **Package Manager:** Yarn, NPM, or PNPM.
- **Database:** A database compatible with Drizzle ORM (e.g., SQLite, PostgreSQL, MySQL).

## Setup

First, add the Honocube API package to your project:

```bash
# Inside your API package/app
yarn add @honocube/api
```

### Peer Dependencies

Ensure you have the following peer dependencies installed:

```bash
yarn add hono drizzle-orm zod
```

## Basic Configuration

To start using Honocube, you'll need to initialize your application configuration using `createApp`.

```typescript
import { createApp, DrizzleAdapter } from "@honocube/api";
import { db } from "./db"; // Your Drizzle DB instance

export const { defineResource, defineApi } = createApp({
  adapter: new DrizzleAdapter(db),
  logger: {
    info: (msg) => console.log(msg),
    // ... other logger methods
  },
  // Optional: Context provider for Auth/RLS
  getContext: async (c) => {
    return {
      user: c.get('user'),
    };
  },
});
```

## Folder Structure (Recommended)

While Honocube doesn't enforce a strict folder structure, we recommend organizing your resources like this:

```text
src/
├── resources/
│   ├── users.ts
│   ├── posts.ts
│   └── index.ts
├── db/
│   └── schema.ts
└── index.ts (Entry point)
```

In the next section, we'll see how to [define your first resource](../core-concepts/resources.md).
