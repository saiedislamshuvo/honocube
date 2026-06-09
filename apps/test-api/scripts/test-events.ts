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

const events: any[] = [];

// 1. Initialize Framework with Event Listener
const { defineResource, defineApi } = createApp({ 
  adapter,
  onEvent: (event) => {
    console.log(`[Event Capture] Type: ${event.type}, Resource: ${event.resource}`);
    events.push(event);
  }
});

const productsResource = defineResource({
  name: 'products',
  queryKey: 'products',
  table: schema.products,
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
  port: 3008
});

async function runTest() {
  console.log('🚀 Starting Universal Event Emitter Test...\n');
  const BASE_URL = 'http://localhost:3008/api';

  try {
    // 1. Create
    console.log('📦 1. Creating a product...');
    const createRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Event Test Product', price: 50 }),
    });
    const created = await createRes.json();
    const productId = created.data.id;

    // 2. Update
    console.log('\n🔄 2. Updating the product...');
    await fetch(`${BASE_URL}/products/${productId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: 75 }),
    });

    // 3. Delete
    console.log('\n🗑️ 3. Deleting the product...');
    await fetch(`${BASE_URL}/products/${productId}`, {
      method: 'DELETE'
    });

    console.log('\n🔍 Verifying event capture...');
    
    if (events.length >= 3) {
       console.log(`✅ Success! Captured ${events.length} events.`);
       const types = events.map(e => e.type);
       console.log(`📄 Event Types: ${types.join(', ')}`);
       
       if (types.includes('create') && types.includes('update') && types.includes('delete')) {
         console.log('✨ All mutation types correctly emitted events.');
       } else {
         throw new Error("Missing some expected event types.");
       }
    } else {
       throw new Error(`Failed: Only captured ${events.length} events.`);
    }

    console.log('\n✨ Event Emitter tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    server.close();
  }
}

setTimeout(runTest, 500);
