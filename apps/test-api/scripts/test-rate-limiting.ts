import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { DrizzleAdapter, createApp, RateLimiter } from '@honocube/api';
import * as schema from '../db/schema';
import { z } from 'zod';

const app = new Hono();

const client = createClient({ url: 'file:database.sqlite' });
const db = drizzle(client, { schema });
const adapter = new DrizzleAdapter(db, { dialect: 'sqlite' });

// 1. Implement a simple Mock Rate Limiter
class MockRateLimiter implements RateLimiter {
  private counts = new Map<string, number>();

  async check(key: string, limit: number, window: string) {
    const current = this.counts.get(key) || 0;
    if (current >= limit) return false;
    this.counts.set(key, current + 1);
    return true;
  }
}

const rateLimiterProvider = new MockRateLimiter();

// 2. Initialize Framework with Rate Limiter
const { defineResource, defineApi } = createApp({ 
  adapter,
  rateLimiter: rateLimiterProvider
});

const productsResource = defineResource({
  name: 'products',
  queryKey: 'products',
  table: schema.products,
  rateLimit: { limit: 2, window: '1m' }, // Allow only 2 requests
  validator: z.object({
    name: z.string().min(1),
    price: z.number().positive(),
  }),
});

const api = defineApi({
  products: productsResource,
});

app.route('/api', api);

const server = serve({
  fetch: app.fetch,
  port: 3010
});

async function runTest() {
  console.log('🚀 Starting Universal Rate Limiting Test...\n');
  const BASE_URL = 'http://localhost:3010/api';

  try {
    // 0. Setup
    await client.execute(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price INTEGER, created_at TEXT NOT NULL)`);

    console.log('📦 1. Request 1 (Should be ALLOWED)...');
    const res1 = await fetch(`${BASE_URL}/products`);
    console.log(`   Status: ${res1.status}`);

    console.log('\n📦 2. Request 2 (Should be ALLOWED)...');
    const res2 = await fetch(`${BASE_URL}/products`);
    console.log(`   Status: ${res2.status}`);

    console.log('\n🚫 3. Request 3 (Should be BLOCKED - 429)...');
    const res3 = await fetch(`${BASE_URL}/products`);
    console.log(`   Status: ${res3.status}`);

    if (res3.status === 429) {
       console.log('✅ Success: Rate limit correctly enforced (429)!');
    } else {
       throw new Error(`Failed: Request should have been blocked. Status: ${res3.status}`);
    }

    console.log('\n✨ Rate Limiting tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    server.close();
  }
}

setTimeout(runTest, 500);
