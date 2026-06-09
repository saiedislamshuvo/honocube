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

// 1. Define AppContext interface
interface MyAppContext {
  user?: { id: number; role: string };
  logger: (msg: string) => void;
}

// 2. Initialize Framework with Context Resolver
const { defineResource, defineApi } = createApp<any, MyAppContext>({ 
  adapter,
  getContext: async (c) => {
    // Mock Auth parsing
    const authHeader = c.req.header('Authorization');
    let user;
    if (authHeader === 'Bearer mock-token-123') {
      user = { id: 123, role: 'admin' };
    }

    return {
      user,
      logger: (msg) => console.log(`[App Log] ${msg}`)
    };
  }
});

// 3. Define Resource that uses Context
const productsResource = defineResource({
  name: 'products',
  queryKey: 'products',
  table: schema.products,
  validator: z.object({
    name: z.string().min(1),
    price: z.number().positive(),
    description: z.string().optional(),
    createdAt: z.string().default(() => new Date().toISOString())
  }),
  hooks: {
    beforeCreate: async (data, c, tx, appContext) => {
      appContext.logger('beforeCreate hook triggered!');
      
      if (!appContext.user) {
        throw new Error("Unauthorized: No user in context");
      }

      // We can use the context to modify data or validate
      // In a real app, you might set a 'createdById' field here
      return {
        ...data,
        description: `Created by User ID: ${appContext.user.id}`
      };
    }
  }
});

const api = defineApi({
  products: productsResource,
});

app.route('/api', api);

const server = serve({
  fetch: app.fetch,
  port: 3002
});

async function runTest() {
  console.log('🚀 Starting Auth/Context Injection Test...\n');
  const BASE_URL = 'http://localhost:3002/api';

  try {
    const testProductName = `Context Test ${Date.now()}`;
    
    console.log(`📦 1. Attempting to create product WITHOUT auth token (Should fail)...`);
    const resNoAuth = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: testProductName, price: 100 }),
    });
    const dataNoAuth = await resNoAuth.json();
    console.log(`⚠️ Expected Failure:`, dataNoAuth.error.debug);

    console.log(`\n📦 2. Attempting to create product WITH auth token (Should succeed)...`);
    const resAuth = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-token-123'
      },
      body: JSON.stringify({ name: testProductName, price: 100 }),
    });
    const dataAuth = await resAuth.json();
    
    if (dataAuth.success && dataAuth.data.description === 'Created by User ID: 123') {
      console.log('✅ Success! The context was correctly injected and used in the hook.');
      console.log('📄 Product data:', dataAuth.data);
    } else {
      console.log('❌ Failed: Context injection did not work as expected.', dataAuth);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  } finally {
    server.close();
  }
}

setTimeout(runTest, 500);
