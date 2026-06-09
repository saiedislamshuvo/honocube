# Honocube Monorepo

Honocube is a lightweight, type-safe resource framework built on top of [Hono](https://hono.dev/) and [Drizzle ORM](https://orm.drizzle.team/).

## Project Structure

This monorepo is managed by [Turborepo](https://turbo.build/) and [Yarn Workspaces](https://yarnpkg.com/features/workspaces).

### Apps

- **`apps/docs`**: The documentation site built with [Docusaurus](https://docusaurus.io/).
- **`apps/test-api`**: A playground for testing Honocube features and performance.

### Packages

- **`packages/api`**: The core Honocube framework.
- **`packages/eslint-config`**: Shared ESLint configurations.
- **`packages/typescript-config`**: Shared TypeScript configurations.
- **`packages/ui`**: Shared React component library.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Yarn](https://yarnpkg.com/) v1.22+

### Installation

```bash
yarn install
```

### Development

Start all applications in development mode:

```bash
yarn dev
```

- **Docs**: [http://localhost:4000](http://localhost:4000)
- **Test API**: [http://localhost:3000](http://localhost:3000)

### Build

Build all packages and applications:

```bash
yarn build
```

## Documentation

For full documentation, please refer to the [Docs App](./apps/docs) or visit the live site at [honocube.dev](https://honocube.dev)

---

Built with 🧡 by [Saied Islam Shuvo](https://github.com/saiedislamshuvo).
