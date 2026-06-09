# Testing Roadmap

This document outlines the requirements and implementation plan for the `@honocube/api` testing suite.

## Description
The core `@honocube/api` package currently lacks a formal testing suite. To ensure long-term stability and prevent regressions as the framework grows, we need to implement a robust testing infrastructure and comprehensive test cases.

## Scope
- **Target:** `packages/api`
- **Infrastructure:** Set up a testing framework (Vitest is recommended for its speed and Hono compatibility).
- **Automation:** Add a `test` script to `packages/api/package.json` and integrate it with the root `turbo.json`.

## Requirements
We need to cover the following areas:
- [ ] **Core Factory:** Test `createApp` to ensure it correctly initializes global config (logger, storage, auth).
- [ ] **Resource Logic:** Test `defineResource` CRUD operations (List, Detail, Create, Update, Delete).
- [ ] **Hook Execution:** Verify that `before/after` hooks are triggered correctly and can modify data.
- [ ] **Security:** Test declarative permissions and Row-Level Security (`authorize` / `scope`).
- [ ] **Adapters:** Unit tests for `DrizzleAdapter` to ensure it maps operations correctly to the database.
- [ ] **Utilities:** Test `processUploads`, `finalize`, and error handling logic.

## Implementation Plan
- Install testing dependencies like `vitest`.
- Create a testing directory or `.test.ts` files alongside the source.
- Configure a test database using SQLite in-memory for speed.
- Implement the test cases outlined in the requirements section.
- Ensure the test suite can be executed from both the package root and the monorepo root.

## Contribution
If you'd like to work on this, please open a PR!
