/**
 * Regression script for issue #12 — `processUploads` recursed into nested
 * values without the type guard its sibling `finalize` has.
 *
 * Before the fix a relation field holding a plain string was spread into an
 * object of its characters, a number became an empty object, and a boolean
 * was lost — the caller got back something that was never in the request.
 *
 * The `beforeCreate` hook is the observation point: it receives the payload
 * after `processUploads` has run and before the validator strips it.
 */
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { DrizzleAdapter, createApp } from '@honocube/api';
import { z } from 'zod';

const authors = sqliteTable('authors', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull()
});

const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  authorId: integer('author_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at')
});

const comments = sqliteTable('comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  body: text('body'),
  postId: integer('post_id'),
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

async function main() {
  const client = createClient({ url: `file:test-process-uploads.db` });
  const db = drizzle(client, { schema: { authors, posts, comments } });

  try { await client.execute(`DROP TABLE IF EXISTS comments`); } catch (e) {}
  try { await client.execute(`DROP TABLE IF EXISTS posts`); } catch (e) {}
  try { await client.execute(`DROP TABLE IF EXISTS authors`); } catch (e) {}

  await client.execute(`
    CREATE TABLE authors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `);
  await client.execute(`
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )
  `);
  await client.execute(`
    CREATE TABLE comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      body TEXT,
      post_id INTEGER,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  await client.execute({ sql: 'INSERT INTO authors (name) VALUES (?)', args: ['Ada'] });

  let seen: any = null;
  const { defineResource, defineApi } = createApp({
    adapter: new DrizzleAdapter(db, { dialect: 'sqlite' })
  });

  const postsResource = defineResource({
    name: 'posts',
    table: posts,
    timestamps: true,
    validator: z.object({ title: z.string() }),
    hooks: {
      beforeCreate: async (data: any) => {
        seen = data;
        return data;
      }
    },
    relations: {
      one: [
        { name: 'author', table: authors, foreignKey: 'authorId', referenceKey: 'id' }
      ],
      many: [
        {
          name: 'comments',
          table: comments,
          foreignKey: 'postId',
          referenceKey: 'id',
          schema: z.object({ body: z.string().optional() })
        }
      ]
    }
  });

  const api = defineApi({ posts: postsResource });
  const app = new Hono();
  app.route('/api', api);

  const post = async (body: any) => {
    seen = null;
    const res = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    return { status: res.status, body: json };
  };

  console.log('\n🧪 A relation field holding a string is left alone');
  {
    const { status } = await post({ title: 'A', author: 'https://example.com/avatar.png' });
    check('the request succeeds', status === 201, status);
    check(
      'the string reaches the hook unchanged',
      seen?.author === 'https://example.com/avatar.png',
      seen?.author
    );
    check('the string is not spread into characters', typeof seen?.author === 'string', typeof seen?.author);
  }

  console.log('\n🧪 A relation field holding a number is left alone');
  {
    await post({ title: 'B', author: 42 });
    check('the number reaches the hook unchanged', seen?.author === 42, seen?.author);
    check('the number is not turned into an object', typeof seen?.author === 'number', typeof seen?.author);
  }

  console.log('\n🧪 A relation field holding a boolean is left alone');
  {
    await post({ title: 'C', author: false });
    check('the boolean reaches the hook unchanged', seen?.author === false, seen?.author);
    check('the boolean is not turned into an object', typeof seen?.author === 'boolean', typeof seen?.author);
  }

  console.log('\n🧪 A relation field holding null is left alone');
  {
    await post({ title: 'D', author: null });
    check('null reaches the hook unchanged', seen?.author === null, seen?.author);
  }

  console.log('\n🧪 A relation field holding an object is still processed');
  {
    await post({ title: 'E', author: { id: 1, name: 'Ada' } });
    check('the object reaches the hook as an object', typeof seen?.author === 'object', typeof seen?.author);
    check('the object keeps its fields', seen?.author?.id === 1 && seen?.author?.name === 'Ada', seen?.author);
  }

  console.log('\n🧪 An array of relations holding a plain string is left alone');
  {
    await post({ title: 'F', comments: ['just a string'] });
    check('the array reaches the hook unchanged', Array.isArray(seen?.comments), seen?.comments);
    check('the string inside the array is unchanged', seen?.comments?.[0] === 'just a string', seen?.comments);
  }

  if (failures > 0) {
    console.error(`\n❌ ${failures} processUploads check(s) failed.`);
    process.exit(1);
  }

  console.log('\n🎉 ALL PROCESS UPLOADS TESTS PASSED SUCCESSFULLY!');
}

main().catch((error) => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
