/**
 * Regression test for the row limit on an import payload.
 *
 * `maxRowsPerRequest` used to slice the payload: the rows past the limit
 * were dropped, and the import reported success. A partial import that
 * looks like a complete one is much harder to notice than a refused
 * request, so the payload is rejected instead — and nothing is written.
 */
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { DrizzleAdapter, createApp } from '@honocube/api';
import { z } from 'zod';

const notes = sqliteTable('notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull(),
  title: text('title').notNull(),
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

const rows = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ email: `row${i}@example.com`, title: `row ${i}` }));

async function main() {
  console.log('\n🧪 An import payload over the limit is refused');

  const client = createClient({ url: `file:test-import-limit.db` });
  const db = drizzle(client, { schema: { notes } });

  try { await client.execute(`DROP TABLE IF EXISTS notes`); } catch {}
  await client.execute(`
    CREATE TABLE notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      title TEXT NOT NULL
    )`);

  const app = createApp({
    adapter: new DrizzleAdapter(db, { dialect: 'sqlite', schema: { notes } }),
    strategy: 'none',
  });

  const notesResource = app.defineResource({
    name: 'notes',
    table: notes,
    methods: ['create', 'import-preview', 'import-execute'],
    import: { lookupBy: 'email', maxRowsPerRequest: 2 },
    validator: z.object({ email: z.string(), title: z.string() }),
  });

  const server = new Hono();
  server.route('/api/notes', notesResource);

  const countRows = async () => {
    const res = await client.execute(`SELECT COUNT(*) AS c FROM notes`);
    return Number((res.rows as any[])[0].c);
  };

  const post = (path: string, count: number) =>
    server.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rows(count)),
    });

  // --- Over the limit: refused, nothing written ----------------------------
  const tooMany = await post('/api/notes/import/execute', 3);
  const tooManyBody = await tooMany.json() as any;
  check('a payload over the limit is refused', tooMany.status === 400, `status ${tooMany.status}`);
  check(
    'the error names the row count and the limit',
    /3 rows/.test(tooManyBody?.error?.message ?? '') &&
      /limit for 'notes' is 2/.test(tooManyBody?.error?.message ?? ''),
    JSON.stringify(tooManyBody)
  );
  check(
    'the error carries the counts',
    tooManyBody?.error?.details?.rows === 3 && tooManyBody?.error?.details?.limit === 2,
    JSON.stringify(tooManyBody?.error?.details)
  );
  check('nothing was written', (await countRows()) === 0, `${await countRows()} rows`);

  // --- The preview refuses it as well --------------------------------------
  const preview = await post('/api/notes/import/preview', 3);
  check('the preview refuses it too', preview.status === 400, `status ${preview.status}`);
  check('the preview wrote nothing', (await countRows()) === 0, `${await countRows()} rows`);

  // --- At the limit: imported -----------------------------------------------
  const atLimit = await post('/api/notes/import/execute', 2);
  const atLimitBody = await atLimit.json() as any;
  check(
    'a payload at the limit is imported',
    atLimit.status === 200 && atLimitBody?.results?.creates?.length === 2,
    JSON.stringify(atLimitBody)
  );
  check('both rows were written', (await countRows()) === 2, `${await countRows()} rows`);

  await client.close();

  if (failures > 0) {
    console.error(`\n❌ ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\n🎉 ALL IMPORT LIMIT TESTS PASSED!');
}

main().catch((error) => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
