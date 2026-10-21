/**
 * Regression test for the row-level scope and the soft-delete filter on the
 * single-record write paths.
 *
 * The read paths (`list`, `detail`) apply both filters, but `PATCH /:id` and
 * `DELETE /:id` used to look the row up and write it with nothing but
 * `eq(cols.id, id)`. A caller could therefore update or delete a row that
 * belonged to somebody else — or a row that had been soft-deleted — simply
 * by guessing its id.
 *
 * The test runs against every execution strategy, because the update path
 * builds its statement differently for `batch` and for the imperative ones.
 */
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { DrizzleAdapter, createApp, DatabaseStrategy } from '@honocube/api';
import { z } from 'zod';

const documents = sqliteTable('documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerId: integer('owner_id').notNull(),
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

async function runTest(strategy: DatabaseStrategy) {
  console.log(`\n🧪 Scope and soft-delete enforcement — strategy "${strategy}"`);

  const client = createClient({ url: `file:test-scope-${strategy}.db` });
  const db = drizzle(client, { schema: { documents } });

  try { await client.execute(`DROP TABLE IF EXISTS documents`); } catch {}

  await client.execute(`
    CREATE TABLE documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )`);

  // Seeded directly, so the rows exist without going through the API:
  //   1 — owned by user 1
  //   2 — owned by user 2
  //   3 — owned by user 1, but soft-deleted
  await client.execute({
    sql: `INSERT INTO documents (owner_id, title, deleted_at, created_at) VALUES (?, ?, ?, ?)`,
    args: [1, 'mine', null, new Date().toISOString()],
  });
  await client.execute({
    sql: `INSERT INTO documents (owner_id, title, deleted_at, created_at) VALUES (?, ?, ?, ?)`,
    args: [2, 'theirs', null, new Date().toISOString()],
  });
  const deletedAt = new Date().toISOString();
  await client.execute({
    sql: `INSERT INTO documents (owner_id, title, deleted_at, created_at) VALUES (?, ?, ?, ?)`,
    args: [1, 'mine but deleted', deletedAt, new Date().toISOString()],
  });

  const app = createApp({
    adapter: new DrizzleAdapter(db, { dialect: 'sqlite', schema: { documents } }),
    strategy,
    getContext: (c) => ({ userId: Number(c.req.header('x-user-id')) }),
  });

  const documentsResource = app.defineResource({
    name: 'documents',
    table: documents,
    softDelete: 'deletedAt',
    timestamps: true,
    validator: z.object({ title: z.string() }),
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

  const readRow = async (id: number) => {
    const res = await client.execute({ sql: `SELECT * FROM documents WHERE id = ?`, args: [id] });
    return (res.rows as any[])[0];
  };

  // --- Baseline: the read path already applied both filters -----------------
  const readOther = await asUser(1, '/api/documents/2');
  check("another user's row is not readable", readOther.status === 404, `status ${readOther.status}`);

  // --- Another user's row must not be writable ------------------------------
  const updateOther = await asUser(1, '/api/documents/2', {
    method: 'PATCH',
    body: JSON.stringify({ title: 'hijacked' }),
  });
  check("updating another user's row returns 404", updateOther.status === 404, `status ${updateOther.status}`);
  check("another user's row is unchanged", (await readRow(2))?.title === 'theirs');

  const deleteOther = await asUser(1, '/api/documents/2', { method: 'DELETE' });
  check("deleting another user's row returns 404", deleteOther.status === 404, `status ${deleteOther.status}`);
  check("another user's row still exists", (await readRow(2))?.deleted_at === null);

  // --- A soft-deleted row must not be writable either -----------------------
  const updateDeleted = await asUser(1, '/api/documents/3', {
    method: 'PATCH',
    body: JSON.stringify({ title: 'resurrected' }),
  });
  check("updating a soft-deleted row returns 404", updateDeleted.status === 404, `status ${updateDeleted.status}`);
  check("the soft-deleted row is unchanged", (await readRow(3))?.title === 'mine but deleted');

  const deleteDeleted = await asUser(1, '/api/documents/3', { method: 'DELETE' });
  check("deleting a soft-deleted row returns 404", deleteDeleted.status === 404, `status ${deleteDeleted.status}`);
  check("the soft-deleted row is still deleted", (await readRow(3))?.deleted_at === deletedAt);

  // --- The caller's own row is still writable -------------------------------
  const updateOwn = await asUser(1, '/api/documents/1', {
    method: 'PATCH',
    body: JSON.stringify({ title: 'updated' }),
  });
  check("updating your own row succeeds", updateOwn.status === 200, `status ${updateOwn.status}`);
  check("your own row is updated", (await readRow(1))?.title === 'updated');

  const deleteOwn = await asUser(1, '/api/documents/1', { method: 'DELETE' });
  check("deleting your own row succeeds", deleteOwn.status === 200, `status ${deleteOwn.status}`);
  check("your own row is soft-deleted", (await readRow(1))?.deleted_at !== null);

  await client.close();
}

async function main() {
  try {
    await runTest('none');
    await runTest('transaction');
    await runTest('batch');

    if (failures > 0) {
      console.error(`\n❌ ${failures} check(s) failed`);
      process.exit(1);
    }
    console.log('\n🎉 ALL SCOPE ENFORCEMENT TESTS PASSED!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
