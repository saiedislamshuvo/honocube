# Cursor & Keyset Pagination

HonoCube provides first-class support for both traditional **offset-based pagination** and high-performance **cursor / keyset pagination**.

While offset pagination (`?page=200&limit=50`) degrades significantly on large tables due to database `OFFSET` scans and suffers from page-drift (items shifting between pages when rows are inserted or deleted), cursor pagination provides **O(1) seeking performance** with rock-solid consistency.

---

## Configuration

Configure pagination in your resource definition:

```typescript
export const ordersResource = defineResource({
  name: "orders",
  table: ordersTable,
  pagination: {
    type: "both",           // "offset" | "cursor" | "both" (default: "offset")
    defaultLimit: 25,       // Default items per page (default: 20)
    maxLimit: 100,          // Upper ceiling to prevent query abuse
    cursorField: "id",      // Field used for cursor seeking (default: primary key)
  },
});
```

### Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `type` | `"offset" \| "cursor" \| "both"` | `"offset"` | The pagination strategy supported by the list endpoint. |
| `defaultLimit` | `number` | `20` | Default number of records returned per page. |
| `maxLimit` | `number` | `100` | Maximum allowable `limit` parameter. Values above this are capped. |
| `cursorField` | `string` | Primary key | The column used for ordering and cursor navigation. |

---

## Cursor Pagination in Action

When `pagination.type` is set to `"cursor"` or `"both"`, HonoCube handles opaque cursor generation and extraction automatically.

### 1. Fetching the First Page

```http
GET /orders?limit=10
```

Response:

```json
{
  "success": true,
  "data": [
    { "id": 105, "total": 120 },
    { "id": 104, "total": 45 },
    ...
  ],
  "meta": {
    "total": 5420,
    "limit": 10,
    "nextCursor": "ZXlKaE9pSTFNV...",
    "prevCursor": null,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### 2. Seeking Forward

Pass `nextCursor` as `cursor` (or `after`) in the next request:

```http
GET /orders?limit=10&cursor=ZXlKaE9pSTFNV...
```

The database query uses an indexed `WHERE id < :cursor ORDER BY id DESC LIMIT 10` condition—seeking directly to the next page in constant time without scanning earlier rows.

### 3. Seeking Backward

Pass `prevCursor` as `before` to navigate backwards:

```http
GET /orders?limit=10&before=ZXlKaE9pSTFNV...
```

---

## Tie-Breaker Columns & Drift Protection

When sorting by a non-unique column (such as `createdAt` or `price`), duplicate timestamps can cause missing or duplicate records between pages.

HonoCube automatically appends the primary key as a deterministic **tie-breaker**:

```sql
WHERE (created_at, id) < (:cursor_created_at, :cursor_id)
ORDER BY created_at DESC, id DESC
```

This guarantees that cursor pagination remains 100% deterministic, even with identical timestamp values across millions of rows.
