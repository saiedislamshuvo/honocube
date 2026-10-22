# Searching & Filtering

Honocube provides a powerful and flexible system for querying your resources through the `list` endpoint.

## Global Search

Enable full-text search by specifying which fields and relations should be searchable.

```typescript
export const productsResource = defineResource({
  name: "products",
  // ...
  search: {
    fields: ["title", "description", "sku"],
    relations: ["category", "tags"],
  },
});
```

### Usage
Send a `q` parameter in the query string:
`GET /products?q=iphone`

Honocube will perform an `OR` search across all specified local fields and related table fields.

## Filtering

You can enable strict filtering on specific fields.

```typescript
export const productsResource = defineResource({
  name: "products",
  // ...
  filter: {
    allow: ["price", "status", "categoryId"],
  },
});
```

### Direct Filters
`GET /products?status=active&categoryId=5`

### Comparison Operators
Honocube supports advanced comparison operators using double-underscores:

- `__gte`: Greater than or equal to
- `__lte`: Less than or equal to
- `__gt`: Greater than
- `__lt`: Less than
- `__like`: SQL LIKE (e.g., `%value%`)

**Example:**
`GET /products?price__gte=100&price__lte=500`

## Sorting

Specify the default sort order for the resource.

```typescript
export const productsResource = defineResource({
  name: "products",
  // ...
  defaultSort: (cols, { desc }) => [desc(cols.createdAt)],
});
```

### Custom Sorting
`GET /products?sort=price&order=desc`

## Pagination

Pagination is enabled by default for all `list` endpoints.

```typescript
export const productsResource = defineResource({
  name: "products",
  // ...
  pagination: {
    defaultLimit: 20,
  },
});
```

### Usage
`GET /products?page=2&limit=50`

The response will include a `meta` object with total counts and page information.

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 150,
    "page": 2,
    "limit": 50,
    "totalPages": 3
  }
}
```

### Validating the Pagination Inputs

`page` and `limit` must be whole numbers. `page` is at least `1`, and `limit` is at least `1`.
A malformed value is refused with a `400` instead of being repaired, because a limit of `0`
makes the number of pages infinite and a negative limit is read by some drivers as "no limit" —
the endpoint would answer with every row.

```json
{
  "success": false,
  "error": {
    "code": "INVALID_PAGINATION",
    "message": "Invalid 'limit': expected an integer between 1 and 100, got -1.",
    "details": { "limit": -1, "maxLimit": 100 }
  }
}
```

A `limit` **above** the maximum is not an error — it is capped at `maxLimit` (100 by default),
which is what protects the database from oversized queries.

Next, learn how to [Assemble your API](./api-gateway.md).
