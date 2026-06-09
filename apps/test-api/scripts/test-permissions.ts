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

interface SaaSContext {
  user?: { id: number; permissions: string[] };
}

// 1. Initialize Framework with auth.can
const { defineResource, defineApi } = createApp<any, SaaSContext>({ 
  adapter,
  getContext: async (c) => {
    const authHeader = c.req.header('Authorization');
    if (authHeader === 'Bearer editor') {
      return { user: { id: 1, permissions: ['products.list', 'products.update'] } };
    }
    if (authHeader === 'Bearer admin') {
      return { user: { id: 2, permissions: ['products.list', 'products.create', 'products.update', 'products.delete'] } };
    }
    return {};
  },
  auth: {
    can: (context, permission) => {
      if (!context.user) return false;
      return context.user.permissions.includes(permission);
    }
  }
});

// 2. Define Resource with Declarative Permissions
const productsResource = defineResource({
  name: 'products',
  queryKey: 'products',
  table: schema.products,
  validator: z.object({
    name: z.string().min(1),
    price: z.number().positive(),
    createdAt: z.string().default(() => new Date().toISOString())
  }),
  permissions: {
    list: 'products.list',
    create: 'products.create',
    update: 'products.update',
    delete: 'products.delete'
  }
});

const api = defineApi({
  products: productsResource,
});

app.route('/api', api);

const server = serve({
  fetch: app.fetch,
  port: 3004
});

async function runTest() {
  console.log('🚀 Starting SaaS Permissions Test...\n');
  const BASE_URL = 'http://localhost:3004/api';

  try {
    console.log(`📦 1. Editor tries to list products (Has 'products.list')...`);
    const listRes = await fetch(`${BASE_URL}/products`, {
      headers: { 'Authorization': 'Bearer editor' }
    });
    if (listRes.status === 200) console.log(`✅ Success: Editor can list.`);
    else throw new Error("Editor could not list products!");

    console.log(`\n🔒 2. Editor tries to create a product (Missing 'products.create')...`);
    const createFailRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer editor' },
      body: JSON.stringify({ name: 'Editor Product', price: 100 }),
    });
    if (createFailRes.status === 403) console.log(`✅ Success: Editor forbidden from creating.`);
    else throw new Error("Editor was allowed to create a product!");

    console.log(`\n🔓 3. Admin tries to create a product (Has 'products.create')...`);
    const createSuccessRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer admin' },
      body: JSON.stringify({ name: 'Admin Product', price: 100 }),
    });
    if (createSuccessRes.status === 201) console.log(`✅ Success: Admin created the product.`);
    else throw new Error("Admin failed to create product!");

    console.log('\n✨ Dynamic Permissions tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    server.close();
  }
}

setTimeout(runTest, 500);
