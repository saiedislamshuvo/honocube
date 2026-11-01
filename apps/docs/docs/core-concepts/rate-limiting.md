# Distributed Edge Rate Limiting

HonoCube includes a built-in **Sliding Window Counter Rate Limiter** optimized for Edge runtimes (Cloudflare Workers, Fastly Compute, Node, Bun, Deno) and traditional server environments.

It prevents API abuse, protects database connections, and automatically emits standard RFC 6585 / IETF rate limiting headers.

---

## Configuration

Enable rate limiting directly on a resource:

```typescript
import { MemoryRateLimitStore } from "@honocube/api";

export const authResource = defineResource({
  name: "auth",
  table: authTable,
  rateLimit: {
    limit: 60,              // Max requests allowed per window
    window: "1m",           // Time window ("1s", "1m", "1h", "1d")
    keyGenerator: (c) => {  // Partition by IP or authenticated user
      return c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "anonymous";
    },
    store: new MemoryRateLimitStore(), // In-memory or distributed store
  },
});
```

---

## Standard Rate Limit Headers

Every response automatically includes standard headers:

| Header | Example | Description |
| :--- | :--- | :--- |
| `RateLimit-Limit` | `60` | The maximum number of requests allowed in the window. |
| `RateLimit-Remaining` | `42` | The number of remaining requests allowable in the current window. |
| `RateLimit-Reset` | `18` | Seconds remaining until the rate limit window completely resets. |

### When Limits are Exceeded

When a client surpasses the allowed threshold, HonoCube immediately short-circuits the request with `429 Too Many Requests`:

```http
HTTP/1.1 429 Too Many Requests
RateLimit-Limit: 60
RateLimit-Remaining: 0
RateLimit-Reset: 14
Retry-After: 14
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Rate limit exceeded. Please retry in 14 seconds."
  }
}
```

---

## Distributed Storage (Redis / Upstash / KV)

For multi-region deployments, provide a distributed store conforming to `RateLimitStore`:

```typescript
import type { RateLimitStore } from "@honocube/api";
import { Redis } from "@upstash/redis";

export class UpstashRateLimitStore implements RateLimitStore {
  constructor(private redis: Redis) {}

  async increment(key: string, windowMs: number): Promise<{ count: number; resetMs: number }> {
    // Sliding window or token bucket implementation
    const now = Date.now();
    const count = await this.redis.incr(`rate:${key}`);
    if (count === 1) {
      await this.redis.pexpire(`rate:${key}`, windowMs);
    }
    const ttl = await this.redis.pttl(`rate:${key}`);
    return { count, resetMs: ttl > 0 ? ttl : windowMs };
  }
}
```
