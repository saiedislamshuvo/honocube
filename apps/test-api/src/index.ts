import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { DrizzleAdapter, createApp } from '@honocube/api';
import * as schema from '../db/schema';
import { z } from 'zod';

const app = new Hono();

// Initialize LibSQL DB (local file)
const client = createClient({ url: 'file:database.sqlite' });
const db = drizzle(client, { schema });

// Simple table creation for testing
await client.execute(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
  )
`);

await client.execute(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    address TEXT,
    created_at TEXT NOT NULL
  )
`);

await client.execute(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    total_amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )
`);

await client.execute(`
  CREATE TABLE IF NOT EXISTS order_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price_at_time INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  )
`);

// Initialize BaseForge Adapter
const adapter = new DrizzleAdapter(db, { dialect: 'sqlite' });

// Initialize Resource Framework
const { defineResource, defineApi } = createApp({
  adapter,
});

// Define Resources
const productsResource = defineResource({
  name: 'products',
  queryKey: 'products',
  table: schema.products,
  softDelete: 'deletedAt', 
  timestamps: true,
  validator: z.object({
    name: z.string().min(1),
    price: z.number().positive(),
    description: z.string().optional(),
    status: z.enum(['active', 'inactive']).optional(),
  }),
  search: {
    fields: ['name', 'description']
  },
  filter: {
    allow: ['status', 'price']
  },
  defaultSort: { field: 'id', direction: 'desc' }
});

const customersResource = defineResource({
  name: 'customers',
  queryKey: 'customers',
  table: schema.customers,
  scope: (cols, { gt }) => gt(cols.createdAt, '2016-01-01'), 
  validator: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    address: z.string().optional(),
    createdAt: z.string().default(() => new Date().toISOString())
  }),
  search: {
    fields: ['name', 'email']
  }
});

const ordersResource = defineResource({
  name: 'orders',
  queryKey: 'orders',
  table: schema.orders,
  validator: z.object({
    customerId: z.number(),
    totalAmount: z.number(),
    status: z.enum(['pending', 'completed', 'cancelled']).optional(),
    createdAt: z.string().default(() => new Date().toISOString())
  }),
  relations: {
    one: [
      {
        name: 'customer',
        table: schema.customers,
        foreignKey: 'customerId',
        referenceKey: 'id',
        search: ['name', 'email'],
        hidden: ['email']
      }
    ],
    pivots: [
      {
        name: 'products',
        table: schema.orderProducts,
        targetTable: schema.products,
        foreignKey: 'orderId',
        referenceKey: 'productId',
        targetReferenceKey: 'id',
        relationName: 'products',
        search: ['name', 'description']
      }
    ]
  },
  search: {
    fields: ['status'],
    relations: ['customer', 'products']
  },
  with: {
    customer: true,
    products: true
  }
});

const orderProductsResource = defineResource({
  name: 'order_products',
  queryKey: 'orderProducts',
  table: schema.orderProducts,
  validator: z.object({
    orderId: z.number(),
    productId: z.number(),
    quantity: z.number().positive(),
    priceAtTime: z.number()
  })
});

// Group resources into an API
const api = defineApi({
  products: productsResource,
  customers: customersResource,
  orders: ordersResource,
  order_products: orderProductsResource
});

app.route('/api', api);

console.log('Test API running on http://localhost:3000');

serve({
  fetch: app.fetch,
  port: 3000
});
