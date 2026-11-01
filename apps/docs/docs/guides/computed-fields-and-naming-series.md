# Computed Fields & Naming Series

HonoCube allows you to enrich your API responses with dynamic virtual fields and automatically generate human-readable business identifiers (such as `INV-2026-00042`).

---

## Declarative Computed Fields

Computed fields allow you to inject calculated or transformed properties into JSON responses without altering your database schema:

```typescript
export const usersResource = defineResource({
  name: "users",
  table: usersTable,
  computed: {
    // Virtual field computed from existing record values
    fullName: (record) => {
      return `${record.firstName} ${record.lastName}`.trim();
    },
    // Async computed property
    avatarUrl: async (record) => {
      return `https://cdn.example.com/avatars/${record.id}.webp`;
    },
  },
});
```

Whenever a client requests `GET /users` or `GET /users/1`, HonoCube executes the computed field resolvers and includes `fullName` and `avatarUrl` in the response object.

---

## Naming Series Generator

Enterprise documents require sequential, human-friendly identifiers (e.g., invoices `INV-2026-00001`, purchase orders `PO-2026-00045`).

HonoCube includes a built-in sequential naming series engine that generates collision-free numbers atomically:

```typescript
export const invoicesResource = defineResource({
  name: "invoices",
  table: invoicesTable,
  namingSeries: {
    field: "invoiceNumber",  // Column on invoicesTable
    prefix: "INV-YYYY-",     // Supports year/month interpolation (e.g. INV-2026-)
    digits: 5,               // Zero-padded length (e.g. 00001)
  },
});
```

### Resulting Identifiers
- `INV-2026-00001`
- `INV-2026-00002`
- `INV-2026-00003`

On every `POST /invoices` creation, HonoCube generates the next sequential identifier and assigns it to `invoiceNumber` inside the database transaction.
