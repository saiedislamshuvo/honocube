/**
 * Verifies the `batch` -> `transaction` fallback for drivers without
 * `db.batch()` — the Postgres / MySQL / better-sqlite3 case.
 *
 * Issue #3: the `batch` strategy is the default, but Drizzle only exposes
 * `db.batch()` on `d1`, `libsql`, `neon-http` and `sqlite-proxy`. On
 * `postgres-js`, `node-postgres`, `mysql2` and `better-sqlite3` it is
 * undefined, and `tx.batch(stmts)` throws "tx.batch is not a function".
 *
 * The fix resolves the strategy per request: when the adapter reports that
 * batching is unavailable, the framework falls back to `transaction`, which
 * is atomic on every driver that supports transactions.
 *
 * This script uses a real libsql database (so the SQL is genuinely executed)
 * wrapped in an adapter that hides `batch`, standing in for a driver without
 * it. It asserts that a create succeeds and that the row is actually
 * written, rather than throwing.
 */
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { DrizzleAdapter, createApp, defineResource } from '@honocube/api';
import { z } from 'zod';
import * as schema from '../db/schema';

async function main() {
  const dbFile = `test-batch-fallback.db`;
  const client = createClient({ url: `file:${dbFile}` });
  const db = drizzle(client, { schema });

  // Clean up
  try { await client.execute(`DROP TABLE IF EXISTS order_products`); } catch {}
  try { await client.execute(`DROP TABLE IF EXISTS orders`); } catch {}
  try { await client.execute(`DROP TABLE IF EXISTS customers`); } catch {}
  try { await client.execute(`DROP TABLE IF EXISTS products`); } catch {}

  await client.execute(`
    CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active',
      image_url TEXT,
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )
  `);
  await client.execute(`
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      address TEXT,
      created_at TEXT NOT NULL
    )
  `);
  await client.execute(`
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      total_amount INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL
    )
  `);
  await client.execute(`
    CREATE TABLE order_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price_at_time INTEGER NOT NULL
    )
  `);

  // A DrizzleAdapter that hides `batch`, standing in for postgres-js,
  // node-postgres, mysql2 and better-sqlite3 — all of which lack it.
  const baseAdapter = new DrizzleAdapter(db, { dialect: 'sqlite', schema });
  const adapterWithoutBatch = Object.create(baseAdapter) as any;
  adapterWithoutBatch.supportsBatch = () => false;

  // `batch` must never be reached. If it is, we get the exact error a
  // consumer on Postgres sees today.
  let batchWasCalled = false;
  adapterWithoutBatch.batch = () => {
    batchWasCalled = true;
    throw new TypeError('tx.batch is not a function');
  };

  const app = createApp({
    adapter: adapterWithoutBatch,
    // The default strategy is "batch" — this is the configuration that
    // currently produces a 500 on Postgres.
    strategy: 'batch',
  });

  const productsApp = app.defineResource({
    name: 'products',
    queryKey: 'products',
    table: schema.products,
    timestamps: true,
    validator: z.object({
      name: z.string().min(1),
      price: z.number().positive(),
      description: z.string().optional(),
      status: z.enum(['active', 'inactive']).optional(),
    }),
  });

  const server = new Hono();
  server.route('/api/products', productsApp);

  // --- Control: the same resource on an adapter WITH batch still batches ---
  const batchAdapter = new DrizzleAdapter(db, { dialect: 'sqlite', schema });
  console.log(`supportsBatch() on a driver that has it: ${batchAdapter.supportsBatch()}`);

  // --- The case that used to throw ---
  console.log(`supportsBatch() on a driver without it: ${adapterWithoutBatch.supportsBatch()}`);

  const res = await server.request('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Fallback Product', price: 42 }),
  });

  const body = await res.json();

  if (!res.ok) {
    console.error(`❌ FAILED: create returned ${res.status}`);
    console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }

  // The row must actually be in the database, not just "no error".
  const rows = await client.execute(`SELECT id, name, price FROM products`);
  const count = (rows.rows as any[]).length;

  if (count !== 1) {
    console.error(`❌ FAILED: expected 1 row in products, found ${count}`);
    process.exit(1);
  }

  const id = (rows.rows as any[])[0].id;
  console.log(`✅ Create succeeded via the transaction fallback (row id ${id}, price ${(rows.rows as any[])[0].price})`);

  // The response should carry the inserted record.
  const insertedId = body?.data?.id;
  if (insertedId !== id) {
    console.error(`❌ FAILED: response id ${insertedId} does not match stored id ${id}`);
    process.exit(1);
  }

  // --- List must work too ---
  const listRes = await server.request('/api/products');
  const listBody = await listRes.json();
  if (!listRes.ok) {
    console.error(`❌ FAILED: list returned ${listRes.status}`);
    console.error(JSON.stringify(listBody, null, 2));
    process.exit(1);
  }
  const listed = listBody?.data?.length ?? 0;
  if (listed !== 1) {
    console.error(`❌ FAILED: expected 1 listed row, found ${listed}`);
    process.exit(1);
  }
  console.log(`✅ List succeeded via the transaction fallback`);

  // --- Update must work too ---
  const updRes = await server.request(`/api/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ price: 99 }),
  });
  if (!updRes.ok) {
    const updBody = await updRes.json();
    console.error(`❌ FAILED: update returned ${updRes.status}`);
    console.error(JSON.stringify(updBody, null, 2));
    process.exit(1);
  }
  const after = await client.execute(`SELECT price FROM products WHERE id = ${id}`);
  const price = (after.rows as any[])[0].price;
  if (price !== 99) {
    console.error(`❌ FAILED: expected price 99, found ${price}`);
    process.exit(1);
  }
  console.log(`✅ Update succeeded via the transaction fallback`);

  // --- Delete must work too ---
  const delRes = await server.request(`/api/products/${id}`, { method: 'DELETE' });
  if (!delRes.ok) {
    const delBody = await delRes.json();
    console.error(`❌ FAILED: delete returned ${delRes.status}`);
    console.error(JSON.stringify(delBody, null, 2));
    process.exit(1);
  }
  const final = await client.execute(`SELECT COUNT(*) as c FROM products`);
  if ((final.rows as any[])[0].c !== 0) {
    console.error(`❌ FAILED: row was not deleted`);
    process.exit(1);
  }
  console.log(`✅ Delete succeeded via the transaction fallback`);

  // The whole point: `tx.batch()` must never have been called on a driver
  // that does not have it.
  if (batchWasCalled) {
    console.error(`❌ FAILED: tx.batch() was called on a driver without batch support`);
    process.exit(1);
  }
  console.log(`✅ tx.batch() was never called on the driver without batch support`);

  console.log(`\n🎉 ALL BATCH FALLBACK TESTS PASSED`);
}

main().catch((err) => {
  console.error(`❌ FAILED:`, err);
  process.exit(1);
});
