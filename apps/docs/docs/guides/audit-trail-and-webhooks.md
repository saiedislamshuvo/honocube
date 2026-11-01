# Audit Trail & Webhook Outbox

HonoCube provides comprehensive enterprise compliance tooling: an automated **Field-Level Audit Trail** that tracks before/after diffs on all mutations, and a reliable **Webhook Outbox** for sending cryptographically signed events to external services.

---

## Field-Level Audit Trail

The audit engine captures actor information, timestamps, IP addresses, and exact diffs whenever records are created, updated, or deleted.

### Configuration

```typescript
export const accountsResource = defineResource({
  name: "accounts",
  table: accountsTable,
  audit: {
    enabled: true,
    excludeFields: ["passwordHash", "apiKey"], // Redact sensitive fields
    store: async (entry) => {
      // Persist to audit database or log streaming service (Datadog, ClickHouse, etc.)
      await db.insert(auditLogsTable).values({
        resource: entry.resource,
        action: entry.action,          // "create" | "update" | "delete"
        recordId: String(entry.recordId),
        actorId: entry.actorId,
        ipAddress: entry.ipAddress,
        diff: JSON.stringify(entry.diff), // Before/After delta
        createdAt: new Date(),
      });
    },
  },
});
```

### Audit Diff Structure
When updating an account from `creditLimit: 5000` to `creditLimit: 10000`, the generated diff is:

```json
{
  "creditLimit": {
    "old": 5000,
    "new": 10000
  }
}
```

The audit runner runs safely: if the audit storage sink encounters an error, HonoCube logs the failure without blocking or aborting the primary user request.

---

## Webhook Outbox

Dispatch webhooks upon record lifecycle events with guaranteed delivery, payload signatures, and exponential backoff retry policies.

### Configuration

```typescript
export const ordersResource = defineResource({
  name: "orders",
  table: ordersTable,
  webhooks: {
    enabled: true,
    secret: process.env.WEBHOOK_SECRET, // Used for HMAC-SHA256 signatures
    endpoints: [
      {
        url: "https://billing.example.com/webhooks/orders",
        events: ["orders.created", "orders.updated"],
      },
    ],
    maxRetries: 3,
    backoffMs: 1000,
  },
});
```

### Signature Verification

HonoCube signs every webhook request using an HMAC-SHA256 digest sent in the `X-Signature-SHA256` header:

```typescript
import { verifyWebhookSignature } from "@honocube/api";

// In your receiving service:
const signature = req.headers["x-signature-sha256"];
const isValid = verifyWebhookSignature({
  payload: rawRequestBody,
  secret: process.env.WEBHOOK_SECRET,
  signature,
});

if (!isValid) {
  return res.status(401).send("Invalid webhook signature");
}
```
