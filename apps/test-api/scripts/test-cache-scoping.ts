/**
 * Regression test for the cache key of the read paths.
 *
 * The cache key used to be built from the resource name, the operation, the
 * id and the query string — nothing that says *who* is asking. With `scope`
 * in play, the first caller's response was then handed to every other caller
 * that sent the same query, including rows the scope should have filtered
 * out.
 *
 * The key now carries a caller dimension, taken from `cache.keyBy`. When a
 * resource enables the cache without saying what identifies the caller, the
 * response is served from the database and nothing is read from or written
 * to the cache — sharing one key between callers would leak rows between
 * them.
 */
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { AppCache, DrizzleAdapter, createApp } from '@honocube/api';
import { z } from 'zod';

const documents = sqliteTable('documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerId: integer('owner_id').notNull(),
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

/**
 * A cache provider that keeps everything in memory and counts the calls, so
 * the test can tell "not cached" from "cached and served".
 */
class MemoryCache implements AppCache {
  store = new Map<string, any>();
  gets = 0;
  sets = 0;

  async get(key: string) {
    this.gets++;
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: any) {
    this.sets++;
    this.store.set(key, value);
  }

  async delete(key: string) {
    this.store.delete(key);
  }

  async clear(prefix: string) {
    for (const key of [...this.store.keys()]) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}

async function setupDb() {
  const client = createClient({ url: `file:test-cache-scoping.db` });
  const db = drizzle(client, { schema: { documents } });

  try { await client.execute(`DROP TABLE IF EXISTS documents`); } catch {}

  await client.execute(`
    CREATE TABLE documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      title TEXT NOT NULL
    )`);

  // Row 1 belongs to user 1, row 2 belongs to user 2.
  await client.execute({ sql: `INSERT INTO documents (owner_id, title) VALUES (?, ?)`, args: [1, 'mine'] });
  await client.execute({ sql: `INSERT INTO documents (owner_id, title) VALUES (?, ?)`, args: [2, 'theirs'] });

  return { client, db };
}

function buildApp(db: any, cache: MemoryCache, cacheConfig: any) {
  const app = createApp({
    adapter: new DrizzleAdapter(db, { dialect: 'sqlite', schema: { documents } }),
    strategy: 'none',
    cache,
    getContext: (c: any) => {
      const header = c.req.header('x-user-id');
      return { userId: header ? Number(header) : undefined };
    },
  });

  const documentsResource = app.defineResource({
    name: 'documents',
    table: documents,
    validator: z.object({ title: z.string() }),
    // Row-Level Security: a caller only ever sees their own rows.
    scope: (cols: any, ops: any, ctx: any) =>
      ctx.userId === undefined ? undefined : ops.eq(cols.ownerId, ctx.userId),
    cache: cacheConfig,
  });

  const server = new Hono();
  server.route('/api/documents', documentsResource);
  return server;
}

const userKey = (ctx: any) => (ctx.userId === undefined ? undefined : `u:${ctx.userId}`);

/**
 * Two callers sending the same query must not be served each other's
 * response.
 */
async function testListIsPartitionedByCaller() {
  console.log('\n🧪 The list cache key identifies the caller');

  const { client, db } = await setupDb();
  const cache = new MemoryCache();
  const server = buildApp(db, cache, { enabled: true, ttl: 60, keyBy: userKey });

  const list = async (userId?: number) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userId !== undefined) headers['x-user-id'] = String(userId);
    const res = await server.request('/api/documents', { headers });
    return { status: res.status, body: await res.json() as any };
  };

  const first = await list(1);
  check(
    'user 1 sees their own row',
    first.status === 200 && first.body?.data?.length === 1 && first.body.data[0].title === 'mine',
    JSON.stringify(first.body)
  );

  const second = await list(2);
  check(
    'user 2 sees their own row, not user 1\'s',
    second.status === 200 && second.body?.data?.length === 1 && second.body.data[0].title === 'theirs',
    JSON.stringify(second.body)
  );

  check('both responses were cached separately', cache.store.size === 2, `${cache.store.size} entries`);
  const keys = [...cache.store.keys()];
  console.log(`    keys: ${keys.join(' | ')}`);
  check(
    'the cache key carries the caller',
    keys.some((k) => k.includes('u:1')) && keys.some((k) => k.includes('u:2')),
    keys.join(', ')
  );

  // The second request of the same caller has to come from the cache —
  // otherwise the fix would simply have turned caching off.
  const setsBefore = cache.sets;
  const repeat = await list(1);
  check(
    'a repeated request is served from the cache',
    cache.sets === setsBefore && repeat.body?.data?.[0]?.title === 'mine',
    `sets: ${setsBefore} -> ${cache.sets}`
  );

  await client.close();
}

/**
 * The detail path looked the row up in the cache before the scope filter was
 * applied, so a cached row was served to a caller that may not see it.
 */
async function testDetailIsPartitionedByCaller() {
  console.log('\n🧪 The detail cache key identifies the caller');

  const { client, db } = await setupDb();
  const cache = new MemoryCache();
  const server = buildApp(db, cache, { enabled: true, ttl: 60, keyBy: userKey });

  const headers = (userId: number) => ({ 'x-user-id': String(userId) });

  const mine = await server.request('/api/documents/1', { headers: headers(1) });
  check('user 1 can read their own row', mine.status === 200, `status ${mine.status}`);

  const theirs = await server.request('/api/documents/1', { headers: headers(2) });
  check(
    "user 2 cannot read user 1's row through the cache",
    theirs.status === 404,
    `status ${theirs.status}: ${JSON.stringify(await theirs.clone().json())}`
  );

  await client.close();
}

/**
 * Without `keyBy` there is no caller dimension, so the response must not be
 * cached at all.
 */
async function testCacheIsSkippedWithoutACallerKey() {
  console.log('\n🧪 A resource without cache.keyBy is not cached');

  const { client, db } = await setupDb();
  const cache = new MemoryCache();
  const server = buildApp(db, cache, { enabled: true, ttl: 60 });

  const list = async (userId: number) => {
    const res = await server.request('/api/documents', { headers: { 'x-user-id': String(userId) } });
    return { status: res.status, body: await res.json() as any };
  };

  const first = await list(1);
  check(
    'user 1 sees their own row',
    first.status === 200 && first.body?.data?.length === 1 && first.body.data[0].title === 'mine',
    JSON.stringify(first.body)
  );

  const second = await list(2);
  check(
    'user 2 sees their own row',
    second.status === 200 && second.body?.data?.length === 1 && second.body.data[0].title === 'theirs',
    JSON.stringify(second.body)
  );

  check('nothing was written to the cache', cache.sets === 0 && cache.store.size === 0, `${cache.sets} writes`);
  check('the cache was never read', cache.gets === 0, `${cache.gets} reads`);

  await client.close();
}

/**
 * A caller that `keyBy` cannot identify — an anonymous one, for instance —
 * has no place in the key, so its response stays uncached.
 */
async function testUnidentifiableCallersAreNotCached() {
  console.log('\n🧪 A caller without an identity is not cached');

  const { client, db } = await setupDb();
  const cache = new MemoryCache();
  const server = buildApp(db, cache, { enabled: true, ttl: 60, keyBy: userKey });

  const res = await server.request('/api/documents');
  check('the request succeeds', res.status === 200, `status ${res.status}`);
  check('the response was not cached', cache.store.size === 0 && cache.sets === 0, `${cache.sets} writes`);

  await client.close();
}

/**
 * A write has to clear the cached responses of every caller, so the
 * invalidation prefix still has to match the new key format.
 */
async function testWritesInvalidateTheCache() {
  console.log('\n🧪 A write invalidates the cached responses');

  const { client, db } = await setupDb();
  const cache = new MemoryCache();
  const server = buildApp(db, cache, { enabled: true, ttl: 60, keyBy: userKey });

  const list = async () => {
    const res = await server.request('/api/documents', { headers: { 'x-user-id': '1' } });
    return await res.json() as any;
  };

  await list();
  check('the list was cached', cache.store.size === 1, `${cache.store.size} entries`);

  const update = await server.request('/api/documents/1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify({ title: 'updated' }),
  });
  check('the update succeeds', update.status === 200, `status ${update.status}`);
  check('the cache was cleared', cache.store.size === 0, `${cache.store.size} entries left`);

  const after = await list();
  check('the list reflects the update', after?.data?.[0]?.title === 'updated', JSON.stringify(after));

  await client.close();
}

async function main() {
  try {
    await testListIsPartitionedByCaller();
    await testDetailIsPartitionedByCaller();
    await testCacheIsSkippedWithoutACallerKey();
    await testUnidentifiableCallersAreNotCached();
    await testWritesInvalidateTheCache();

    if (failures > 0) {
      console.error(`\n❌ ${failures} check(s) failed`);
      process.exit(1);
    }
    console.log('\n🎉 ALL CACHE SCOPING TESTS PASSED!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
