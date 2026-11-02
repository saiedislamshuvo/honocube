# Changelog

All notable changes to the HonoCube framework will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.2] - 2026-11-02

### Breaking Changes (from 1.0.8)
- **Peer Dependency Decoupling:** `hono` (`>=4.0.0`), `drizzle-orm` (`>=0.45.0`), and `zod` (`^4.0.0`) are now peer dependencies instead of direct bundled dependencies. This eliminates duplicate library instances in the dependency tree and guarantees that your project's single copy runs.
- **Node.js Engine:** Requires Node.js >= 18.
- **ESM Only:** Package exports ESM modules with strict TypeScript declarations.

### Added
- **Zero-Dependency OpenAPI 3.1 & Interactive Scalar Documentation Engine:**
  - Automated introspection of Drizzle table schemas and Standard Schema (Zod/Valibot/ArkType) validators.
  - Generates full OpenAPI 3.1.0 specification at `/openapi.json` with zero runtime memory allocation (lazy evaluation).
  - Embeds modern, interactive Scalar API Reference viewer at `/docs` via official CDN HTML (zero npm dependencies).
  - Standalone static export function `generateOpenApiSpec()` for CI/CD and SDK code generators.
- **End-to-End Type Safety for Hono Client (`hc`):**
  - Mapped declarative resource configurations to Hono's `Schema` interface (`ResourceSchema`).
  - Native compile-time autocomplete and response inference for `hc<typeof api>("http://localhost")`:
    - Type-checked query filters (`limit`, `sort`, `filter`).
    - Type-checked mutation request bodies (`json: TInsert`).
    - Strongly typed response models (`TSelect[]`, `PaginationMeta`).
    - Full support for versioned route schemas (`v1`, `v2`).
- **Mutation Idempotency Key Engine:**
  - Guarantees exactly-once mutation execution on `POST`, `PATCH`, and `DELETE` via `Idempotency-Key` header.
  - SHA-256 payload fingerprinting to prevent key reuse with modified payloads (`422 IDEMPOTENCY_KEY_MISMATCH`).
  - Concurrent lock resolution with atomic acquisition (`409 IDEMPOTENCY_KEY_LOCKED`).
  - Automatic response caching and cached replay (`Idempotent-Replayed: true`).
  - In-memory `MemoryIdempotencyStorage` and pluggable interface for Redis / Upstash / KV.
- **Distributed Edge Rate Limiting:**
  - High-performance sliding window counter algorithm optimized for edge and serverless runtimes (Cloudflare Workers, Fastly, Bun, Node).
  - Standard RFC 6585 / IETF headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `Retry-After`).
  - In-memory `MemoryRateLimitStore` and pluggable distributed store adapters.
- **Keyset & Cursor Pagination:**
  - O(1) seek performance for large datasets using indexed composite keys.
  - Bidirectional forward and backward seeking (`cursor`, `after`, `before`, `direction`).
  - Automatic tie-breaker ordering on non-unique sort columns for 100% drift protection.
  - Flat response metadata (`meta: { total, limit, nextCursor, prevCursor, hasNext, hasPrev }`).
- **Analytics & Dynamic Aggregations:**
  - Dedicated `GET /aggregate` endpoint supporting analytical functions: `count`, `sum`, `avg`, `min`, `max`.
  - Multi-dimensional grouping (`groupBy`) and time-series date-histogram bucketing (`dateInterval`: `day`, `week`, `month`, `year`).
- **Enterprise Workflows & State Machines:**
  - Declarative transition graphs, initial states, and illegal transition guards (`400 WORKFLOW_INVALID_TRANSITION`).
  - Role-gated state transitions (`roles`).
  - Immutable locked state protection preventing mutations on finalized documents (`lockedStates`).
  - Transition lifecycle side-effect hooks (`onTransition`).
- **Automated Field-Level Audit Trail:**
  - Tracks before/after field deltas across creates, updates, and deletes with actor identity, timestamps, and IP addresses.
  - Resilient, non-blocking execution sink.
- **Transactional Webhook Outbox:**
  - Reliable at-least-once webhook event delivery.
  - Cryptographic HMAC-SHA256 signature verification (`X-Signature-SHA256`).
  - Configurable exponential backoff retry policies.
- **Multi-Tenancy & FLAC / RBAC:**
  - Automatic tenant scoping injecting `tenantId` into read queries and mutations.
  - Field-Level Access Control (FLAC) for conditional hidden fields and read-only constraints.
  - Row-Level Security (RLS) integration with auth providers.
- **Computed Fields & Naming Series:**
  - Declarative virtual fields resolved on query responses.
  - Collision-free sequential document identifier generation (e.g. `INV-2026-00001`).

### Changed
- Migrated manual test scripts into 40 automated Vitest integration test suites (247 tests passing).
- Removed deprecated `apps/test-api` playground.
- Completely redesigned `apps/docs` with 12 enterprise guides and references.
