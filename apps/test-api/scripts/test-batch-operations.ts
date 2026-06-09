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
  softDelete: 'deletedAt',
  methods: ['list', 'create', 'batch-update', 'batch-delete'],
  validator: z.object({
    name: z.string().min(1),
    price: z.number().positive(),
    status: z.enum(['active', 'inactive']).optional(),
    createdAt: z.string().default(() => new Date().toISOString())
  }),
  hooks: {
    beforeBatchUpdate: async (ids, data, c, tx, appContext) => {
      console.log(`[Hook Debug] Intercepted batch update for ${ids.length} records.`);
      // Security simulation: Refuse to update ID 1 (pretend it belongs to another tenant)
      const safeIds = ids.filter(id => id !== 1);
      if (safeIds.length !== ids.length) {
         console.log(`[Hook Debug] Filtered out restricted IDs.`);
      }
      return { ids: safeIds, data };
    }
  }
});

const api = defineApi({
  products: productsResource,
});

app.route('/api', api);

const server = serve({
  fetch: app.fetch,
  port: 3005
});

async function runTest() {
  console.log('🚀 Starting Batch Operations Test...\n');
  const BASE_URL = 'http://localhost:3005/api';

  try {
    console.log(`📦 1. Bulk creating 3 products for testing...`);
    const createdIds: number[] = [];
    for (let i = 1; i <= 3; i++) {
      const res = await fetch(`${BASE_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Batch Product ${i}`, price: 100 }),
      });
      const data = await res.json();
      createdIds.push(data.data.id);
    }
    console.log(`✅ Created products:`, createdIds);

    console.log(`\n🔄 2. Executing Batch Update (status -> 'inactive')...`);
    console.log(`   (Passing ID 1 as well to test hook filtering)`);
    const updateRes = await fetch(`${BASE_URL}/products/batch-update`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: [1, ...createdIds], 
        data: { status: 'inactive' }
      }),
    });
    const updateData = await updateRes.json();
    console.log(`✅ Batch Update Response:`, updateData);
    
    if (updateData.updated === createdIds.length) {
      console.log(`✨ Success: Hook correctly filtered out ID 1 and updated the rest!`);
    } else {
      throw new Error(`Expected ${createdIds.length} updates, got ${updateData.updated}`);
    }

    console.log(`\n🗑️ 3. Executing Batch (Soft) Delete...`);
    const deleteRes = await fetch(`${BASE_URL}/products/batch-delete`, {
      method: 'POST', // Batch delete uses POST to support body
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: createdIds }),
    });
    const deleteData = await deleteRes.json();
    console.log(`✅ Batch Delete Response:`, deleteData);

    console.log(`\n🔍 4. Verifying soft delete via List API...`);
    const listRes = await fetch(`${BASE_URL}/products`);
    const listData = await listRes.json();
    const stillExists = listData.data.some((p: any) => createdIds.includes(p.id));
    
    if (!stillExists) {
      console.log(`✨ Success: All deleted products are hidden from the list.`);
    } else {
      throw new Error(`Some soft-deleted products are still visible!`);
    }

    console.log('\n✨ Batch Operation tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    server.close();
  }
}

setTimeout(runTest, 500);
