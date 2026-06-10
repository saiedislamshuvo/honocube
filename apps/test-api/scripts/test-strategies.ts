import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { DrizzleAdapter, createApp, DatabaseStrategy } from '@honocube/api';
import * as schema from '../db/schema';
import { z } from 'zod';

async function runTest(strategy: DatabaseStrategy) {
  console.log(`\n🧪 Testing Strategy: "${strategy}"`);

  // 1. Setup DB
  const dbFile = `test-${strategy}.db`;
  const client = createClient({ url: `file:${dbFile}` });
  const db = drizzle(client, { schema });

  // Clean up old db
  try { await client.execute(`DROP TABLE IF EXISTS order_products`); } catch(e) {}
  try { await client.execute(`DROP TABLE IF EXISTS orders`); } catch(e) {}
  try { await client.execute(`DROP TABLE IF EXISTS customers`); } catch(e) {}
  try { await client.execute(`DROP TABLE IF EXISTS products`); } catch(e) {}

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
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

  await client.execute(`
    CREATE TABLE order_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price_at_time INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  // 2. Setup App
  const adapter = new DrizzleAdapter(db, { dialect: 'sqlite' });
  const { defineResource, defineApi } = createApp({
    adapter,
    strategy
  });

  const productsResource = defineResource({
    name: 'products',
    table: schema.products,
    timestamps: true,
    validator: z.object({
      name: z.string(),
      price: z.number()
    })
  });

  const ordersResource = defineResource({
    name: 'orders',
    table: schema.orders,
    timestamps: true,
    validator: z.object({
      customerId: z.number(),
      totalAmount: z.number()
    }),
    relations: {
      pivots: [
        {
          name: 'products',
          table: schema.orderProducts,
          targetTable: schema.products,
          foreignKey: 'orderId',
          referenceKey: 'productId',
          targetReferenceKey: 'id',
          relationName: 'products'
        }
      ]
    }
  });

  const api = defineApi({
    products: productsResource,
    orders: ordersResource
  });

  const app = new Hono();
  app.route('/api', api);

  // 3. Perform Operations
  
  // A. Create a product
  console.log('  - Creating product...');
  const prodRes = await app.request('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Product', price: 100 })
  });
  const prodData = await prodRes.json();
  if (!prodData.success) throw new Error(`Product creation failed: ${JSON.stringify(prodData)}`);
  const productId = prodData.data.id;
  console.log(`    ✅ Created Product ID: ${productId}`);

  // A2. Create a customer (needed for FK)
  await client.execute({
    sql: 'INSERT INTO customers (name, email, created_at) VALUES (?, ?, ?)',
    args: ['Test Customer', 'test@example.com', new Date().toISOString()]
  });
  console.log('    ✅ Created Customer');

  // B. Create an order with Pivot Relation (This tests the atomicity/batching)
  console.log('  - Creating order with product relation...');
  const orderRes = await app.request('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId: 1,
      totalAmount: 100,
      products: [
        { productId: productId, quantity: 2, priceAtTime: 100 }
      ]
    })
  });
  const orderData = await orderRes.json();
  if (!orderData.success) throw new Error(`Order creation failed: ${JSON.stringify(orderData)}`);
  const orderId = orderData.data.id;
  console.log(`    ✅ Created Order ID: ${orderId}`);

  // 4. Verify relations
  console.log('  - Verifying relations...');
  const verifyRes = await client.execute({
    sql: 'SELECT * FROM order_products WHERE order_id = ?',
    args: [orderId]
  });
  if (verifyRes.rows.length === 1) {
    console.log(`    ✅ Relation verified in order_products table`);
  } else {
    throw new Error(`Relation missing! Found ${verifyRes.rows.length} rows`);
  }

  // 5. Test Update with strategy
  console.log('  - Testing update...');
  const updateRes = await app.request(`/api/orders/${orderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      totalAmount: 150,
      products: [
        { productId: productId, quantity: 3, priceAtTime: 150 }
      ]
    })
  });
  const updateData = await updateRes.json();
  if (!updateData.success) throw new Error(`Order update failed: ${JSON.stringify(updateData)}`);
  console.log(`    ✅ Order updated`);

  const verifyUpdate = await client.execute({
    sql: 'SELECT * FROM order_products WHERE order_id = ?',
    args: [orderId]
  });
  if (verifyUpdate.rows.length === 1 && verifyUpdate.rows[0].quantity === 3) {
    console.log(`    ✅ Update verified (quantity is 3)`);
  } else {
    throw new Error(`Update verification failed! Data: ${JSON.stringify(verifyUpdate.rows)}`);
  }

  console.log(`✨ Strategy "${strategy}" passed!`);
}

async function main() {
  try {
    await runTest('none');
    await runTest('transaction');
    await runTest('batch');
    console.log('\n🎉 ALL STRATEGY TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
