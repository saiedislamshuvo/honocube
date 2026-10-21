/**
 * Regression test for the Standard Schema adoption.
 *
 * The framework used to recognise a validator with `instanceof z.ZodType`.
 * That check tied it to one library: a schema written with anything else —
 * Valibot, ArkType, or by hand — was not a `ZodType`, and the framework
 * then called `parse` on it and failed with a 500 instead of validating
 * the payload.
 *
 * The framework now speaks the Standard Schema protocol, so a validator is
 * recognised by what it can do and not by where it came from. A Zod schema,
 * a schema from a second copy of Zod, and a hand-written schema are all
 * accepted, and a rejected payload is reported the same way in every case.
 */
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { createRequire } from 'module';
import { cpSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { pathToFileURL } from 'url';
import { DrizzleAdapter, createApp, StandardSchemaV1 } from '@honocube/api';
import { z } from 'zod';

const notes = sqliteTable('notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  body: text('body'),
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
 * A schema written by hand, without a validation library. It follows the
 * Standard Schema protocol, which is all the framework asks of a validator.
 */
function handWrittenSchema(
  required: string[]
): StandardSchemaV1<unknown, Record<string, unknown>> {
  return {
    "~standard": {
      version: 1,
      vendor: "hand-written",
      validate(value) {
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          return { issues: [{ message: "Expected an object" }] };
        }

        const data = value as Record<string, unknown>;
        const issues: StandardSchemaV1.Issue[] = [];

        for (const field of required) {
          if (typeof data[field] !== "string") {
            issues.push({ message: "Expected a string", path: [field] });
          }
        }

        if (issues.length > 0) return { issues };
        return { value: data };
      },
    },
  };
}

/**
 * The same schema, built by a *second copy* of Zod: the package is copied
 * to a temporary directory and loaded from there, while the rest of the
 * script uses the one in `node_modules`.
 *
 * The two copies are two separate modules with their own `ZodType`. Zod
 * recognises a schema of another copy of itself — it implements
 * `Symbol.hasInstance` — but the framework no longer depends on that: it
 * looks at what the schema can do.
 */
async function secondCopySchema() {
  const require = createRequire(import.meta.url);
  const source = dirname(require.resolve("zod/package.json"));
  const target = join(tmpdir(), `honocube-zod-copy-${process.pid}`);

  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });

  const copy = await import(pathToFileURL(join(target, "index.js")).href);
  const schema = copy.z.object({ title: copy.z.string() });

  return {
    schema,
    isSeparateModule: copy.z.ZodType !== z.ZodType,
    cleanup: () => rmSync(target, { recursive: true, force: true }),
  };
}

async function setupDb() {
  const client = createClient({ url: `file:test-standard-schema.db` });
  const db = drizzle(client, { schema: { notes } });

  try { await client.execute(`DROP TABLE IF EXISTS notes`); } catch {}

  await client.execute(`
    CREATE TABLE notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT
    )`);

  return { client, db };
}

async function main() {
  const { client, db } = await setupDb();

  const app = createApp({
    adapter: new DrizzleAdapter(db, { dialect: 'sqlite', schema: { notes } }),
    strategy: 'none',
  });

  const foreign = await secondCopySchema();

  // A schema written by hand, without a validation library.
  const handWritten = app.defineResource({
    name: 'notes',
    table: notes,
    methods: ['list', 'detail', 'create', 'update', 'delete', 'batch-update'],
    validator: handWrittenSchema(['title']),
    actions: [
      {
        path: '/echo',
        method: 'post',
        validator: handWrittenSchema(['title']),
        handler: (c: any, appContext: any, validatedData: any) => validatedData,
      },
    ],
  });

  // The ordinary case: a Zod schema.
  const zodNotes = app.defineResource({
    name: 'zod-notes',
    table: notes,
    validator: z.object({ title: z.string(), body: z.string().optional() }),
  });

  // A schema built by a second instance of Zod.
  const foreignNotes = app.defineResource({
    name: 'copy-notes',
    table: notes,
    validator: foreign.schema as any,
  });

  // The two forms that carry a separate create and update schema.
  const pairNotes = app.defineResource({
    name: 'pair-notes',
    table: notes,
    validator: { create: handWrittenSchema(['title']), update: handWrittenSchema([]) },
  });

  const tupleNotes = app.defineResource({
    name: 'tuple-notes',
    table: notes,
    validator: [handWrittenSchema(['title']), handWrittenSchema([])],
  });

  const server = new Hono();
  server.route('/api/notes', handWritten);
  server.route('/api/zod-notes', zodNotes);
  server.route('/api/copy-notes', foreignNotes);
  server.route('/api/pair-notes', pairNotes);
  server.route('/api/tuple-notes', tupleNotes);

  const send = (path: string, method: string, body?: unknown) =>
    server.request(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  const readRow = async (id: number) => {
    const res = await client.execute({ sql: `SELECT * FROM notes WHERE id = ?`, args: [id] });
    return (res.rows as any[])[0];
  };

  console.log('\n🧪 A schema that is not a Zod schema is accepted');

  const created = await send('/api/notes', 'POST', { title: 'first' });
  check('a valid payload is accepted', created.status === 201, `status ${created.status}`);
  const createdBody = await created.json() as any;
  check('the validated value is written', createdBody?.data?.title === 'first', JSON.stringify(createdBody));

  const rejected = await send('/api/notes', 'POST', { title: 42 });
  const rejectedBody = await rejected.json() as any;
  check('an invalid payload is refused', rejected.status === 400, `status ${rejected.status}`);
  check(
    'the refusal is a validation error',
    rejectedBody?.error?.code === 'VALIDATION_ERROR',
    JSON.stringify(rejectedBody)
  );
  check(
    'the issues of the schema are reported',
    Array.isArray(rejectedBody?.error?.details) && rejectedBody.error.details[0]?.path?.[0] === 'title',
    JSON.stringify(rejectedBody?.error?.details)
  );

  const badUpdate = await send('/api/notes/1', 'PATCH', { title: 42 });
  check('an invalid update is refused', badUpdate.status === 400, `status ${badUpdate.status}`);
  check('the row is unchanged', (await readRow(1))?.title === 'first');

  const goodUpdate = await send('/api/notes/1', 'PATCH', { title: 'updated' });
  check('a valid update is accepted', goodUpdate.status === 200, `status ${goodUpdate.status}`);
  check('the row is updated', (await readRow(1))?.title === 'updated');

  console.log('\n🧪 A Zod schema still works');

  const zodCreated = await send('/api/zod-notes', 'POST', { title: 'zod' });
  check('a valid payload is accepted', zodCreated.status === 201, `status ${zodCreated.status}`);

  const zodRejected = await send('/api/zod-notes', 'POST', { title: 42 });
  const zodRejectedBody = await zodRejected.json() as any;
  check('an invalid payload is refused', zodRejected.status === 400, `status ${zodRejected.status}`);
  check(
    'the refusal is a validation error',
    zodRejectedBody?.error?.code === 'VALIDATION_ERROR',
    JSON.stringify(zodRejectedBody)
  );
  check(
    'the issues of the schema are reported',
    Array.isArray(zodRejectedBody?.error?.details) && zodRejectedBody.error.details.length > 0,
    JSON.stringify(zodRejectedBody?.error?.details)
  );

  // The update of a single Zod schema is a partial of it, so a field that is
  // not part of the update may be left out.
  const zodUpdated = await send('/api/zod-notes/2', 'PATCH', { body: 'only the body' });
  check('a partial update is accepted', zodUpdated.status === 200, `status ${zodUpdated.status}`);

  console.log('\n🧪 A schema from a second copy of Zod is recognised');

  check('the copy is a separate module', foreign.isSeparateModule);

  const foreignCreated = await send('/api/copy-notes', 'POST', { title: 'copy' });
  check(
    'a valid payload is accepted',
    foreignCreated.status === 201,
    `status ${foreignCreated.status}: ${JSON.stringify(await foreignCreated.clone().json())}`
  );

  const foreignRejected = await send('/api/copy-notes', 'POST', { title: 42 });
  const foreignRejectedBody = await foreignRejected.json() as any;
  check(
    'an invalid payload is refused',
    foreignRejected.status === 400,
    `status ${foreignRejected.status}: ${JSON.stringify(foreignRejectedBody)}`
  );
  check(
    'the validation was not skipped',
    foreignRejectedBody?.error?.code === 'VALIDATION_ERROR',
    JSON.stringify(foreignRejectedBody)
  );

  console.log('\n🧪 The create and update schemas can be declared separately');

  const pairCreated = await send('/api/pair-notes', 'POST', { title: 'pair' });
  check('a valid payload is accepted', pairCreated.status === 201, `status ${pairCreated.status}`);

  const pairUpdated = await send('/api/pair-notes/3', 'PATCH', { body: 'no title needed' });
  check('the update schema is used for the update', pairUpdated.status === 200, `status ${pairUpdated.status}`);

  const tupleCreated = await send('/api/tuple-notes', 'POST', { title: 'tuple' });
  check('a valid payload is accepted', tupleCreated.status === 201, `status ${tupleCreated.status}`);

  const tupleUpdated = await send('/api/tuple-notes/4', 'PATCH', { body: 'no title needed' });
  check('the update schema is used for the update', tupleUpdated.status === 200, `status ${tupleUpdated.status}`);

  console.log('\n🧪 A custom action validates its body');

  const actionOk = await send('/api/notes/echo', 'POST', { title: 'echoed' });
  const actionOkBody = await actionOk.json() as any;
  check('a valid payload reaches the handler', actionOk.status === 200 && actionOkBody?.data?.title === 'echoed', JSON.stringify(actionOkBody));

  const actionRejected = await send('/api/notes/echo', 'POST', { title: 42 });
  check('an invalid payload is refused', actionRejected.status === 400, `status ${actionRejected.status}`);

  console.log('\n🧪 The framework validates the body of a batch request itself');

  const batched = await send('/api/notes/batch-update', 'PATCH', { ids: [1], data: { title: 'batched' } });
  check('a valid batch body is accepted', batched.status === 200, `status ${batched.status}`);
  check('the rows are updated', (await readRow(1))?.title === 'batched');

  const emptyBatch = await send('/api/notes/batch-update', 'PATCH', { ids: [], data: { title: 'nope' } });
  const emptyBatchBody = await emptyBatch.json() as any;
  check('an empty list of ids is refused', emptyBatch.status === 400, `status ${emptyBatch.status}`);
  check(
    'the refusal is a validation error',
    emptyBatchBody?.error?.code === 'VALIDATION_ERROR',
    JSON.stringify(emptyBatchBody)
  );

  const malformedBatch = await send('/api/notes/batch-update', 'PATCH', { ids: 'one', data: {} });
  check('a malformed batch body is refused', malformedBatch.status === 400, `status ${malformedBatch.status}`);

  foreign.cleanup();
  await client.close();

  if (failures > 0) {
    console.error(`\n❌ ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\n🎉 ALL STANDARD SCHEMA TESTS PASSED!');
}

main().catch((error) => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
