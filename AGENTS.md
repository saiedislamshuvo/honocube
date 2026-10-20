# AGENTS.md

Instructions for AI coding agents (Claude Code, Cursor, Antigravity, Copilot, and any
other tool) working in this repository.

**Read this file completely before making any change.** It is the contract for how work
is done here. If a task seems to conflict with it, stop and ask the human — do not
improvise around a rule.

---

## The one rule that matters most

**Never merge to `main`. Never publish to npm. Never change a version number.**

Your job ends when a pull request is open and the human has been told about it. A
human reviews and merges. Not you.

---

## Repository layout

Turborepo + Yarn 1 workspaces.

| Path | Purpose |
|---|---|
| `packages/api` | The published framework — `@honocube/api`. **This is where most work happens.** |
| `packages/api/src/core/factory.ts` | The entire framework in one ~1,500-line file. Most bugs live here. |
| `packages/api/src/adapters/` | `base.ts` (abstraction) and `drizzle.ts` (Drizzle implementation). |
| `packages/api/src/types.ts` | Public type definitions, including `ResourceConfig`. |
| `packages/api/src/utils/errors.ts` | The `ApiError` envelope — all errors route through here. |
| `apps/docs` | Docusaurus documentation site. |
| `apps/test-api` | Manual test playground. `scripts/*.ts` are **manual** scripts, not an automated suite. |
| `packages/ui`, `packages/eslint-config`, `packages/typescript-config` | Shared tooling. |

The published package is `packages/api`. Everything else is workspace-only.

## Key facts about the package

- It is **ESM only** (`"type": "module"`).
- `hono`, `zod` and `drizzle-orm` are **peer dependencies**. The consumer's copy runs.
  Do not add them to `dependencies`.
- `zod` is a **runtime value** import, not type-only: `z.object()` and
  `instanceof z.ZodType` are used. `instanceof` is copy-sensitive — a second copy of
  zod in the tree breaks it.
- `drizzle-orm` cannot be made an optional peer: `ResourceConfig.table` **is** a
  Drizzle table object, so the framework is Drizzle-coupled at the type level.
- The package ships `dist/` and `dist` is gitignored. `packages/api` must be built
  (`yarn workspace @honocube/api build`) before anything that consumes the built output.

## Toolchain

- **Node >= 18**, **Yarn 1.22** (`yarn`, not `npm` or `pnpm`).
- **TypeScript 6.0.3** across the workspace.
- Turbo tasks: `build`, `check-types`, `lint`, `dev`.

```bash
yarn install                          # install (Yarn 1, not npm)
yarn turbo run build                  # build all
yarn turbo run check-types            # typecheck all
yarn turbo run lint                   # lint all
```

> On Windows, `yarn turbo run build` can fail with a mangled path
> (`E:projectshonocubenode_modules.binturbo: command not found`). That is a shell-shim
> quirk, not a project error. Use `node node_modules/turbo/bin/turbo run build` instead.

---

## Workflow: one issue, one branch, one pull request

**Never bundle two issues into one branch or one PR.** The exception is a
single-purpose tooling change (for example, adding `AGENTS.md`) that is not a fix for
any issue.

### 1. Read the issue — it is the spec

```bash
gh issue view <N>
```

The issue body contains the problem, the exact affected code with **line numbers**,
a proposed fix, and verification notes. Treat it as the specification. If the code has
moved since the issue was filed, the *problem* still stands — adapt the line numbers.

### 2. Branch off `main`

```bash
git fetch origin
git checkout -b feat/issue-<N>-<slug> origin/main
```

Branch naming: `feat/issue-<N>-<slug>` — lower case, hyphenated, `<slug>` is a short
description. Examples: `feat/issue-3-batch-strategy`, `fix/issue-4-last-insert-rowid`.

### 3. Fix exactly one thing

- Change only what the issue describes. A drive-by refactor in a bug-fix PR makes the
  diff unreviewable and is not welcome.
- Match the surrounding code style. Read the file before editing it.
- Do not reformat unrelated code.

### 4. Verify — this is not optional

```bash
yarn turbo run build
yarn turbo run check-types
```

Both must pass. If a change is not verifiable with the tooling available, say so
explicitly in the PR body rather than claiming success.

For `packages/api` specifically, also sanity-check the behaviour, not just the types.
The manual scripts in `apps/test-api/scripts/` can be run for the features they cover:

```bash
cd apps/test-api && npx tsx scripts/test-strategies.ts
```

### 5. Commit

Format: `type(scope): summary` — matching the existing history.

| Type | Use for |
|---|---|
| `fix` | Bug fixes |
| `feat` | New behaviour |
| `refactor` | Behaviour-preserving restructuring |
| `docs` | Documentation only |
| `chore` | Tooling, config, dependencies |
| `test` | Tests only |

Scopes in use: `api`, `docs`, `test-api`, `ui`, `build`, `deps`.

```
fix(api): apply scope and softDelete filters on update and delete
```

### 6. Push and open the pull request

```bash
git push -u origin <branch>
gh pr create --base main --head <branch> \
  --title "fix(api): <summary>" \
  --body "<what changed, why, how it was verified>

Closes #<N>"
```

### 7. Stop

Report the PR URL. **Wait for human review.** Do not merge. Do not continue to the
next issue unless asked.

---

## Forbidden

Do not do any of these. If a task appears to require one, ask the human first.

| Action | Why |
|---|---|
| `git push` to `main` | `main` is reviewed by a human. |
| `gh pr merge` | Merging is the human's job. |
| `npm publish` / `npm deprecate` | Releases are the human's job. |
| Changing `version` in any `package.json` | 2.0.0 is the release version. Set once, at release time, by the human. |
| `git push --delete` / `git branch -D` on shared branches | Deletion is the human's job. |
| `git reset --hard`, `git checkout -- .`, `git clean -fd` | Destroys uncommitted work. |
| Renaming or deleting an existing file | Out of scope for a single-issue PR. |
| Adding `hono`/`zod`/`drizzle-orm` to `dependencies` | They are peers. See above. |
| `yarn.lock` churn unrelated to the change | Noise in the diff. |

## Allowed

- `yarn install`, `yarn turbo run <task>`, builds, typechecks, lint.
- `gh issue view/list`, `gh pr create`, `gh pr view`.
- Creating and pushing your own branch.
- Editing files in the issue's scope.

## Authentication

On the maintainer's machine `gh` and `git push` are already authenticated (system
keyring / Git Credential Manager), so a fresh agent can branch, commit, push and open a
PR with no setup.

On a different machine or a different OS user they will not be. If `gh auth status`
reports no login, ask the human to run `gh auth login` (or set `GH_TOKEN`) rather than
attempting to work around it. `npm publish` requires `npm login` and is a human step
regardless.

---

## Working with issues that are not yet written

If asked to fix something with no GitHub issue, that is fine — but:

1. Create the issue first (`gh issue create`), so the work is tracked and the PR can
   reference it. Write the body the way you would want to read it: the problem, the
   exact affected code with line numbers, a proposed fix, and how to verify.
2. Then branch, fix, and open the PR as normal.

## Current release state

- **1.0.8** is published on npm and remains installable and unchanged. It is *not*
  deprecated.
- **2.0.0** is being prepared. It is the dependency-decoupling release (peer
  dependencies) plus the accumulated fixes. It has **not** been published.
- 2.0.0 is intentionally a breaking change: consumers must have `hono >=4.0.0`,
  `zod ^4.0.0`, `drizzle-orm >=0.45.0` in their own project.

Do not publish, deprecate, tag, or bump versions.
