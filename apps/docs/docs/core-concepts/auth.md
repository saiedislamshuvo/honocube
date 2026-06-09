# Authentication & Permissions

Honocube provides a two-tiered approach to security: declarative permissions and functional Row-Level Security (RLS).

## Global Configuration

Security logic is primarily configured in `createApp`.

```typescript
export const { defineResource } = createApp({
  // ...
  auth: {
    // 1. Functional permission check
    can: async (context, permission, record) => {
      // Logic to check if user has 'permission'
      // Optionally check against 'record' for specific objects
      return context.user?.permissions.includes(permission);
    },
  },
  // Provide the user context from Hono
  getContext: async (c) => ({
    user: c.get('user'),
  }),
});
```

## Declarative Permissions

You can assign permission strings to each action in a resource.

```typescript
export const postsResource = defineResource({
  name: "posts",
  permissions: {
    list: "posts.view",
    create: "posts.create",
    update: "posts.edit",
    delete: "posts.delete",
  },
});
```

When a request is made, Honocube will call the `auth.can` function provided in `createApp` with the corresponding string.

## Row-Level Security (authorize)

For fine-grained control (e.g., "users can only edit their own posts"), use the `authorize` callback.

```typescript
export const postsResource = defineResource({
  name: "posts",
  // ...
  authorize: async (context, action, record) => {
    if (action === "update" || action === "delete") {
      return record.authorId === context.user.id;
    }
    return true;
  },
});
```

## Mandatory Scoping

While `authorize` checks individual records, `scope` filters the database query itself. This is more efficient for `list` operations as it prevents unauthorized records from even being fetched.

```typescript
export const postsResource = defineResource({
  name: "posts",
  // ...
  scope: (cols, { eq }, context) => {
    // Only return posts belonging to the current user
    return eq(cols.authorId, context.user.id);
  },
});
```

## Middleware

You can also apply standard Hono middleware at the app or resource level.

```typescript
// Resource-level middleware
middleware: [
  jwt({ secret: 'secret' }),
],
```

Next, learn how to handle [File Uploads](./uploads.md).
