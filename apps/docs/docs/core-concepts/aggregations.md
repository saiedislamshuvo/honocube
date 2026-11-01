# Analytics & Aggregations

HonoCube allows you to compute analytical metrics, group by dimensions, and generate time-series date histograms directly through the dedicated `GET /aggregate` endpoint.

---

## Configuration

Enable aggregations in your resource definition:

```typescript
export const ordersResource = defineResource({
  name: "orders",
  table: ordersTable,
  aggregate: {
    enabled: true,
    metrics: ["count", "sum", "avg", "min", "max"], // Allowed metric functions
    groupBy: ["status", "category", "country"],     // Allowed dimensions
    dateIntervals: ["day", "week", "month", "year"], // Allowed time buckets
    maxBuckets: 100,                                 // Maximum buckets allowed per query
  },
});
```

### Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enabled` | `boolean` | `false` | Enables the `GET /aggregate` endpoint. |
| `metrics` | `Array<"count" \| "sum" \| "avg" \| "min" \| "max">` | All | Whitelist of aggregation functions clients may compute. |
| `groupBy` | `string[]` | All columns | Whitelist of columns clients may group by. |
| `dateIntervals` | `Array<"day" \| "week" \| "month" \| "year">` | All | Whitelist of date histogram bucketing intervals. |
| `maxBuckets` | `number` | `100` | Safety limit on returned grouped rows. |

---

## Querying Aggregations

### 1. Basic Metrics
Compute the total number of orders and the sum/average of order amounts:

```http
GET /orders/aggregate?metrics=count,sum(total),avg(total)
```

Response:
```json
{
  "success": true,
  "data": {
    "count": 1420,
    "sum_total": 85200.50,
    "avg_total": 60.00
  }
}
```

### 2. Grouping by Dimensions
Break down metrics by status:

```http
GET /orders/aggregate?metrics=count,sum(total)&groupBy=status
```

Response:
```json
{
  "success": true,
  "data": [
    { "status": "completed", "count": 1200, "sum_total": 78000.00 },
    { "status": "pending", "count": 180, "sum_total": 5400.50 },
    { "status": "cancelled", "count": 40, "sum_total": 1800.00 }
  ]
}
```

### 3. Date Histogram Bucketing
Generate time-series buckets for charting and analytics:

```http
GET /orders/aggregate?metrics=count,sum(total)&dateField=createdAt&dateInterval=month
```

Response:
```json
{
  "success": true,
  "data": [
    { "date": "2026-01-01", "count": 420, "sum_total": 24000.00 },
    { "date": "2026-02-01", "count": 510, "sum_total": 31000.00 },
    { "date": "2026-03-01", "count": 490, "sum_total": 30200.50 }
  ]
}
```

### 4. Combining with Filters
Aggregation queries respect the same filter parameters as standard `list` endpoints:

```http
GET /orders/aggregate?metrics=count,sum(total)&groupBy=country&status=completed&createdAt__gte=2026-01-01
```
