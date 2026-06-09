# Resources

Resources are the heart of Honocube. A Resource represents a single entity in your system and maps directly to a database table.

## Defining a Resource

Use the `defineResource` function (returned from `createApp`) to create a resource.

```typescript
import { z } from "zod";
import { usersTable } from "../db/schema";
import { defineResource } from "../honocube";

export const usersResource = defineResource({
  name: "users",
  table: usersTable,
  validator: z.object({
    email: z.string().email(),
    name: z.string().min(2),
  }),
  methods: ["list", "detail", "create", "update"], // Optional, defaults to all
});
```

## Configuration Options

| Option | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | The unique name for the resource (used in URLs). |
| `table` | `AnyTable` | The Drizzle table object. |
| `validator` | `ZodType \| { create: ZodType, update: ZodType }` | Zod schema(s) for validating incoming data. |
| `methods` | `Array<"list" \| "detail" \| "create" \| "update" \| "delete">` | Which CRUD endpoints to enable. |
| `middleware` | `MiddlewareHandler[]` | Hono middleware specific to this resource. |
| `permissions` | `Record<string, string>` | Declarative permission strings for each action. |
| `softDelete` | `string` | The column name used for soft deletion. |
| `timestamps` | `boolean \| { createdAt: string, updatedAt: string }` | Enable automatic timestamp management. |

## Automatic CRUD Endpoints

When you define a resource, Honocube automatically generates the following Hono routes:

- `GET /` - List all records (with pagination, search, and filter).
- `GET /:id` - Get a single record.
- `POST /` - Create a new record.
- `PATCH /:id` - Update an existing record.
- `DELETE /:id` - Delete a record (or soft-delete if configured).

## Custom Validators

You can provide different validators for creation and updates:

```typescript
validator: {
  create: z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }),
  update: z.object({
    name: z.string().optional(),
  }),
}
```

## Hooks

Hooks allow you to inject logic at various stages of the request lifecycle:

- `beforeFetch` / `afterFetch`
- `beforeCreate` / `afterCreate`
- `beforeUpdate` / `afterUpdate`
- `beforeDelete` / `afterDelete`

```typescript
hooks: {
  beforeCreate: async (data, c, tx, context) => {
    data.password = await hash(data.password);
    return data;
  },
}
```

Next, learn how to handle [Relationships](./relationships.md).
