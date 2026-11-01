import type { RateLimitResult, RateLimitStore } from "../types.js";

/**
 * Parses a window specification (string or number) into milliseconds.
 * Supports units: 's' (seconds), 'm' (minutes), 'h' (hours), 'd' (days).
 * E.g., '10s' -> 10000, '1m' -> 60000, '15m' -> 900000, '1h' -> 3600000.
 */
export function parseWindow(window: string | number | undefined): number {
  if (typeof window === "number" && Number.isFinite(window) && window > 0) {
    return window;
  }
  if (typeof window !== "string") {
    return 60_000; // default 1 minute
  }

  const str = window.trim().toLowerCase();
  const match = str.match(/^(\d+(?:\.\d+)?)\s*(s|m|h|d)?$/);
  if (!match) {
    const rawNum = Number(str);
    return Number.isFinite(rawNum) && rawNum > 0 ? rawNum : 60_000;
  }

  const val = parseFloat(match[1]!);
  const unit = match[2];

  switch (unit) {
    case "s":
      return Math.round(val * 1_000);
    case "m":
      return Math.round(val * 60_000);
    case "h":
      return Math.round(val * 3_600_000);
    case "d":
      return Math.round(val * 86_400_000);
    default:
      // If no unit, assume milliseconds if > 1000, otherwise seconds
      return val >= 1_000 ? Math.round(val) : Math.round(val * 1_000);
  }
}

interface MemoryWindowBucket {
  previousCount: number;
  currentCount: number;
  currentWindowStart: number;
}

/**
 * In-memory Sliding Window Counter Rate Limit Store.
 * Provides O(1) memory usage per key and eliminates window boundary burst anomalies.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, MemoryWindowBucket>();

  increment(
    key: string,
    cost: number = 1,
    limit: number,
    windowMs: number
  ): RateLimitResult {
    const now = Date.now();
    const currentWindowStart = Math.floor(now / windowMs) * windowMs;
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        previousCount: 0,
        currentCount: 0,
        currentWindowStart,
      };
      this.buckets.set(key, bucket);
    } else if (bucket.currentWindowStart < currentWindowStart) {
      const elapsedWindows = Math.floor(
        (currentWindowStart - bucket.currentWindowStart) / windowMs
      );
      if (elapsedWindows === 1) {
        bucket.previousCount = bucket.currentCount;
      } else {
        bucket.previousCount = 0;
      }
      bucket.currentCount = 0;
      bucket.currentWindowStart = currentWindowStart;
    }

    const timeIntoCurrentWindow = now - currentWindowStart;
    const weight = Math.max(0, (windowMs - timeIntoCurrentWindow) / windowMs);
    const estimatedCount = bucket.previousCount * weight + bucket.currentCount;

    const reset = Math.max(
      1,
      Math.ceil((currentWindowStart + windowMs - now) / 1000)
    );

    if (estimatedCount + cost > limit) {
      const remaining = Math.max(0, Math.floor(limit - estimatedCount));
      return {
        allowed: false,
        limit,
        remaining,
        reset,
        retryAfter: reset,
      };
    }

    bucket.currentCount += cost;
    const newEstimated = bucket.previousCount * weight + bucket.currentCount;
    const remaining = Math.max(0, Math.floor(limit - newEstimated));

    return {
      allowed: true,
      limit,
      remaining,
      reset,
    };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  clear(): void {
    this.buckets.clear();
  }
}

export const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local cost = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local windowMs = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

local currentWindowStart = math.floor(now / windowMs) * windowMs
local prevWindowKey = key .. ":" .. (currentWindowStart - windowMs)
local currWindowKey = key .. ":" .. currentWindowStart

local prevCount = tonumber(redis.call('get', prevWindowKey) or 0)
local currCount = tonumber(redis.call('get', currWindowKey) or 0)

local timeIntoCurr = now - currentWindowStart
local weight = (windowMs - timeIntoCurr) / windowMs
if weight < 0 then weight = 0 end

local estimated = prevCount * weight + currCount

if (estimated + cost) > limit then
  local resetSeconds = math.ceil((currentWindowStart + windowMs - now) / 1000)
  if resetSeconds < 1 then resetSeconds = 1 end
  local remaining = math.floor(limit - estimated)
  if remaining < 0 then remaining = 0 end
  return { 0, limit, remaining, resetSeconds }
else
  local newCount = redis.call('incrby', currWindowKey, cost)
  if newCount == cost then
    redis.call('pexpire', currWindowKey, windowMs * 2)
  end
  local newEstimated = prevCount * weight + newCount
  local remaining = math.floor(limit - newEstimated)
  if remaining < 0 then remaining = 0 end
  local resetSeconds = math.ceil((currentWindowStart + windowMs - now) / 1000)
  if resetSeconds < 1 then resetSeconds = 1 end
  return { 1, limit, remaining, resetSeconds }
end
`;

/**
 * Creates a distributed sliding window rate limiter backed by Redis.
 * Works with any Redis client supporting eval / call (ioredis, node-redis).
 */
export function createRedisRateLimiter(redisClient: any): RateLimitStore {
  return {
    async increment(
      key: string,
      cost: number,
      limit: number,
      windowMs: number
    ): Promise<RateLimitResult> {
      const now = Date.now();
      let rawResult: any;

      if (typeof redisClient.eval === "function") {
        try {
          rawResult = await redisClient.eval(
            SLIDING_WINDOW_LUA,
            1,
            key,
            cost,
            limit,
            windowMs,
            now
          );
        } catch {
          // Node-redis v4 format fallback
          rawResult = await redisClient.eval(SLIDING_WINDOW_LUA, {
            keys: [key],
            arguments: [
              String(cost),
              String(limit),
              String(windowMs),
              String(now),
            ],
          });
        }
      } else if (typeof redisClient.call === "function") {
        rawResult = await redisClient.call(
          "EVAL",
          SLIDING_WINDOW_LUA,
          1,
          key,
          cost,
          limit,
          windowMs,
          now
        );
      } else {
        throw new Error(
          "Redis client must support 'eval' or 'call' method for atomic sliding window execution."
        );
      }

      const allowed = Boolean(rawResult[0]);
      const limitVal = Number(rawResult[1]);
      const remaining = Number(rawResult[2]);
      const reset = Number(rawResult[3]);

      return {
        allowed,
        limit: limitVal,
        remaining,
        reset,
        retryAfter: allowed ? undefined : reset,
      };
    },

    async reset(key: string): Promise<void> {
      if (typeof redisClient.del === "function") {
        await redisClient.del(key);
      }
    },
  };
}

/**
 * Creates a distributed sliding window rate limiter backed by Upstash Redis.
 * Suitable for edge runtimes (Cloudflare Workers, Vercel Edge, Bun) without persistent TCP sockets.
 * Supports either an Upstash client instance or a { url, token } configuration.
 */
export function createUpstashRateLimiter(
  optionsOrClient: { url: string; token: string } | any
): RateLimitStore {
  if (optionsOrClient && typeof optionsOrClient.eval === "function") {
    return {
      async increment(
        key: string,
        cost: number,
        limit: number,
        windowMs: number
      ): Promise<RateLimitResult> {
        const now = Date.now();
        const rawResult = (await optionsOrClient.eval(
          SLIDING_WINDOW_LUA,
          [key],
          [cost, limit, windowMs, now]
        )) as any[];

        const allowed = Boolean(rawResult[0]);
        const limitVal = Number(rawResult[1]);
        const remaining = Number(rawResult[2]);
        const reset = Number(rawResult[3]);

        return {
          allowed,
          limit: limitVal,
          remaining,
          reset,
          retryAfter: allowed ? undefined : reset,
        };
      },

      async reset(key: string): Promise<void> {
        if (typeof optionsOrClient.del === "function") {
          await optionsOrClient.del(key);
        }
      },
    };
  }

  const { url, token } = optionsOrClient as { url: string; token: string };
  const cleanUrl = url.replace(/\/+$/, "");

  return {
    async increment(
      key: string,
      cost: number,
      limit: number,
      windowMs: number
    ): Promise<RateLimitResult> {
      const now = Date.now();
      const res = await fetch(`${cleanUrl}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["EVAL", SLIDING_WINDOW_LUA, 1, key, cost, limit, windowMs, now],
        ]),
      });

      if (!res.ok) {
        throw new Error(
          `Upstash RateLimiter request failed with HTTP ${res.status}`
        );
      }

      const json = (await res.json()) as any[];
      const evalResult = json[0]?.result;
      if (!Array.isArray(evalResult)) {
        throw new Error(
          `Invalid response format from Upstash: ${JSON.stringify(json)}`
        );
      }

      const allowed = Boolean(evalResult[0]);
      const limitVal = Number(evalResult[1]);
      const remaining = Number(evalResult[2]);
      const reset = Number(evalResult[3]);

      return {
        allowed,
        limit: limitVal,
        remaining,
        reset,
        retryAfter: allowed ? undefined : reset,
      };
    },

    async reset(key: string): Promise<void> {
      await fetch(cleanUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["DEL", key]),
      });
    },
  };
}
