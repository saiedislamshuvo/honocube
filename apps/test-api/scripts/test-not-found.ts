/**
 * Regression test for the not-found answer of a resource.
 *
 * A path that is not registered under a resource — `/posts/1/2`, or a
 * collection whose `list` method is switched off — used to fall through to
 * Hono's default not-found handler, which answers with a bare
 * `404 Not Found` text body. The very same failure on a *registered* path
 * (a record that does not exist) answered with the framework's error
 * envelope, so a client parsing that envelope got a parse error instead of a
 * structured error.
 */
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { DrizzleAdapter, createApp, defineApi } from '@honocube/api';
import { z } from 'zod';

const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  createdAt: text('created_at'),
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

const isEnvelope = (body: any, code: string) =>
  body?.success === false && body?.error?.code === code;

async function main() {
  const client = createClient({ url: 'file:test-not-found.db' });
  const db = drizzle(client, { schema: { posts } });

  try { await client.execute(`DROP TABLE IF EXISTS posts`); } catch {}

  await client.execute(`
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    )`);

  await client.execute({
    sql: `INSERT INTO posts (title, created_at) VALUES (?, ?)`,
    args: ['hello', new Date().toISOString()],
  });

  const app = createApp({
    adapter: new DrizzleAdapter(db, { dialect: 'sqlite', schema: { posts } }),
  });

  const postsResource = app.defineResource({
    name: 'posts',
    table: posts,
    timestamps: true,
    validator: z.object({ title: z.string() }),
  });

  // A resource whose `list` method is switched off — its collection path is
  // not registered at all.
  const tagsResource = app.defineResource({
    name: 'tags',
    table: posts,
    methods: ['detail'],
    validator: z.object({ title: z.string() }),
  });

  const server = new Hono();
  server.route('/api/posts', postsResource);
  server.route('/api/tags', tagsResource);

  // A route the application registers itself, under a resource's path.
  server.get('/api/posts/:id/comments', (c) => c.json({ ok: 'user route' }));

  // --- The registered routes still answer -----------------------------------
  const list = await server.request('/api/posts');
  check("the list route still answers", list.status === 200, `status ${list.status}`);

  const detail = await server.request('/api/posts/1');
  check("the detail route still answers", detail.status === 200, `status ${detail.status}`);

  // --- A record that does not exist: the framework's envelope ---------------
  const missing = await server.request('/api/posts/999');
  const missingBody = await missing.json().catch(() => null);
  check("a missing record answers 404", missing.status === 404, `status ${missing.status}`);
  check(
    "a missing record answers with the envelope",
    isEnvelope(missingBody, 'NOT_FOUND'),
    JSON.stringify(missingBody)
  );

  // --- A path no route handled: the same envelope ---------------------------
  const unregistered = await server.request('/api/posts/1/2');
  const unregisteredBody = await unregistered.json().catch(() => null);
  check("an unregistered path answers 404", unregistered.status === 404, `status ${unregistered.status}`);
  check(
    "an unregistered path answers with the envelope",
    isEnvelope(unregisteredBody, 'NOT_FOUND'),
    JSON.stringify(unregisteredBody)
  );
  check(
    "the envelope reports the path that was not found",
    unregisteredBody?.error?.details?.path === '/api/posts/1/2',
    JSON.stringify(unregisteredBody?.error?.details)
  );

  // --- A collection whose list method is switched off ------------------------
  const noList = await server.request('/api/tags');
  const noListBody = await noList.json().catch(() => null);
  check("a collection without a list route answers 404", noList.status === 404, `status ${noList.status}`);
  check(
    "a collection without a list route answers with the envelope",
    isEnvelope(noListBody, 'NOT_FOUND'),
    JSON.stringify(noListBody)
  );

  // --- A route the application registered itself still wins ------------------
  const userRoute = await server.request('/api/posts/1/comments');
  const userBody = await userRoute.json().catch(() => null);
  check("a route registered by the application still answers", userRoute.status === 200, `status ${userRoute.status}`);
  check(
    "the application's own route is not shadowed",
    userBody?.ok === 'user route',
    JSON.stringify(userBody)
  );

  // --- Paths outside a resource are left alone ------------------------------
  const outside = await server.request('/api/unknown');
  const outsideType = outside.headers.get('content-type') ?? '';
  check(
    "a path outside a resource keeps the application's own answer",
    outside.status === 404 && !outsideType.includes('application/json'),
    `status ${outside.status}, content-type ${outsideType}`
  );

  // --- A not-found handler the application installed itself is respected -----
  const custom = new Hono();
  custom.notFound((c) => c.json({ custom: 'not found' }, 404));
  custom.route('/api/posts', postsResource);

  const customRes = await custom.request('/api/posts/1/2');
  const customBody = await customRes.json().catch(() => null);
  check(
    "an application's own not-found handler still answers",
    customBody?.custom === 'not found',
    JSON.stringify(customBody)
  );

  // --- The same, through the API gateway ------------------------------------
  const api = defineApi({ posts: postsResource });
  const apiServer = new Hono();
  apiServer.route('/api', api);

  const viaApi = await apiServer.request('/api/posts/1/2');
  const viaApiBody = await viaApi.json().catch(() => null);
  check(
    "an unregistered path answers with the envelope through defineApi",
    viaApi.status === 404 && isEnvelope(viaApiBody, 'NOT_FOUND'),
    `status ${viaApi.status}, ${JSON.stringify(viaApiBody)}`
  );

  await client.close();

  if (failures > 0) {
    console.error(`\n❌ ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\n🎉 ALL NOT-FOUND TESTS PASSED!');
}

main().catch((error) => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
