# Custom Actions

While Honocube provides standard CRUD endpoints, most applications require custom business logic that doesn't fit into a standard `POST` or `PATCH`. Custom Actions allow you to add arbitrary Hono routes to a resource while still benefiting from Honocube's context and rate limiting.

## Defining an Action

Actions are defined within the `actions` array of a resource config.

```typescript
export const usersResource = defineResource({
  name: "users",
  // ...
  actions: [
    {
      path: "/:id/reset-password",
      method: "post",
      validator: z.object({
        newPassword: z.string().min(8),
      }),
      handler: async (c, context, data) => {
        const id = c.req.param("id");
        // Logic to reset password
        await resetUserPassword(id, data.newPassword);
        
        return { message: "Password reset successful" };
      },
    },
  ],
});
```

## Action Properties

| Property | Type | Description |
| :--- | :--- | :--- |
| `path` | `string` | The sub-path for the action (relative to the resource root). |
| `method` | `"get" \| "post" \| "patch" \| "delete" \| "put"` | The HTTP method. |
| `validator` | `ZodType` | (Optional) Zod schema to validate the request body. |
| `handler` | `(c, context, data) => Promise<any>` | The function that implements the action logic. |

## Handler Parameters

1.  **`c` (Context):** The standard Hono `Context` object. Use this to access params, headers, and the request object.
2.  **`context` (AppContext):** The application context returned by your `getContext` provider (contains user, db, etc.).
3.  **`data`:** The validated request body (if a `validator` was provided).

## Benefits of Custom Actions

- **Consistency:** Use the same `AppContext` and error handling patterns as your CRUD routes.
- **Rate Limiting:** Actions are automatically covered by the resource's rate limit configuration.
- **Route Namespace:** Actions are logically grouped under the resource path (e.g., `/users/123/reset-password`).

## Response Format

The return value of the `handler` is automatically wrapped in a standard Honocube response:

```json
{
  "success": true,
  "data": { "message": "Password reset successful" }
}
```

If the handler throws an error, it will be caught by the Honocube error handler and returned in the standard error format.
