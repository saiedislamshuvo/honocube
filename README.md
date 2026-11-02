# Honocube Monorepo

Honocube is an enterprise-grade, lightweight, type-safe resource framework built on top of [Hono](https://hono.dev/) and [Drizzle ORM](https://orm.drizzle.team/).

## Project Structure

This monorepo is managed by [Turborepo](https://turbo.build/) and [Yarn Workspaces](https://yarnpkg.com/features/workspaces).

### Apps

- **`apps/docs`**: The comprehensive documentation site built with [Docusaurus](https://docusaurus.io/).

### Packages

- **`packages/api`**: The core published framework (`@honocube/api`).
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

### Development & Documentation

Start the documentation site locally:

```bash
yarn dev
```

- **Docs**: [http://localhost:3000](http://localhost:3000)

### Testing

Run the automated integration test suite across all features:

```bash
yarn test
```

### Build

Build all packages and applications:

```bash
node node_modules/turbo/bin/turbo run build
```

## Documentation

For full documentation and enterprise guides, visit [honocube.com](https://honocube.com) or explore [`apps/docs`](./apps/docs).

---

Built with 🧡 by [Saied Islam Shuvo](https://github.com/saiedislamshuvo).
