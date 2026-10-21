/**
 * Regression test for the parent-id resolution used by the `batch` strategy.
 *
 * The batch path inserts a parent and its children in a single `db.batch()`
 * call, so the children's foreign key cannot be a plain value: the parent's
 * id is only known once the parent has been inserted.
 *
 * Two things are checked here:
 *
 *  1. The generated SQL is dialect-portable. SQLite's `last_insert_rowid()`
 *     does not exist on Postgres or MySQL, so creating a resource with
 *     relations was broken on both.
 *  2. Every child points at the parent it belongs to — including the second
 *     and later children, which used to pick up the id of the row inserted
 *     right before them.
 */
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { pgTable, serial, text } from 'drizzle-orm/pg-core';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import { DrizzleAdapter, createApp } from '@honocube/api';
import { z } from 'zod';
import * as schema from '../db/schema';

let failures = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
  } else {
    failures++;
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function renderExpression(adapter: DrizzleAdapter, table: any): string {
  const expr = adapter.parentIdExpression(table) as any;
  return new SQLiteSyncDialect().sqlToQuery(expr).sql;
}

/**
 * The expression must not contain SQLite-only syntax, and it must use the
 * dialect's own way of resolving the parent's id.
 */
function testExpressionIsPortable() {
  console.log('\n🧪 The parent-id expression is dialect-portable');

  const pgOrders = pgTable('orders', { id: serial('id').primaryKey(), total: text('total') });

  const sqlite = renderExpression(new DrizzleAdapter({} as any, { dialect: 'sqlite' }), schema.orders);
  const postgres = renderExpression(new DrizzleAdapter({} as any, { dialect: 'postgresql' }), pgOrders);
  const mysql = renderExpression(new DrizzleAdapter({} as any, { dialect: 'mysql' }), schema.orders);

  console.log(`    sqlite:   ${sqlite}`);
  console.log(`    postgres: ${postgres}`);
  console.log(`    mysql:    ${mysql}`);

  check('sqlite does not use last_insert_rowid()', !sqlite.includes('last_insert_rowid'), sqlite);
  check('postgres does not use last_insert_rowid()', !postgres.includes('last_insert_rowid'), postgres);
  check('mysql does not use last_insert_rowid()', !mysql.includes('last_insert_rowid'), mysql);

  check('postgres resolves the id through the sequence', postgres.includes('currval'), postgres);
  check('postgres does not use a connection-scoped insert id', !postgres.includes('LAST_INSERT_ID'), postgres);
  check('mysql does not use a connection-scoped insert id', !mysql.includes('LAST_INSERT_ID'), mysql);

  // The expression has to resolve to the same row for every child, so it may
  // not depend on state that the child inserts themselves advance.
  check('sqlite reads the id back from the parent table', /FROM/.test(sqlite), sqlite);
  check('mysql reads the id back from the parent table', /FROM/.test(mysql), mysql);
}

async function setupDb() {
  const client = createClient({ url: `file:test-relation-fks.db` });
  const db = drizzle(client, { schema });

  try { await client.execute(`DROP TABLE IF EXISTS order_products`); } catch {}
  try { await client.execute(`DROP TABLE IF EXISTS orders`); } catch {}
  try { await client.execute(`DROP TABLE IF EXISTS customers`); } catch {}
  try { await client.execute(`DROP TABLE IF EXISTS products`); } catch {}

  await client.execute(`
    CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, price INTEGER NOT NULL, description TEXT,
      status TEXT DEFAULT 'active', image_url TEXT, deleted_at TEXT,
      created_at TEXT NOT NULL, updated_at TEXT
    )`);
  await client.execute(`
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE, phone TEXT, address TEXT, created_at TEXT NOT NULL
    )`);
  await client.execute(`
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL,
      total_amount INTEGER NOT NULL, status TEXT DEFAULT 'pending', created_at TEXT NOT NULL
    )`);
  await client.execute(`
    CREATE TABLE order_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL, quantity INTEGER NOT NULL, price_at_time INTEGER NOT NULL
    )`);

  return { client, db };
}

function buildApp(db: any) {
  const app = createApp({
    adapter: new DrizzleAdapter(db, { dialect: 'sqlite', schema }),
    strategy: 'batch',
  });

  const products = app.defineResource({
    name: 'products', queryKey: 'products', table: schema.products, timestamps: true,
    validator: z.object({ name: z.string(), price: z.number() }),
  });

  const orders = app.defineResource({
    name: 'orders', queryKey: 'orders', table: schema.orders, timestamps: true,
    methods: ['list', 'detail', 'create', 'update', 'delete', 'import-execute'],
    import: { lookupBy: 'totalAmount' },
    validator: z.object({ customerId: z.number(), totalAmount: z.number() }),
    relations: {
      many: [{
        name: 'products',
        table: schema.orderProducts,
        foreignKey: 'orderId',
        referenceKey: 'id',
        schema: z.object({ productId: z.number(), quantity: z.number(), priceAtTime: z.number() }),
      }],
    },
  });

  const server = new Hono();
  server.route('/api/products', products);
  server.route('/api/orders', orders);
  return server;
}

/**
 * Creating a parent with several children in one batch has to give every
 * child the parent's id.
 */
async function testCreateAssignsForeignKeys() {
  console.log('\n🧪 Create assigns the parent id to every child');

  const { client, db } = await setupDb();
  const server = buildApp(db);

  for (const [name, price] of [['A', 10], ['B', 20], ['C', 30]] as const) {
    await server.request('/api/products', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, price }),
    });
  }

  const res = await server.request('/api/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId: 1, totalAmount: 60,
      products: [
        { productId: 1, quantity: 1, priceAtTime: 10 },
        { productId: 2, quantity: 1, priceAtTime: 20 },
        { productId: 3, quantity: 1, priceAtTime: 30 },
      ],
    }),
  });
  const body = await res.json();
  check('the order was created', res.ok && !!body?.data?.id, JSON.stringify(body));
  const orderId = body?.data?.id;

  const rows = await client.execute(`SELECT id, order_id, product_id FROM order_products ORDER BY id`);
  const children = rows.rows as any[];
  for (const row of children) {
    console.log(`    id=${row.id} order_id=${row.order_id} product_id=${row.product_id}`);
  }

  check('all three children were inserted', children.length === 3, `found ${children.length}`);
  check(
    'every child points at the parent',
    children.length === 3 && children.every((r) => r.order_id === orderId),
    `expected order_id ${orderId}, got ${[...new Set(children.map((r) => r.order_id))].join(', ')}`
  );

  await client.close();
}

/**
 * Importing several parents — each with children — in one batch has to give
 * every child the id of the parent it was imported with.
 */
async function testImportAssignsForeignKeys() {
  console.log('\n🧪 Import assigns the parent id to every child');

  const { client, db } = await setupDb();
  const server = buildApp(db);

  for (const [name, price] of [['A', 10], ['B', 20], ['C', 30], ['D', 40]] as const) {
    await server.request('/api/products', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, price }),
    });
  }

  const res = await server.request('/api/orders/import/execute', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([
      {
        customerId: 1, totalAmount: 30,
        products: [
          { productId: 1, quantity: 1, priceAtTime: 10 },
          { productId: 2, quantity: 1, priceAtTime: 20 },
        ],
      },
      {
        customerId: 1, totalAmount: 70,
        products: [
          { productId: 3, quantity: 1, priceAtTime: 30 },
          { productId: 4, quantity: 1, priceAtTime: 40 },
        ],
      },
    ]),
  });
  const body = await res.json();
  check('the import succeeded', res.ok && body?.success, JSON.stringify(body));

  const orders = await client.execute(`SELECT id, total_amount FROM orders ORDER BY id`);
  const orderRows = orders.rows as any[];
  const firstOrderId = orderRows[0]?.id;
  const secondOrderId = orderRows[1]?.id;
  console.log(`    order ids: ${orderRows.map((o) => o.id).join(', ')}`);

  const rows = await client.execute(`SELECT id, order_id, product_id FROM order_products ORDER BY id`);
  const children = rows.rows as any[];
  for (const row of children) {
    console.log(`    id=${row.id} order_id=${row.order_id} product_id=${row.product_id}`);
  }

  check('all four children were inserted', children.length === 4, `found ${children.length}`);
  check(
    "the first parent's children point at the first parent",
    children.slice(0, 2).every((r) => r.order_id === firstOrderId),
    `expected order_id ${firstOrderId}, got ${children.slice(0, 2).map((r) => r.order_id).join(', ')}`
  );
  check(
    "the second parent's children point at the second parent",
    children.slice(2, 4).every((r) => r.order_id === secondOrderId),
    `expected order_id ${secondOrderId}, got ${children.slice(2, 4).map((r) => r.order_id).join(', ')}`
  );

  await client.close();
}

async function main() {
  try {
    testExpressionIsPortable();
    await testCreateAssignsForeignKeys();
    await testImportAssignsForeignKeys();

    if (failures > 0) {
      console.error(`\n❌ ${failures} check(s) failed`);
      process.exit(1);
    }
    console.log('\n🎉 ALL RELATION FK TESTS PASSED!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
