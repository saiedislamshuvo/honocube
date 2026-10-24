/**
 * Regression script for issue #10 — pagination inputs are read from the query
 * string without validation.
 *
 * Before the fix:
 *   limit=0    -> totalPages: null (Infinity serialised as null)
 *   limit=-1   -> SQLite reads the negative limit as "no limit", every row is returned
 *   limit=abc  -> NaN propagates into the query
 *   page=0     -> negative offset
 *
 * After the fix the malformed inputs are refused with 400 INVALID_PAGINATION,
 * while a limit above the maximum is still silently capped.
 */
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { DrizzleAdapter, createApp } from '@honocube/api';
import { z } from 'zod';

const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  body: text('body'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at')
});

const ROWS = 25;

let failures = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`    ✅ ${label}`);
  } else {
    failures++;
    console.error(`    ❌ ${label}`);
    if (detail !== undefined) console.error(`       ${JSON.stringify(detail)}`);
  }
}

async function main() {
  const dbFile = `test-pagination.db`;
  const client = createClient({ url: `file:${dbFile}` });
  const db = drizzle(client, { schema: { posts } });

  try { await client.execute(`DROP TABLE IF EXISTS posts`); } catch (e) {}

  await client.execute(`
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )
  `);

  for (let i = 1; i <= ROWS; i++) {
    await client.execute({
      sql: 'INSERT INTO posts (title, body, created_at) VALUES (?, ?, ?)',
      args: [`Post ${i}`, `Body ${i}`, new Date().toISOString()]
    });
  }

  const adapter = new DrizzleAdapter(db, { dialect: 'sqlite' });
  const { defineResource, defineApi } = createApp({ adapter });

  const postsResource = defineResource({
    name: 'posts',
    table: posts,
    timestamps: true,
    pagination: { defaultLimit: 20, maxLimit: 100 },
    validator: z.object({ title: z.string(), body: z.string().optional() })
  });

  const api = defineApi({ posts: postsResource });
  const app = new Hono();
  app.route('/api', api);

  const get = async (query: string) => {
    const res = await app.request(`/api/posts${query}`);
    const body = await res.json();
    return { status: res.status, body };
  };

  console.log('\n🧪 Default pagination');
  {
    const { status, body } = await get('');
    check('returns 200', status === 200, body);
    check('applies the default limit (20)', body?.meta?.limit === 20, body?.meta);
    check('counts every row (25)', body?.meta?.total === ROWS, body?.meta);
    check('computes totalPages (2)', body?.meta?.totalPages === 2, body?.meta);
    check('returns the first page of rows (20)', body?.data?.length === 20, body?.data?.length);
  }

  console.log('\n🧪 Malformed limit is refused');
  for (const [query, shown] of [['limit=0', 0], ['limit=-1', -1], ['limit=1.5', 1.5], ['limit=abc', 'abc']] as const) {
    const { status, body } = await get(`?${query}`);
    check(`${query} -> 400`, status === 400, body);
    check(`${query} -> INVALID_PAGINATION`, body?.error?.code === 'INVALID_PAGINATION', body?.error);
    check(`${query} -> names the offending value (${shown})`, String(body?.error?.message).includes(String(shown)), body?.error?.message);
    check(`${query} -> no rows are returned`, body?.data === undefined, body?.data);
  }

  console.log('\n🧪 Malformed page is refused');
  for (const [query, shown] of [['page=0', 0], ['page=-1', -1], ['page=abc', 'abc']] as const) {
    const { status, body } = await get(`?${query}`);
    check(`${query} -> 400`, status === 400, body);
    check(`${query} -> INVALID_PAGINATION`, body?.error?.code === 'INVALID_PAGINATION', body?.error);
    check(`${query} -> names the offending value (${shown})`, String(body?.error?.message).includes(String(shown)), body?.error?.message);
  }

  console.log('\n🧪 A limit above the maximum is still capped');
  {
    const { status, body } = await get('?limit=5000');
    check('returns 200', status === 200, body);
    check('caps the limit at maxLimit (100)', body?.meta?.limit === 100, body?.meta);
    check('still counts every row (25)', body?.meta?.total === ROWS, body?.meta);
    check('still reports totalPages as a number (1)', body?.meta?.totalPages === 1, body?.meta);
  }

  console.log('\n🧪 Paging');
  {
    const first = await get('?limit=10&page=1');
    const second = await get('?limit=10&page=2');
    const third = await get('?limit=10&page=3');

    check('page 1 returns 10 rows', first.body?.data?.length === 10, first.body?.data?.length);
    check('page 2 returns 10 rows', second.body?.data?.length === 10, second.body?.data?.length);
    check('page 3 returns the remaining 5 rows', third.body?.data?.length === 5, third.body?.data?.length);
    check('page 2 reports its own page number', second.body?.meta?.page === 2, second.body?.meta);
    check('page 2 reports totalPages (3)', second.body?.meta?.totalPages === 3, second.body?.meta);
    check(
      'page 2 holds different rows than page 1',
      first.body?.data?.[0]?.id !== second.body?.data?.[0]?.id,
      [first.body?.data?.[0]?.id, second.body?.data?.[0]?.id]
    );
  }

  console.log('\n🧪 totalPages is always a number');
  {
    for (const query of ['', '?limit=1', '?limit=5000', '?page=2']) {
      const { body } = await get(query);
      const totalPages = body?.meta?.totalPages;
      check(
        `${query || '(no query)'} -> totalPages is a finite number`,
        typeof totalPages === 'number' && Number.isFinite(totalPages),
        totalPages
      );
    }

    // A refused request answers with an error envelope and no meta at all —
    // it never carries a `totalPages: null`.
    for (const query of ['?limit=0', '?limit=-1', '?page=0']) {
      const { body } = await get(query);
      check(
        `${query} -> the error envelope carries no meta`,
        body?.meta === undefined && body?.success === false,
        body
      );
    }
  }

  if (failures > 0) {
    console.error(`\n❌ ${failures} pagination check(s) failed.`);
    process.exit(1);
  }

  console.log('\n🎉 ALL PAGINATION TESTS PASSED SUCCESSFULLY!');
}

main().catch((error) => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
