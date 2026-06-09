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
  // NEW: Transform hook for computed fields
  transform: async (record: any, context) => {
    return {
      ...record,
      priceFormatted: `$${record.price.toFixed(2)}`,
      upperName: record.name.toUpperCase(),
      serverMessage: "Transformed by Framework"
    };
  }
});

const api = defineApi({ products: productsResource });
app.route('/api', api);

const server = serve({
  fetch: app.fetch,
  port: 3012
});

async function runTest() {
  console.log('🚀 Starting Data Transformation Test...\n');
  const BASE_URL = 'http://localhost:3012/api';

  try {
    // 0. Setup
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

    const uniqueName = `gadget-${Date.now()}`;
    console.log(`📦 1. Creating a product: ${uniqueName}...`);
    await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: uniqueName, price: 50 }),
    });

    console.log('\n🔍 2. Fetching product list and checking for computed fields...');
    const res = await fetch(`${BASE_URL}/products?q=${uniqueName}`);
    const data = await res.json();
    const product = data.data.find((p: any) => p.name === uniqueName);

    if (!product) throw new Error("Could not find the created product.");

    console.log('📄 Received Product:', JSON.stringify(product, null, 2));

    if (product.priceFormatted === '$50.00' && product.upperName === uniqueName.toUpperCase()) {
       console.log('✅ Success! Computed fields (priceFormatted, upperName) were injected.');
    } else {
       throw new Error(`Failed: Transformation hook did not modify the response correctly. Expected priceFormatted $50.00 and upperName ${uniqueName.toUpperCase()}`);
    }

    if (product.serverMessage === 'Transformed by Framework') {
       console.log('✅ Success! Static transformation fields were injected.');
    } else {
       throw new Error("Failed: Static transformation field missing.");
    }

    console.log('\n✨ Data Transformation tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    server.close();
  }
}

setTimeout(runTest, 500);
