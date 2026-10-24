/**
 * Regression script for issues #11 and #17 — the default execution strategy
 * was defined in two places, and `createApp` mutated the caller's config.
 *
 * Before the fix:
 *   - `createApp` wrote `strategy: "batch"` and a default logger back into the
 *     object the caller passed in;
 *   - the create path fell back to `"none"` while every other write path fell
 *     back to `"batch"`, so the same resource behaved differently depending on
 *     which code path handled the request.
 *
 * After the fix the caller's object is never touched, and every write path
 * reads the same default from `DEFAULT_STRATEGY`.
 */
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import * as honocube from '@honocube/api';
import { z } from 'zod';

const { DrizzleAdapter, createApp, defineResource } = honocube;

const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  body: text('body'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at')
});

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

type Calls = { batch: number; insert: number; transaction: number };

/**
 * Wraps an adapter and counts the write paths it is asked to take, so the
 * strategy the framework picked is observable.
 */
function spyAdapter(adapter: any, supportsBatch: boolean): { adapter: any; calls: Calls } {
  const calls: Calls = { batch: 0, insert: 0, transaction: 0 };

  const wrapped = new Proxy(adapter, {
    get(target, prop, receiver) {
      if (prop === 'supportsBatch') return () => supportsBatch;
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      if (prop === 'batch') {
        return (...args: any[]) => {
          calls.batch++;
          return value.apply(target, args);
        };
      }
      if (prop === 'insert') {
        return (...args: any[]) => {
          calls.insert++;
          return value.apply(target, args);
        };
      }
      if (prop === 'transaction') {
        return (...args: any[]) => {
          calls.transaction++;
          return value.apply(target, args);
        };
      }
      return value.bind(target);
    }
  });

  return { adapter: wrapped, calls };
}

async function main() {
  const dbFile = `test-default-strategy.db`;
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

  const base = new DrizzleAdapter(db, { dialect: 'sqlite' });

  console.log('\n🧪 The default strategy has a single source of truth');
  {
    check('DEFAULT_STRATEGY is exported', (honocube as any).DEFAULT_STRATEGY === "batch", (honocube as any).DEFAULT_STRATEGY);
  }

  console.log('\n🧪 createApp does not mutate the caller\'s config');
  {
    const { adapter } = spyAdapter(base, true);
    const callerConfig: any = { adapter };

    createApp(callerConfig);

    check('the strategy is not written back', callerConfig.strategy === undefined, callerConfig.strategy);
    check('the logger is not written back', callerConfig.logger === undefined, callerConfig.logger);
    check('the config object is otherwise untouched', Object.keys(callerConfig).length === 1, Object.keys(callerConfig));
  }

  console.log('\n🧪 Calling createApp twice with the same config behaves the same');
  {
    const { adapter } = spyAdapter(base, true);
    const callerConfig: any = { adapter };

    const first = createApp(callerConfig);
    const second = createApp(callerConfig);

    const build = (framework: ReturnType<typeof createApp>) => {
      const resource = framework.defineResource({
        name: 'posts',
        table: posts,
        timestamps: true,
        validator: z.object({ title: z.string(), body: z.string().optional() })
      });
      const api = framework.defineApi({ posts: resource });
      const app = new Hono();
      app.route('/api', api);
      return app;
    };

    for (const framework of [first, second]) {
      const app = build(framework);
      const res = await app.request('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Written' })
      });
      const body = await res.json();
      check('the record is created', res.status === 201 && body?.success === true, body);
    }

    check('the config object is still untouched', callerConfig.strategy === undefined, callerConfig.strategy);
  }

  console.log('\n🧪 Every write path reads the same default (createApp, batch-capable driver)');
  {
    const { adapter, calls } = spyAdapter(base, true);
    const { defineResource: define, defineApi } = createApp({ adapter });

    const resource = define({
      name: 'posts',
      table: posts,
      timestamps: true,
      validator: z.object({ title: z.string(), body: z.string().optional() })
    });
    const api = defineApi({ posts: resource });
    const app = new Hono();
    app.route('/api', api);

    const created = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Consistent' })
    });
    const createdBody = await created.json();
    check('the record is created', created.status === 201 && createdBody?.success === true, createdBody);

    const batchAfterCreate = calls.batch;
    check('create takes the batch path', batchAfterCreate > 0, calls);
    check('create does not fall back to a bare insert', calls.insert === 0, calls);

    await app.request(`/api/posts/${createdBody.data.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'Updated' })
    });
    check('update takes the batch path too', calls.batch > batchAfterCreate, calls);
    check('update does not fall back to a bare insert', calls.insert === 0, calls);
  }

  console.log('\n🧪 Every write path reads the same default (no createApp at all)');
  {
    const { adapter, calls } = spyAdapter(base, true);

    const resource = defineResource({
      name: 'posts',
      table: posts,
      adapter,
      timestamps: true,
      validator: z.object({ title: z.string(), body: z.string().optional() })
    });
    const app = new Hono();
    app.route('/api/posts', resource);

    const created = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Standalone' })
    });
    const createdBody = await created.json();
    check('the record is created', created.status === 201 && createdBody?.success === true, createdBody);
    check('create takes the batch path', calls.batch > 0, calls);
    check('create does not fall back to a bare insert', calls.insert === 0, calls);

    const batchAfterCreate = calls.batch;
    await app.request(`/api/posts/${createdBody.data.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'Updated' })
    });
    check('update takes the batch path too', calls.batch > batchAfterCreate, calls);
  }

  console.log('\n🧪 A driver without batch support falls back to a transaction everywhere');
  {
    const { adapter, calls } = spyAdapter(base, false);
    const { defineResource: define, defineApi } = createApp({ adapter });

    const resource = define({
      name: 'posts',
      table: posts,
      timestamps: true,
      validator: z.object({ title: z.string(), body: z.string().optional() })
    });
    const api = defineApi({ posts: resource });
    const app = new Hono();
    app.route('/api', api);

    const created = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Transactional' })
    });
    const createdBody = await created.json();
    check('the record is created', created.status === 201 && createdBody?.success === true, createdBody);
    check('create runs in a transaction', calls.transaction > 0, calls);
    check('create does not call batch', calls.batch === 0, calls);
  }

  if (failures > 0) {
    console.error(`\n❌ ${failures} strategy check(s) failed.`);
    process.exit(1);
  }

  console.log('\n🎉 ALL DEFAULT STRATEGY TESTS PASSED SUCCESSFULLY!');
}

main().catch((error) => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
