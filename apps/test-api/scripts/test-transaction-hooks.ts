import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { DrizzleAdapter, createApp } from '@honocube/api';
import * as schema from '../db/schema';
import { z } from 'zod';

const app = new Hono();

// Initialize LibSQL DB (local file)
const client = createClient({ url: 'file:database.sqlite' });
const db = drizzle(client, { schema });

const adapter = new DrizzleAdapter(db, { dialect: 'sqlite' });
const { defineResource, defineApi } = createApp({ adapter });

// Define Resource with a failing hook
const productsResource = defineResource({
  name: 'products',
  queryKey: 'products',
  table: schema.products,
  validator: z.object({
    name: z.string().min(1),
    price: z.number().positive(),
    createdAt: z.string().default(() => new Date().toISOString())
  }),
  hooks: {
    afterCreate: async (record, c, tx) => {
      // Intentionally throw an error AFTER the record is technically inserted
      // If transactions are working, the insert should be rolled back.
      throw new Error("Simulated failure in afterCreate hook!");
    }
  }
});

const api = defineApi({
  products: productsResource,
});

app.route('/api', api);

const server = serve({
  fetch: app.fetch,
  port: 3001 // Using a different port for this isolated test
});

async function runTest() {
  console.log('🚀 Starting Transaction Hook Test...\n');
  const BASE_URL = 'http://localhost:3001/api';

  try {
    const testProductName = `Rollback Test ${Date.now()}`;
    
    console.log(`📦 Attempting to create product: "${testProductName}"...`);
    
    const res = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: testProductName, price: 100 }),
    });

    const data = await res.json();
    console.log(`⚠️ API Response received (Expected failure):`, data);

    console.log('\n🔍 Verifying database rollback...');
    
    // We check directly via the adapter to bypass any API caching/logic
    const checkRecords = await adapter.findMany(schema.products, {
      where: (cols: any, { eq }: any) => eq(cols.name, testProductName)
    });

    if (checkRecords.length === 0) {
      console.log('✅ Success! The transaction rolled back perfectly. No record was saved.');
    } else {
      console.log('❌ Failed: The record was saved despite the hook throwing an error. Transactions are not working.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  } finally {
    server.close();
  }
}

// Small delay to ensure server is listening
setTimeout(runTest, 500);
