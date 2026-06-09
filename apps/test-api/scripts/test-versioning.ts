import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { DrizzleAdapter, createApp } from '@honocube/api';
import * as schema from '../db/schema';
import { z } from 'zod';

const app = new Hono();
const client = createClient({ url: 'file:database.sqlite' });
const db = drizzle(client, { schema });
const adapter = new DrizzleAdapter(db, { dialect: 'sqlite' });

const { defineResource, defineApi } = createApp({ adapter });

const productsResource = defineResource({
  name: 'products',
  queryKey: 'products',
  table: schema.products,
  validator: z.object({
    name: z.string(),
    price: z.number(),
    createdAt: z.string().default(() => new Date().toISOString())
  }),
});

// Create a v1 API
const apiV1 = defineApi({
  products: productsResource,
}, 'v1'); 

app.route('/', apiV1); // <--- Mount at root

// Debug: List all routes
console.log('--- MOUNTED ROUTES ---');
app.routes.forEach(r => console.log(`${r.method} ${r.path}`));
console.log('----------------------');

const server = serve({
  fetch: app.fetch,
  port: 3011
});

async function runTest() {
  console.log('🚀 Starting API Versioning Test...\n');
  const BASE_URL = 'http://localhost:3011';

  try {
    console.log('📦 1. Attempting to fetch products via /v1/products...');
    let res = await fetch(`${BASE_URL}/v1/products`);
    
    if (res.status === 404) {
      console.log('⚠️ /v1/products 404ed, trying with trailing slash...');
      res = await fetch(`${BASE_URL}/v1/products/`);
    }

    if (res.status === 200) {
       const data = await res.json();
       console.log('✅ Success! Versioned route is accessible.');
    } else {
       throw new Error(`Failed: Versioned route returned status ${res.status}.`);
    }

    console.log('\n🚫 2. Attempting to fetch products via legacy /products (Should 404)...');
    const resLegacy = await fetch(`${BASE_URL}/products`);
    if (resLegacy.status === 404) {
       console.log('✅ Success! Legacy unversioned route is correctly blocked.');
    } else {
       throw new Error("Failed: Legacy unversioned route should have 404'd.");
    }

    console.log('\n✨ API Versioning tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    server.close();
  }
}

setTimeout(runTest, 500);
