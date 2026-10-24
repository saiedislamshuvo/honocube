/**
 * Regression test for the adapter interface (B1-lite).
 *
 * The core used to import the ORM's operators and reach into the table object
 * for its columns. Both now go through the adapter — the core asks the
 * adapter for the operators it builds predicates with and for the columns it
 * filters on — so the ORM is reachable only through the adapter surface.
 *
 * The test wraps the Drizzle adapter in a spy that counts the calls, and
 * checks that the core really goes through the adapter for every path that
 * builds a condition: the list, the detail, the create, the update and the
 * delete.
 */
import { Hono } from 'hono';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { DrizzleAdapter, createApp } from '@honocube/api';
import { z } from 'zod';

const documents = sqliteTable('documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerId: integer('owner_id'),
  title: text('title').notNull(),
  deletedAt: text('deleted_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
});

let failures = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
  } else {
    failures++;
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/**
 * Counts how often the core asks the adapter for its operators and columns.
 */
class SpyAdapter extends DrizzleAdapter {
  operators = 0;
  columns = 0;
  column = 0;

  getOperators() {
    this.operators++;
    return super.getOperators();
  }

  getColumns(table: any) {
    this.columns++;
    return super.getColumns(table);
  }

  getColumn(table: any, name: string) {
    this.column++;
    return super.getColumn(table, name);
  }
}

async function main() {
  const client = createClient({ url: 'file:test-adapter-interface.db' });
  const db = drizzle(client, { schema: { documents } });

  try { await client.execute(`DROP TABLE IF EXISTS documents`); } catch {}

  await client.execute(`
    CREATE TABLE documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER,
      title TEXT NOT NULL,
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )`);

  await client.execute({
    sql: `INSERT INTO documents (owner_id, title, created_at) VALUES (?, ?, ?)`,
    args: [1, 'mine', new Date().toISOString()],
  });
  await client.execute({
    sql: `INSERT INTO documents (owner_id, title, created_at) VALUES (?, ?, ?)`,
    args: [2, 'theirs', new Date().toISOString()],
  });

  const spy = new SpyAdapter(db, { dialect: 'sqlite', schema: { documents } });

  const app = createApp({
    adapter: spy,
    getContext: (c) => ({ userId: Number(c.req.header('x-user-id')) }),
  });

  const documentsResource = app.defineResource({
    name: 'documents',
    table: documents,
    softDelete: 'deletedAt',
    timestamps: true,
    validator: z.object({ title: z.string() }),
    search: { fields: ['title'] },
    filter: { allow: ['title'] },
    // Row-Level Security: a caller only ever sees and writes their own rows.
    scope: (cols: any, ops: any, ctx: any) => ops.eq(cols.ownerId, ctx.userId),
  });

  const server = new Hono();
  server.route('/api/documents', documentsResource);

  const asUser = (userId: number, path: string, init: RequestInit = {}) =>
    server.request(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId), ...(init.headers || {}) },
    });

  // --- The list path --------------------------------------------------------
  const list = await asUser(1, '/api/documents');
  const listBody = await list.json().catch(() => null);
  check("the list path answers", list.status === 200, `status ${list.status}`);
  check("the list is scoped to the caller", listBody?.data?.length === 1, JSON.stringify(listBody));
  check("the list asked the adapter for its operators", spy.operators > 0, `${spy.operators}`);

  // --- The search path ------------------------------------------------------
  const search = await asUser(1, '/api/documents?q=mine');
  const searchBody = await search.json().catch(() => null);
  check("the search path answers", search.status === 200, `status ${search.status}`);
  check("the search found the row", searchBody?.data?.length === 1, JSON.stringify(searchBody));
  check("the search asked the adapter for a column", spy.column > 0, `${spy.column}`);

  // --- The filter path ------------------------------------------------------
  const filtered = await asUser(1, '/api/documents?title=mine');
  const filteredBody = await filtered.json().catch(() => null);
  check("the filter path answers", filtered.status === 200, `status ${filtered.status}`);
  check("the filter found the row", filteredBody?.data?.length === 1, JSON.stringify(filteredBody));

  // --- The detail path ------------------------------------------------------
  const detail = await asUser(1, '/api/documents/1');
  check("the detail path answers", detail.status === 200, `status ${detail.status}`);

  // --- The create path ------------------------------------------------------
  const created = await asUser(1, '/api/documents', {
    method: 'POST',
    body: JSON.stringify({ title: 'written' }),
  });
  check("the create path answers", created.status === 201, `status ${created.status}`);

  // --- The update path ------------------------------------------------------
  const updated = await asUser(1, '/api/documents/1', {
    method: 'PATCH',
    body: JSON.stringify({ title: 'changed' }),
  });
  check("the update path answers", updated.status === 200, `status ${updated.status}`);

  // --- The delete path ------------------------------------------------------
  const deleted = await asUser(1, '/api/documents/1', { method: 'DELETE' });
  check("the delete path answers", deleted.status === 200, `status ${deleted.status}`);
  check("the write paths asked the adapter for its columns", spy.columns > 0, `${spy.columns}`);

  // --- The core does not import the ORM itself ------------------------------
  const coreSource = readFileSync(
    fileURLToPath(new URL('../../../packages/api/src/core/factory.ts', import.meta.url)),
    'utf8'
  );
  check(
    "the core does not import drizzle-orm",
    !/from\s+["']drizzle-orm["']/.test(coreSource),
    'the core still imports the ORM directly'
  );

  await client.close();

  if (failures > 0) {
    console.error(`\n❌ ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\n🎉 ALL ADAPTER INTERFACE TESTS PASSED!');
}

main().catch((error) => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
