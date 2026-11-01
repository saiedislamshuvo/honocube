# Multi-Tenancy & Access Control (FLAC / RBAC)

HonoCube provides robust primitives for building secure B2B SaaS and enterprise applications: automatic **Tenant Scoping**, **Field-Level Access Control (FLAC)**, and declarative **Role-Based Access Control (RBAC)**.

---

## Multi-Tenancy

In multi-tenant SaaS, records belonging to Organization A must never be accessible to Organization B. HonoCube enforces tenant isolation at the database query layer.

### Configuration

```typescript
export const projectsResource = defineResource({
  name: "projects",
  table: projectsTable,
  tenant: {
    field: "organizationId", // Column on projectsTable
    resolve: (c) => {
      // Resolve organizationId from JWT, session, or subdomain
      const user = c.get("user");
      return user.organizationId;
    },
  },
});
```

### Automatic Enforcement
- **Reads (`list`, `detail`, `aggregate`)**: Automatically adds `WHERE organization_id = :tenantId` to all SQL queries.
- **Writes (`create`)**: Automatically injects `organizationId` into new records, preventing cross-tenant spoofing.
- **Mutations (`update`, `delete`)**: Ensures updates and deletions only succeed if the record matches the current tenant.

---

## Field-Level Access Control (FLAC)

Restrict visibility or editability of specific columns based on user roles:

```typescript
export const employeesResource = defineResource({
  name: "employees",
  table: employeesTable,
  flac: {
    // Only HR and Admin can read salary and SSN
    hiddenFields: {
      salary: (c) => !["hr", "admin"].includes(c.get("user")?.role),
      ssn: (c) => !["hr", "admin"].includes(c.get("user")?.role),
    },
    // Only Admin can modify role or department
    readOnlyFields: {
      role: (c) => c.get("user")?.role !== "admin",
      department: (c) => c.get("user")?.role !== "admin",
    },
  },
});
```

- When non-HR users query employees, `salary` and `ssn` are automatically omitted from JSON responses.
- If a regular user submits a PATCH payload modifying `role`, HonoCube returns `403 Forbidden` (`FIELD_FORBIDDEN`).

---

## Role-Based Access Control (RBAC)

Map CRUD actions directly to user permissions or roles:

```typescript
export const usersResource = defineResource({
  name: "users",
  table: usersTable,
  permissions: {
    list: "users:read",
    detail: "users:read",
    create: "users:create",
    update: "users:update",
    delete: "users:delete",
  },
});
```

In `createApp`, define how permissions are verified:

```typescript
export const { defineResource, defineApi } = createApp({
  adapter,
  can: async (permission, c) => {
    const user = c.get("user");
    return user?.permissions?.includes(permission) ?? false;
  },
});
```
