import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { DrizzleAdapter, createApp, ApiError } from '@honocube/api';
import * as schema from '../db/schema';
import { z } from 'zod';

const app = new Hono();

const client = createClient({ url: 'file:database.sqlite' });
const db = drizzle(client, { schema });
const adapter = new DrizzleAdapter(db, { dialect: 'sqlite' });

const { defineResource, defineApi } = createApp<any>({ 
  adapter,
  getContext: () => ({ customGreeting: "Hello from RPC" })
});

const productsResource = defineResource({
  name: 'products',
  queryKey: 'products',
  table: schema.products,
  validator: z.object({
    name: z.string().min(1),
    price: z.number().positive(),
  }),
  actions: [
    {
      path: '/:id/restock',
      method: 'post',
      validator: z.object({
        amount: z.number().positive().max(100)
      }),
      handler: async (c, appContext, validatedData) => {
        const id = c.req.param("id");
        
        // Ensure ID is valid
        if (id === '999') throw ApiError.notFound("Product not found");

        return {
          message: `${appContext.customGreeting}! Restocked product ${id} by ${validatedData.amount} units.`,
          newStockLevel: validatedData.amount + 50 // Mock current stock
        };
      }
    }
  ]
});

const api = defineApi({
  products: productsResource,
});

app.route('/api', api);

const server = serve({
  fetch: app.fetch,
  port: 3006
});

async function runTest() {
  console.log('🚀 Starting Custom Actions Test...\n');
  const BASE_URL = 'http://localhost:3006/api';

  try {
    console.log(`📦 1. Calling custom RPC endpoint (/products/1/restock) with valid payload...`);
    const validRes = await fetch(`${BASE_URL}/products/1/restock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 20 }),
    });
    const validData = await validRes.json();
    console.log(`✅ Success: RPC Executed. Response:`, validData);
    
    if (!validData.data?.message?.includes("Hello from RPC")) {
       throw new Error("Context was not injected properly into the RPC handler.");
    }

    console.log(`\n❌ 2. Calling custom RPC endpoint with INVALID payload (amount > 100)...`);
    const invalidRes = await fetch(`${BASE_URL}/products/1/restock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 500 }),
    });
    const invalidData = await invalidRes.json();
    console.log(`⚠️ Expected Failure (Validation):`, invalidData);

    if (invalidRes.status !== 400 || invalidData.error.code !== 'VALIDATION_ERROR') {
      throw new Error("Validation did not fail correctly.");
    }

    console.log(`\n🔍 3. Calling custom RPC endpoint with non-existent ID (Testing standard errors)...`);
    const notFoundRes = await fetch(`${BASE_URL}/products/999/restock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 20 }),
    });
    if (notFoundRes.status === 404) {
       console.log(`✅ Success: RPC threw standard ApiError.notFound().`);
    } else {
       throw new Error("RPC failed to bubble up standard ApiError.");
    }

    console.log('\n✨ Custom Actions tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    server.close();
  }
}

setTimeout(runTest, 500);
