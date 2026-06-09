import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { DrizzleAdapter, createApp, AppCache } from '@honocube/api';
import * as schema from '../db/schema';
import { z } from 'zod';

const app = new Hono();

const client = createClient({ url: 'file:database.sqlite' });
const db = drizzle(client, { schema });
const adapter = new DrizzleAdapter(db, { dialect: 'sqlite' });

// 1. Implement a simple Mock In-Memory Cache
class MockCache implements AppCache {
  private store = new Map<string, any>();
  public hitCount = 0;
  public missCount = 0;

  async get(key: string) {
    if (this.store.has(key)) {
      this.hitCount++;
      return this.store.get(key);
    }
    this.missCount++;
    return null;
  }

  async set(key: string, value: any) {
    this.store.set(key, value);
  }

  async delete(key: string) {
    this.store.delete(key);
  }

  async clear(prefix: string) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }
}

const cacheProvider = new MockCache();

// 2. Initialize Framework with Cache Provider
const { defineResource, defineApi } = createApp({ 
  adapter,
  cache: cacheProvider
});

const productsResource = defineResource({
  name: 'products',
  queryKey: 'products',
  table: schema.products,
  cache: { enabled: true, ttl: 60 }, // Opt-in to caching
  validator: z.object({
    name: z.string().min(1),
    price: z.number().positive(),
    createdAt: z.string().default(() => new Date().toISOString())
  }),
});

const api = defineApi({
  products: productsResource,
});

app.route('/api', api);

const server = serve({
  fetch: app.fetch,
  port: 3009
});

async function runTest() {
  console.log('🚀 Starting Universal Caching Test...\n');
  const BASE_URL = 'http://localhost:3009/api';

  try {
    // 0. Setup
    await client.execute(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price INTEGER, created_at TEXT NOT NULL)`);

    console.log('📦 1. First Request (Should be a CACHE MISS)...');
    await (await fetch(`${BASE_URL}/products`)).json();
    console.log(`   Miss Count: ${cacheProvider.missCount}, Hit Count: ${cacheProvider.hitCount}`);

    console.log('\n📦 2. Second Request (Should be a CACHE HIT)...');
    await (await fetch(`${BASE_URL}/products`)).json();
    console.log(`   Miss Count: ${cacheProvider.missCount}, Hit Count: ${cacheProvider.hitCount}`);

    if (cacheProvider.hitCount === 1) {
       console.log('✅ Success: Cache hit detected!');
    } else {
       throw new Error("Failed: Cache hit not recorded.");
    }

    console.log('\n🔄 3. Creating a new product (Should INVALIDATE cache)...');
    await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Cache Invalidator', price: 99 }),
    });

    console.log('📦 4. Request after creation (Should be a CACHE MISS again)...');
    await (await fetch(`${BASE_URL}/products`)).json();
    console.log(`   Miss Count: ${cacheProvider.missCount}, Hit Count: ${cacheProvider.hitCount}`);

    if (cacheProvider.missCount === 2) {
       console.log('✅ Success: Cache was correctly invalidated!');
    } else {
       throw new Error("Failed: Cache was not invalidated after mutation.");
    }

    console.log('\n✨ Caching tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    server.close();
  }
}

setTimeout(runTest, 500);
