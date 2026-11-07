import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const client = createClient({
  url: process.env.DATABASE_URL || "file:crm.db",
});

export const db = drizzle(client, { schema });

// Auto-migrate tables and seed initial records on cold start
let initialized = false;

export async function ensureDbInitialized() {
  if (initialized) return;
  initialized = true;

  try {
    // 1. Create tables if not exist
    await client.execute(`
      CREATE TABLE IF NOT EXISTS deals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        company TEXT NOT NULL,
        amount INTEGER NOT NULL DEFAULT 0,
        stage TEXT NOT NULL DEFAULT 'lead',
        priority TEXT NOT NULL DEFAULT 'medium',
        contact_name TEXT,
        contact_email TEXT,
        close_date TEXT,
        notes TEXT,
        created_at TEXT,
        updated_at TEXT
      );
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        company TEXT,
        phone TEXT,
        city TEXT,
        status TEXT NOT NULL DEFAULT 'lead',
        created_at TEXT,
        updated_at TEXT
      );
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        issue_date TEXT NOT NULL,
        due_date TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        status TEXT NOT NULL DEFAULT 'draft',
        subtotal INTEGER NOT NULL DEFAULT 0,
        tax INTEGER NOT NULL DEFAULT 0,
        grand_total INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT,
        updated_at TEXT
      );
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price INTEGER NOT NULL DEFAULT 0,
        amount INTEGER NOT NULL DEFAULT 0
      );
    `);

    // 2. Check if already seeded
    const countRes = await client.execute("SELECT COUNT(*) as count FROM deals;");
    const count = Number(countRes.rows[0]?.count ?? 0);

    if (count === 0) {
      const now = new Date().toISOString();

      // Seed Deals
      await client.execute({
        sql: `INSERT INTO deals (title, company, amount, stage, priority, contact_name, contact_email, close_date, notes, created_at, updated_at) VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          "Stripe Global Integration", "Acme Corp", 45000, "proposal", "high", "Sarah Connor", "sarah@acme.com", "2026-11-20", "Needs PCI compliance signoff.", now, now,
          "Enterprise Cloud Migration", "Cyberdyne Systems", 120000, "negotiation", "urgent", "John Connor", "john@cyberdyne.com", "2026-11-30", "Legal review pending.", now, now,
          "Annual Team License", "Pied Piper", 18000, "lead", "medium", "Richard Hendricks", "richard@piedpiper.com", "2026-12-15", "Interested in middle-out compression API.", now, now,
          "Security Audit & Compliance", "Initech Corp", 62000, "qualified", "high", "Peter Gibbons", "peter@initech.com", "2026-11-25", "Follow up after TPS report review.", now, now,
          "AI Analytics Addon", "Wayne Enterprises", 95000, "won", "urgent", "Bruce Wayne", "bruce@wayne.com", "2026-10-31", "Closed successfully.", now, now,
          "Legacy System Maintenance", "Massive Dynamic", 35000, "lost", "low", "Nina Sharp", "nina@massivedynamic.com", "2026-10-15", "Went with internal tooling.", now, now,
        ],
      });

      // Seed Contacts
      await client.execute({
        sql: `INSERT INTO contacts (name, email, company, phone, city, status, created_at, updated_at) VALUES
          (?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          "Sarah Connor", "sarah@acme.com", "Acme Corp", "+1 555-0101", "San Francisco", "active", now, now,
          "John Connor", "john@cyberdyne.com", "Cyberdyne Systems", "+1 555-0102", "Los Angeles", "active", now, now,
          "Richard Hendricks", "richard@piedpiper.com", "Pied Piper", "+1 555-0103", "Palo Alto", "lead", now, now,
          "Peter Gibbons", "peter@initech.com", "Initech Corp", "+1 555-0104", "Austin", "active", now, now,
          "Bruce Wayne", "bruce@wayne.com", "Wayne Enterprises", "+1 555-0105", "Gotham", "active", now, now,
        ],
      });

      // Seed Invoices
      await client.execute({
        sql: `INSERT INTO invoices (invoice_number, customer_name, issue_date, due_date, currency, status, subtotal, tax, grand_total, notes, created_at, updated_at) VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          "INV-2026-0001", "Acme Corp", "2026-11-01", "2026-11-15", "USD", "submitted", 45000, 4500, 49500, "Net 15 terms.", now, now,
          "INV-2026-0002", "Wayne Enterprises", "2026-10-15", "2026-10-30", "USD", "paid", 95000, 9500, 104500, "Paid via Wire Transfer.", now, now,
          "INV-2026-0003", "Initech Corp", "2026-11-02", "2026-11-20", "USD", "draft", 62000, 6200, 68200, "Draft invoice for security audit.", now, now,
        ],
      });

      // Seed Invoice Items
      await client.execute({
        sql: `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES
          (?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?)`,
        args: [
          1, "Stripe API Integration Services", 1, 35000, 35000,
          1, "Developer Training & Handover", 1, 10000, 10000,
          2, "AI Analytics License (1 Year)", 1, 80000, 80000,
          2, "Dedicated Support Tier 1", 1, 15000, 15000,
          3, "Security Audit Assessment", 1, 62000, 62000,
        ],
      });
    }
  } catch (err) {
    console.error("Database initialization error:", err);
  }
}
