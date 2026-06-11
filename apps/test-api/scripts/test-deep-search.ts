import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { DrizzleAdapter, createApp } from '@honocube/api';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';

// Minimal schema for deep search test
const products = sqliteTable('products_search', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull()
});

async function runDeepSearchTest() {
  console.log('🧪 Testing Subquery-based Deep Search and maxLimit...');

  const client = createClient({ url: ':memory:' });
  const db = drizzle(client);

  await client.execute(`CREATE TABLE products_search (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)`);

  // 1. Insert 10,000 records (massively exceeds the 512 variable limit seen in user's error)
  console.log('  - Inserting 10,000 test records...');
  // SQLite has an insert limit too, so we chunk the inserts
  const totalRecords = 10000;
  const chunkSize = 500;
  for (let i = 0; i < totalRecords; i += chunkSize) {
    const chunk = Array.from({ length: chunkSize }, (_, j) => `('Product ${i + j + 1}')`).join(',');
    await client.execute(`INSERT INTO products_search (name) VALUES ${chunk}`);
  }

  const adapter = new DrizzleAdapter(db, { dialect: 'sqlite' });
  const { defineResource } = createApp({
    adapter
  });

  const productsResource = defineResource({
    name: 'products',
    table: products,
    search: {
      fields: ['name']
    },
    pagination: {
      maxLimit: 50 // Test custom max limit
    },
    validator: z.object({ name: z.string() })
  });

  const app = new Hono();
  app.route('/api/products', productsResource);

  // 2. Test Search (Should match all 10000 records)
  console.log('  - Testing search with 10,000 matches (should NOT crash)...');
  const searchRes = await app.request('/api/products?q=Product&limit=10');
  const searchData = await searchRes.json();
  
  if (searchData.success && searchData.meta.total === 10000) {
    console.log(`    ✅ Search successful! Found ${searchData.meta.total} records without variable limit error.`);
  } else {
    throw new Error(`Search failed! Expected 10000 matches, got ${searchData.meta.total}. Data: ${JSON.stringify(searchData)}`);
  }

  // 3. Test maxLimit Enforcement
  console.log('  - Testing maxLimit enforcement (requesting 200, should get 50)...');
  const limitRes = await app.request('/api/products?limit=200');
  const limitData = await limitRes.json();
  
  if (limitData.meta.limit === 50) {
    console.log(`    ✅ maxLimit enforced! Requested 200, capped to ${limitData.meta.limit}`);
  } else {
    throw new Error(`maxLimit failed! Expected 50, got ${limitData.meta.limit}`);
  }

  console.log('\n✨ Deep Search and maxLimit tests passed!');
}

runDeepSearchTest().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
