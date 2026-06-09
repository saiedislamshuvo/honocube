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

interface MyAppContext {
  user?: { id: number; role: string };
}

const { defineResource, defineApi } = createApp<any, MyAppContext>({ 
  adapter,
  getContext: async (c) => {
    // Mock Auth: "User 1" or "User 2" based on header
    const authHeader = c.req.header('Authorization');
    if (authHeader === 'Bearer user-1') return { user: { id: 1, role: 'user' } };
    if (authHeader === 'Bearer user-2') return { user: { id: 2, role: 'user' } };
    return {};
  }
});

// Define Resource with strict Authorization Policies
const productsResource = defineResource({
  name: 'products',
  queryKey: 'products',
  table: schema.products,
  validator: z.object({
    name: z.string().min(1),
    price: z.number().positive(),
    status: z.enum(['active', 'inactive']).optional(),
    createdAt: z.string().default(() => new Date().toISOString())
  }),
  authorize: (context, action, record) => {
    // 1. Must be logged in for all actions
    if (!context.user) return false;

    // Row-Level Security: Users can only update or delete THEIR OWN products
    // (We'll use 'price' as a mock 'ownerId' for this test to avoid schema changes)
    if (action === 'update' || action === 'delete') {
      const ownerId = (record as any).price; 
      return context.user.id === ownerId;
    }

    return true; // Allow list, detail, create
  }
});

const api = defineApi({
  products: productsResource,
});

app.route('/api', api);

const server = serve({
  fetch: app.fetch,
  port: 3003
});

async function runTest() {
  console.log('🚀 Starting Authorization Test...\n');
  const BASE_URL = 'http://localhost:3003/api';

  try {
    console.log(`📦 1. User 1 creates a product...`);
    const createRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer user-1' },
      body: JSON.stringify({ name: 'User 1 Product', price: 1 }), // price = ownerId
    });
    const product = await createRes.json();
    const productId = product.data.id;
    console.log(`✅ Product created by User 1 (ID: ${productId})`);

    console.log(`\n🔒 2. Anonymous user tries to list products (Should fail)...`);
    const listFailRes = await fetch(`${BASE_URL}/products`);
    if (listFailRes.status === 403) console.log(`✅ Success: Anonymous access denied.`);
    else throw new Error("Anonymous user was allowed to list products!");

    console.log(`\n🔒 3. User 2 tries to update User 1's product (Should fail)...`);
    const updateFailRes = await fetch(`${BASE_URL}/products/${productId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer user-2' },
      body: JSON.stringify({ status: 'inactive' }),
    });
    if (updateFailRes.status === 403) console.log(`✅ Success: User 2 forbidden from updating User 1's product.`);
    else throw new Error("User 2 was allowed to update User 1's product!");

    console.log(`\n🔓 4. User 1 tries to update their own product (Should succeed)...`);
    const updateSuccessRes = await fetch(`${BASE_URL}/products/${productId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer user-1' },
      body: JSON.stringify({ status: 'inactive' }),
    });
    if (updateSuccessRes.status === 200) console.log(`✅ Success: User 1 updated their product.`);
    else throw new Error("User 1 failed to update their own product!");

    console.log('\n✨ Authorization tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    server.close();
  }
}

setTimeout(runTest, 500);
