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

const { defineResource, defineApi } = createApp<any>({ adapter });

const productsResource = defineResource({
  name: 'products',
  queryKey: 'products',
  table: schema.products,
  timestamps: true, // Enables auto createdAt/updatedAt injection
  methods: ['create', 'update', 'batch-update', 'detail'],
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
  port: 3007
});

async function runTest() {
  console.log('🚀 Starting Auto-Timestamps Test...\n');
  const BASE_URL = 'http://localhost:3007/api';

  try {
    // 0. Setup DB
    await client.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        deleted_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT
      )
    `);

    console.log(`📦 1. Creating a new product (Testing createdAt and updatedAt injection)...`);
    const createRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Timestamp Product', price: 10 }),
    });
    const createdData = await createRes.json();
    const productId = createdData.data.id;
    
    if (createdData.data.createdAt && createdData.data.updatedAt) {
      console.log(`✅ Success: Timestamps injected automatically!`);
      console.log(`   createdAt: ${createdData.data.createdAt}`);
      console.log(`   updatedAt: ${createdData.data.updatedAt}`);
    } else {
      throw new Error(`Failed: Timestamps were missing on create! ${JSON.stringify(createdData.data)}`);
    }

    console.log(`\n⏳ Waiting 1 second to ensure timestamp difference...`);
    await new Promise(r => setTimeout(r, 1000));

    console.log(`\n🔄 2. Updating the product (Testing updatedAt modification)...`);
    const updateRes = await fetch(`${BASE_URL}/products/${productId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: 20 }),
    });
    const updatedData = await updateRes.json();

    if (updatedData.data.updatedAt !== createdData.data.updatedAt) {
      console.log(`✅ Success: updatedAt was refreshed!`);
      console.log(`   Old updatedAt: ${createdData.data.updatedAt}`);
      console.log(`   New updatedAt: ${updatedData.data.updatedAt}`);
    } else {
      throw new Error("Failed: updatedAt was not refreshed on update!");
    }

    console.log(`\n⏳ Waiting 1 second again...`);
    await new Promise(r => setTimeout(r, 1000));

    console.log(`\n📦 3. Testing Batch Update timestamps...`);
    const batchUpdateRes = await fetch(`${BASE_URL}/products/batch-update`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [productId], data: { price: 30 } }),
    });
    const batchResData = await batchUpdateRes.json();
    console.log(`   Batch Response:`, batchResData);

    const fetchRes = await fetch(`${BASE_URL}/products/${productId}`);
    const finalData = await fetchRes.json();
    console.log(`   Current DB updatedAt: ${finalData.data.updatedAt}`);

    if (finalData.data.updatedAt !== updatedData.data.updatedAt) {
      console.log(`✅ Success: updatedAt was refreshed during Batch Update!`);
      console.log(`   Final updatedAt: ${finalData.data.updatedAt}`);
    } else {
      throw new Error("Failed: updatedAt was not refreshed during batch update!");
    }

    console.log('\n✨ Auto-Timestamps tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    server.close();
  }
}

setTimeout(runTest, 500);
