import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { DrizzleAdapter, createApp, AppStorage } from '@honocube/api';
import * as schema from '../db/schema';
import { z } from 'zod';

const app = new Hono();
const client = createClient({ url: 'file:database.sqlite' });
const db = drizzle(client, { schema });
const adapter = new DrizzleAdapter(db, { dialect: 'sqlite' });

// 1. Implement a Mock Storage Provider
class MockStorage implements AppStorage {
  public uploadCount = 0;
  async upload(file: any, options: { folder?: string; name: string }) {
    this.uploadCount++;
    console.log(`[Storage Debug] Uploading file: ${options.name} to /${options.folder || 'root'}`);
    return `${options.folder || 'root'}/${options.name}`;
  }
  async delete(path: string) {
    console.log(`[Storage Debug] Deleting file at: ${path}`);
  }
}

const storageProvider = new MockStorage();

// 2. Initialize Framework with Storage and Base URL
const { defineResource, defineApi } = createApp({ 
  adapter,
  storage: storageProvider,
  mediaBaseUrl: 'https://cdn.test.com/' // <--- Base URL for resolution
});

const productsResource = defineResource({
  name: 'products',
  queryKey: 'products',
  table: schema.products,
  // 🎯 Whitelist the 'imageUrl' field for auto-upload
  uploads: {
    imageUrl: { folder: 'products/images' }
  },
  validator: z.object({
    name: z.string(),
    price: z.number(),
    imageUrl: z.any().optional(),
    createdAt: z.string().default(() => new Date().toISOString())
  }),
});

const api = defineApi({ products: productsResource });
app.route('/api', api);

const server = serve({
  fetch: app.fetch,
  port: 3013
});

async function runTest() {
  console.log('🚀 Starting Universal Storage Test...\n');
  const BASE_URL = 'http://localhost:3013/api';

  try {
    // 0. Setup
    await client.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        name TEXT, 
        price INTEGER, 
        description TEXT,
        status TEXT,
        image_url TEXT,
        deleted_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT
      )
    `);

    console.log('📦 1. Creating product with a mock File object...');
    
    // We simulate a File object using a simple object that matches our processUploads detection
    const mockFile = { name: 'camera.jpg', type: 'image/jpeg' }; 

    const res = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: 'Smart Camera', 
        price: 299,
        imageUrl: mockFile // <--- The framework should intercept this!
      }),
    });
    
    const data = await res.json();
    const product = data.data;

    console.log('📄 API Response Fields:', Object.keys(product));
    console.log('📄 imageUrl value:', product.imageUrl);

    // Verification A: Did it upload?
    if (storageProvider.uploadCount === 1) {
       console.log('✅ Success: Storage provider was called.');
    } else {
       throw new Error(`Failed: Upload count expected 1, got ${storageProvider.uploadCount}`);
    }

    // Verification B: Is the URL resolved in the response?
    if (product.imageUrl === 'https://cdn.test.com/products/images/camera.jpg') {
       console.log('✅ Success: imageUrl was resolved with mediaBaseUrl.');
    } else {
       throw new Error(`Failed: Resolved URL mismatch. Got: ${product.imageUrl}`);
    }

    console.log('\n✨ Storage tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    server.close();
  }
}

setTimeout(runTest, 500);
