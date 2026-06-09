# Validation & Error Handling

Honocube prioritizes type safety and consistent error reporting to ensure a smooth development experience and predictable API behavior.

## Data Validation with Zod

All incoming data for `create`, `update`, and `custom actions` is validated using [Zod](https://zod.dev/).

### Resource Validators

You can provide a single Zod schema or separate ones for create and update:

```typescript
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

If a validation fails, Honocube returns a `400 Bad Request` with the specific Zod issues:

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
