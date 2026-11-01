# Workflows & State Machines

Enterprise applications like ERPs, Billing Systems, and Order Fulfillment platforms rely on strict state progressions. For example, an invoice should not jump directly from `draft` to `paid` without passing through `pending_approval` and `approved`.

HonoCube provides a declarative **State Machine & Workflow Engine** that validates transitions, restricts illegal mutations, enforces role permissions, and executes transition side effects.

---

## Defining a Workflow

Add a `workflow` configuration to your resource:

```typescript
export const invoicesResource = defineResource({
  name: "invoices",
  table: invoicesTable,
  workflow: {
    stateField: "status",          // The column storing the document status
    initialState: "draft",         // Status assigned on record creation
    transitions: {
      draft: ["pending_approval", "cancelled"],
      pending_approval: ["approved", "rejected"],
      approved: ["paid", "cancelled"],
      rejected: ["draft"],
      paid: [],                    // Terminal state
      cancelled: [],               // Terminal state
    },
    lockedStates: ["paid", "cancelled"], // Prevents field edits once locked
    roles: {
      // Only managers/finance can approve or cancel invoices
      pending_approval: {
        approved: ["manager", "finance"],
        rejected: ["manager"],
      },
      approved: {
        paid: ["finance"],
      },
    },
    onTransition: async ({ from, to, record, c }) => {
      console.log(`Invoice #${record.id} transitioned from ${from} to ${to}`);
      if (to === "approved") {
        // Send notification or trigger downstream workflow
      }
    },
  },
});
```

---

## Behavior & Enforcement

### 1. Illegal Transitions
Attempting an invalid state transition (such as patching `status` from `draft` to `paid`) returns `400 Bad Request`:

```json
{
  "success": false,
  "error": {
    "code": "WORKFLOW_INVALID_TRANSITION",
    "message": "Cannot transition status from 'draft' to 'paid'. Allowed targets: pending_approval, cancelled"
  }
}
```

### 2. Locked Documents
Once an invoice transitions to a state listed in `lockedStates` (e.g. `paid`), attempting to modify any fields returns `403 Forbidden`:

```json
{
  "success": false,
  "error": {
    "code": "WORKFLOW_LOCKED",
    "message": "Record is in locked state 'paid' and cannot be modified."
  }
}
```

### 3. Role-Gated Transitions
If a user without the required role attempts a restricted transition:

```json
{
  "success": false,
  "error": {
    "code": "WORKFLOW_ROLE_FORBIDDEN",
    "message": "User does not have required role to transition from 'pending_approval' to 'approved'."
  }
}
```
