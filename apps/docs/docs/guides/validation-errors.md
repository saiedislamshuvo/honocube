# Validation & Error Handling

Honocube prioritizes type safety and consistent error reporting to ensure a smooth development experience and predictable API behavior.

## Data Validation

All incoming data for `create`, `update`, and `custom actions` is validated with a
[Standard Schema](https://standardschema.dev) validator. Zod 3.25+, Zod 4, Valibot and ArkType all
implement that protocol, and so can a schema of your own — Honocube asks a validator what it can do,
not which library it comes from.

### Resource Validators

You can provide a single schema or separate ones for create and update:

```typescript
import { z } from "zod";

validator: {
  create: z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }),
  update: z.object({
    name: z.string().optional(),
    avatar: z.string().url().optional(),
  }),
}
```

A single schema is used for the create *and* the update. The update of a Zod schema is a partial of
it, so a field that is not part of the update may be left out; a schema of another library cannot
produce a partial of itself, so declare a separate `update` schema for those.

If a validation fails, Honocube returns a `400 Bad Request` with the issues of the schema:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "code": "invalid_string",
        "path": ["email"],
        "message": "Invalid email"
      }
    ]
  }
}
```

## Error Handling

Honocube uses a centralized `ApiError` class to handle both expected and unexpected errors.

### ApiError Codes

| Code | Status | Description |
| :--- | :--- | :--- |
| `NOT_FOUND` | 404 | The requested record or resource does not exist. |
| `FORBIDDEN` | 403 | The user does not have permission to perform this action. |
| `UNAUTHORIZED` | 401 | The user is not authenticated. |
| `VALIDATION_ERROR` | 400 | The request payload failed validation. |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded. |
| `INTERNAL_ERROR` | 500 | An unexpected server-side error occurred. |

### Not Found

A resource answers every request it cannot route with the same error envelope.

That covers a record that does not exist:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Not Found"
  }
}
```

And a path under the resource that no route handles — `/posts/1/2`, or a collection
whose `list` method is switched off:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Not Found",
    "details": {
      "path": "/api/posts/1/2",
      "method": "GET"
    }
  }
}
```

A route your application registers under the resource's path still answers as usual,
and a `notFound` handler you install on your app is left alone.

### Manual Error Throwing

You can throw `ApiError` within your hooks or custom actions:

```typescript
import { ApiError } from "@honocube/api";

handler: async (c, context, data) => {
  if (someCondition) {
    throw ApiError.badRequest("Invalid state for this action");
  }
}
```

## Global Error Handler

Honocube registers a global error handler in `defineResource` that:
1.  Logs the error using your configured logger (if it's an internal error).
2.  Formats the error response to match the Honocube standard.
3.  Ensures that sensitive error details (like stack traces) are not leaked in production.
