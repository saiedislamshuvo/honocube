import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { z } from "zod";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { DrizzleAdapter } from "../../src/adapters/drizzle.js";
import { createApp, DatabaseStrategy } from "../../src/core/factory.js";

// Define test schema for strategies test
const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  description: text("description"),
  status: text("status").default("active"),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  address: text("address"),
  createdAt: text("created_at").notNull(),
});

const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").notNull(),
  totalAmount: integer("total_amount").notNull(),
  status: text("status").default("pending"),
  createdAt: text("created_at").notNull(),
});

const orderProducts = sqliteTable("order_products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  priceAtTime: integer("price_at_time").notNull(),
});

const ordersRelations = relations(orders, ({ many }) => ({
  orderProducts: many(orderProducts),
}));

const orderProductsRelations = relations(orderProducts, ({ one }) => ({
  order: one(orders, {
    fields: [orderProducts.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderProducts.productId],
    references: [products.id],
  }),
}));

const schema = {
  products,
  customers,
  orders,
  orderProducts,
  ordersRelations,
  orderProductsRelations,
};

async function setupTestDb(strategy: DatabaseStrategy) {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });

  await client.execute(`
    CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active',
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );
  `);

  await client.execute(`
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      address TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      total_amount INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
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
    );
  `);

  const adapter = new DrizzleAdapter(db, { dialect: "sqlite" });
  const { defineResource, defineApi } = createApp({
    adapter,
    strategy,
  });

  const productsResource = defineResource({
    name: "products",
    table: products,
    timestamps: true,
    validator: z.object({
      name: z.string(),
      price: z.number(),
    }),
  });

  const ordersResource = defineResource({
    name: "orders",
    table: orders,
    timestamps: true,
    validator: z.object({
      customerId: z.number(),
      totalAmount: z.number(),
    }),
    relations: {
      pivots: [
        {
          name: "products",
          table: orderProducts,
          targetTable: products,
          foreignKey: "orderId",
          referenceKey: "productId",
          targetReferenceKey: "id",
          relationName: "products",
        },
      ],
    },
  });

  const api = defineApi({
    products: productsResource,
    orders: ordersResource,
  });

  const app = new Hono();
  app.route("/api", api);

  return { client, app };
}

describe("Database Execution Strategies Engine", () => {
  const strategies: DatabaseStrategy[] = ["none", "transaction", "batch"];

  for (const strategy of strategies) {
    it(`executes operations, relations, and atomic updates under strategy: "${strategy}"`, async () => {
      const { client, app } = await setupTestDb(strategy);

      // 1. Create product
      const prodRes = await app.request("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Strategy Test Product", price: 100 }),
      });
      const prodData = await prodRes.json();
      expect(prodRes.status).toBe(201);
      expect(prodData.success).toBe(true);
      const productId = prodData.data.id;

      // 2. Create customer
      await client.execute({
        sql: "INSERT INTO customers (name, email, created_at) VALUES (?, ?, ?)",
        args: ["Test Customer", "customer@example.com", new Date().toISOString()],
      });

      // 3. Create order with pivot relation (exercises strategy batching / transaction)
      const orderRes = await app.request("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: 1,
          totalAmount: 100,
          products: [{ productId, quantity: 2, priceAtTime: 100 }],
        }),
      });
      const orderData = await orderRes.json();
      expect(orderRes.status).toBe(201);
      expect(orderData.success).toBe(true);
      const orderId = orderData.data.id;

      // 4. Verify relations in pivot table
      const verifyRes = await client.execute({
        sql: "SELECT * FROM order_products WHERE order_id = ?",
        args: [orderId],
      });
      expect(verifyRes.rows.length).toBe(1);

      // 5. Update order and pivot quantity under the strategy
      const updateRes = await app.request(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalAmount: 150,
          products: [{ productId, quantity: 3, priceAtTime: 150 }],
        }),
      });
      const updateData = await updateRes.json();
      expect(updateRes.status).toBe(200);
      expect(updateData.success).toBe(true);

      const verifyUpdate = await client.execute({
        sql: "SELECT * FROM order_products WHERE order_id = ?",
        args: [orderId],
      });
      expect(verifyUpdate.rows.length).toBe(1);
      expect(verifyUpdate.rows[0].quantity).toBe(3);
    });
  }
});
