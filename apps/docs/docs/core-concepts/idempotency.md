# Mutation Idempotency Engine

Network requests can fail unexpectedly—a client may send a payment or order request, the server executes the mutation, but a network disconnect prevents the response from reaching the client. When the client retries, without idempotency controls, the user might be billed twice or create duplicate records.

HonoCube provides an enterprise **Mutation Idempotency Engine** that guarantees mutations (`POST`, `PATCH`, `DELETE`) with an `Idempotency-Key` header are executed **exactly once**.

---

## Configuration

Enable idempotency in your resource:

```typescript
import { MemoryIdempotencyStorage } from "@honocube/api";

export const paymentsResource = defineResource({
  name: "payments",
  table: paymentsTable,
  idempotency: {
    enabled: true,
    header: "Idempotency-Key", // Header name (default: "Idempotency-Key")
    ttl: "24h",                 // Cache retention duration (default: "24h")
    storage: new MemoryIdempotencyStorage(), // Default: MemoryIdempotencyStorage
  },
});
```

---

## How It Works

When a mutation request arrives with an `Idempotency-Key` header:

```http
POST /payments
Idempotency-Key: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d
Content-Type: application/json

{
  "amount": 49.99,
  "currency": "USD"
}
```

1. **Atomic Lock Resolution**:
   - The engine attempts to claim the key in the storage backend.
   - If another request with the same key is currently running, HonoCube immediately responds with `409 IDEMPOTENCY_KEY_LOCKED`.

2. **Payload Fingerprinting**:
   - Computes a SHA-256 hash of the request body and HTTP method.
   - If a subsequent request arrives with the same `Idempotency-Key` but different payload, HonoCube rejects it with `422 IDEMPOTENCY_KEY_MISMATCH` to prevent malicious tampering or accidental key reuse.

3. **Cached Response Replay**:
   - Once the original request succeeds, the response body and status code are persisted for the duration of the configured `ttl`.
   - Any duplicate request during the TTL window receives the identical cached response with the `Idempotent-Replayed: true` header attached.

4. **Error Recovery**:
   - If the request fails with an unhandled `500 Internal Server Error`, the in-flight lock is cleanly released so the client can safely retry.

---

## Distributed Storage (Redis / KV)

For multi-instance deployments (such as Kubernetes or Cloudflare Workers), implement the `IdempotencyStorage` interface:

```typescript
import type { IdempotencyStorage, IdempotencyRecord } from "@honocube/api";
import { Redis } from "ioredis";

export class RedisIdempotencyStorage implements IdempotencyStorage {
  constructor(private redis: Redis) {}

  async get(key: string): Promise<IdempotencyRecord | null> {
    const data = await this.redis.get(`idemp:${key}`);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, record: IdempotencyRecord, ttlSeconds: number): Promise<void> {
    await this.redis.set(`idemp:${key}`, JSON.stringify(record), "EX", ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(`idemp:${key}`);
  }
}
```
