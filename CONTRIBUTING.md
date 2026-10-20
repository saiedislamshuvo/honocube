# Contributing to Honocube

Thanks for taking the time to contribute. This document covers how to get a change
merged.

> **Working with an AI agent?** Read [`AGENTS.md`](./AGENTS.md) instead — it is the
> machine-readable version of this workflow and is what coding agents load
> automatically. The two documents must not contradict each other.

---

## Prerequisites

- **Node.js >= 18**
- **Yarn 1.22** — this repo uses Yarn 1 workspaces, not npm or pnpm

```bash
yarn install
```

## Repository layout

| Path | Purpose |
|---|---|
| `packages/api` | The published framework — `@honocube/api` |
| `apps/docs` | Docusaurus documentation site |
| `apps/test-api` | Manual test playground |
| `packages/ui` | Shared React component library |
| `packages/eslint-config`, `packages/typescript-config` | Shared tooling config |

Turborepo runs the workspace tasks:

```bash
yarn turbo run build
yarn turbo run check-types
yarn turbo run lint
```

## Workflow

**One issue → one branch → one pull request.** Please do not bundle unrelated
changes into a single PR — it makes review much harder and slows everyone down.

### 1. Pick an issue

Browse the [open issues](https://github.com/saiedislamshuvo/honocube/issues). If you
want to work on something that has no issue, open one first — it is a good way to
agree on the approach before writing code.

Comment on the issue to say you are working on it, so two people do not do the same
work twice.

### 2. Branch off `main`

```bash
git fetch origin
git checkout -b feat/issue-<N>-<slug> origin/main
```

Branch naming: `feat/issue-<N>-<slug>` — for example
`feat/issue-3-batch-strategy`.

### 3. Make the change

- Keep the diff focused on the issue. A drive-by refactor in a bug-fix PR is not
  welcome — it hides the real change.
- Match the style of the surrounding code.
- Update the docs in `apps/docs` if you change behaviour.

### 4. Verify

```bash
yarn turbo run build
yarn turbo run check-types
```

Both must pass. Please also verify the behaviour, not just the types.

`apps/test-api/scripts/` contains manual test scripts covering strategies, caching,
permissions, events, versioning and more. If your change touches one of those areas,
run the relevant script:

```bash
cd apps/test-api && npx tsx scripts/test-strategies.ts
```

### 5. Commit

Use `type(scope): summary`, matching the existing history:

| Type | Use for |
|---|---|
| `fix` | Bug fixes |
| `feat` | New behaviour |
| `refactor` | Behaviour-preserving restructuring |
| `docs` | Documentation only |
| `chore` | Tooling, config, dependencies |
| `test` | Tests only |

Scopes: `api`, `docs`, `test-api`, `ui`, `build`, `deps`.

```
fix(api): apply scope and softDelete filters on update and delete
```

### 6. Open the pull request

Push your branch and open a PR against `main`. Use the checklist in the PR template —
it covers what a reviewer will look for.

Reference the issue with `Closes #<N>` so it closes automatically on merge.

## Review

A maintainer will review your PR. Expect questions — that is normal and not a sign of
a problem.

If you are an AI agent: **stop once the PR is open.** Do not merge, do not publish,
and do not change version numbers. Those are human decisions.

## Release process

Releases are handled by the maintainer. For context:

- **1.0.8** is published on npm and remains available.
- **2.0.0** is the next release. It moves `hono`, `zod` and `drizzle-orm` to peer
  dependencies, so consumers need `hono >=4.0.0`, `zod ^4.0.0` and
  `drizzle-orm >=0.45.0` in their own project.

## Reporting bugs

Open an issue with:

- What you expected, and what happened instead
- A minimal reproduction if you have one
- The versions of `@honocube/api`, `hono`, `zod`, `drizzle-orm` and your database
  driver

Security issues: please do not open a public issue. Contact the maintainer directly
instead.
