import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts, users } from "../fixtures/db.js";

describe("Document Workflow and State Machine Engine", () => {
  it("enforces initial state on creation and overrides client-supplied state", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string(),
        status: z.string().optional(),
      }),
      workflow: {
        field: "status",
        initial: "draft",
        transitions: [
          { from: "draft", to: "confirmed" },
        ],
      },
    });

    // 1. Client omits status -> defaults to "draft"
    const res1 = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Order 1" }),
    });
    expect(res1.status).toBe(201);
    const data1 = await res1.json();
    expect(data1.data.status).toBe("draft");

    // 2. Client attempts to forge status on create -> forced to "draft"
    const res2 = await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Order 2", status: "confirmed" }),
    });
    expect(res2.status).toBe(201);
    const data2 = await res2.json();
    expect(data2.data.status).toBe("draft");
  });

  it("handles multi-tier sequential state transitions via standard PATCH /:id", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string().optional(),
        status: z.string().optional(),
      }),
      workflow: {
        field: "status",
        initial: "draft",
        states: {
          draft: { editable: true },
          submit_qa: { editable: true },
          approved_by_manager: { editable: true },
          approved_by_hq: { editable: false },
        },
        transitions: [
          { from: "draft", to: "submit_qa" },
          { from: "submit_qa", to: "approved_by_manager" },
          { from: "approved_by_manager", to: "approved_by_hq" },
        ],
      },
    });

    const seed: any = await adapter.insert(posts, { title: "PO-100", status: "draft" });

    // Step 1: draft -> submit_qa
    const res1 = await postsResource.request(`/${seed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "submit_qa" }),
    });
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.data.status).toBe("submit_qa");

    // Step 2: submit_qa -> approved_by_manager
    const res2 = await postsResource.request(`/${seed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved_by_manager" }),
    });
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.data.status).toBe("approved_by_manager");

    // Step 3: approved_by_manager -> approved_by_hq
    const res3 = await postsResource.request(`/${seed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved_by_hq" }),
    });
    expect(res3.status).toBe(200);
    const data3 = await res3.json();
    expect(data3.data.status).toBe("approved_by_hq");
  });

  it("rejects illegal transitions with 400 INVALID_TRANSITION", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string().optional(),
        status: z.string().optional(),
      }),
      workflow: {
        field: "status",
        initial: "draft",
        transitions: [
          { from: "draft", to: "submitted" },
          { from: "submitted", to: "approved" },
        ],
      },
    });

    const seed: any = await adapter.insert(posts, { title: "Doc", status: "draft" });

    // Attempting illegal jump: draft -> approved
    const res = await postsResource.request(`/${seed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });

    expect(res.status).toBe(400);
    const err = await res.json();
    expect(err.error.code).toBe("INVALID_TRANSITION");
    expect(err.error.message).toContain("Cannot transition document from 'draft' to 'approved'");
  });

  it("enforces role-based guards on transitions", async () => {
    const { adapter } = await createTestDb();

    let currentRole = "employee";
    const app = createApp<{ Bindings: Record<string, unknown> }, { role: string }>({
      adapter,
      getContext: () => ({ role: currentRole }),
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string().optional(),
        status: z.string().optional(),
      }),
      workflow: {
        field: "status",
        initial: "draft",
        states: {
          submitted: { editable: true },
        },
        transitions: [
          { from: "draft", to: "submitted", roles: ["employee", "manager"] },
          { from: "submitted", to: "approved_by_manager", roles: ["manager"] },
        ],
      },
    });

    const seed: any = await adapter.insert(posts, { title: "Order", status: "submitted" });

    // 1. Employee cannot execute manager approval
    currentRole = "employee";
    const res1 = await postsResource.request(`/${seed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved_by_manager" }),
    });
    expect(res1.status).toBe(403);
    const err1 = await res1.json();
    expect(err1.error.code).toBe("FORBIDDEN");

    // 2. Manager executes approval successfully
    currentRole = "manager";
    const res2 = await postsResource.request(`/${seed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved_by_manager" }),
    });
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.data.status).toBe("approved_by_manager");
  });

  it("evaluates dynamic business guards (preventing self-approval)", async () => {
    const { adapter } = await createTestDb();

    const author: any = await adapter.insert(users, { name: "Author User", email: "author@example.com" });
    const manager: any = await adapter.insert(users, { name: "Manager User", email: "mgr@example.com" });

    let currentUserId = author.id;
    const app = createApp<{ Bindings: Record<string, unknown> }, { userId: number }>({
      adapter,
      getContext: () => ({ userId: currentUserId }),
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string().optional(),
        status: z.string().optional(),
      }),
      workflow: {
        field: "status",
        initial: "draft",
        states: {
          submitted: { editable: true },
        },
        transitions: [
          {
            from: "submitted",
            to: "approved",
            // Guard: author cannot approve their own document!
            guard: (ctx, record) => ctx.userId !== record.authorId,
          },
        ],
      },
    });

    const seed: any = await adapter.insert(posts, {
      title: "Self Order",
      status: "submitted",
      authorId: author.id,
    });

    // 1. Author attempts to approve their own order -> rejected
    currentUserId = author.id;
    const res1 = await postsResource.request(`/${seed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    expect(res1.status).toBe(403);
    const err1 = await res1.json();
    expect(err1.error.code).toBe("TRANSITION_GUARD_FAILED");

    // 2. Manager approves order -> succeeds
    currentUserId = manager.id;
    const res2 = await postsResource.request(`/${seed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.data.status).toBe("approved");
  });

  it("enforces fine-grained per-state field permissions (allowFields)", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      fieldViolationStrategy: "reject",
      validator: z.object({
        title: z.string().optional(),
        content: z.string().optional(),
        price: z.number().optional(),
        status: z.string().optional(),
      }),
      workflow: {
        field: "status",
        initial: "draft",
        states: {
          draft: { editable: true },
          submit_qa: {
            // In submit_qa, only content (qaNotes) can be updated; price is locked!
            allowFields: ["content"],
          },
          approved_by_hq: {
            editable: false,
          },
        },
        transitions: [
          { from: "draft", to: "submit_qa" },
          { from: "submit_qa", to: "approved_by_hq" },
        ],
      },
    });

    const seed: any = await adapter.insert(posts, {
      title: "Equipment Purchase",
      content: "Initial Specs",
      price: 5000,
      status: "submit_qa",
    });

    // 1. Client attempts to modify forbidden field (price) while in submit_qa -> rejected
    const res1 = await postsResource.request(`/${seed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: 9000 }),
    });
    expect(res1.status).toBe(403);
    const err1 = await res1.json();
    expect(err1.error.code).toBe("FIELD_FORBIDDEN");
    expect(err1.error.message).toContain("Field 'price' cannot be modified while document is in state 'submit_qa'");

    // 2. Client modifies permitted field (content) -> succeeds
    const res2 = await postsResource.request(`/${seed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "QA Inspection Passed with A+ grade" }),
    });
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.data.content).toBe("QA Inspection Passed with A+ grade");
  });

  it("locks document against regular field updates and deletion when in non-editable states", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string().optional(),
        status: z.string().optional(),
      }),
      workflow: {
        field: "status",
        initial: "draft",
        states: {
          draft: { editable: true },
          approved_by_hq: { editable: false },
        },
        transitions: [
          { from: "draft", to: "approved_by_hq" },
          { from: "approved_by_hq", to: "cancelled" },
        ],
      },
    });

    const seed: any = await adapter.insert(posts, { title: "Frozen PO", status: "approved_by_hq" });

    // 1. Update attempt on locked document -> 403 WORKFLOW_LOCKED
    const updateRes = await postsResource.request(`/${seed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Tampered PO" }),
    });
    expect(updateRes.status).toBe(403);
    const updateErr = await updateRes.json();
    expect(updateErr.error.code).toBe("WORKFLOW_LOCKED");
    expect(updateErr.error.message).toContain("Document in state 'approved_by_hq' is locked and cannot be modified");

    // 2. Delete attempt on locked document -> 403 WORKFLOW_LOCKED
    const deleteRes = await postsResource.request(`/${seed.id}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(403);
    const deleteErr = await deleteRes.json();
    expect(deleteErr.error.code).toBe("WORKFLOW_LOCKED");
    expect(deleteErr.error.message).toContain("Document in state 'approved_by_hq' is locked and cannot be deleted");

    // 3. State transition to cancelled is still permitted
    const cancelRes = await postsResource.request(`/${seed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    expect(cancelRes.status).toBe(200);
    const cancelData = await cancelRes.json();
    expect(cancelData.data.status).toBe("cancelled");
  });

  it("automatically stamps transition fields and executes lifecycle hooks", async () => {
    const { adapter } = await createTestDb();

    let beforeHookCalled = false;
    let afterHookCalled = false;

    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string().optional(),
        slug: z.string().optional(),
        status: z.string().optional(),
      }),
      workflow: {
        field: "status",
        initial: "draft",
        transitions: [
          {
            from: "draft",
            to: "approved",
            action: "approve",
            // Automatically assign transition audit fields
            fields: () => ({
              slug: "APPROVED-STAMPED-CODE",
            }),
          },
        ],
        hooks: {
          beforeTransition: async ({ from, to }) => {
            if (from === "draft" && to === "approved") {
              beforeHookCalled = true;
            }
          },
          afterTransition: async ({ from, to }) => {
            if (from === "draft" && to === "approved") {
              afterHookCalled = true;
            }
          },
        },
      },
    });

    const seed: any = await adapter.insert(posts, { title: "Approval Hook Test", status: "draft" });

    const res = await postsResource.request(`/${seed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.status).toBe("approved");
    expect(data.data.slug).toBe("APPROVED-STAMPED-CODE");
    expect(beforeHookCalled).toBe(true);
    expect(afterHookCalled).toBe(true);

    // Verify in database
    const inDb: any = await adapter.findFirst(posts, {
      where: (cols: any, { eq }: any) => eq(cols.id, seed.id),
    });
    expect(inDb.status).toBe("approved");
    expect(inDb.slug).toBe("APPROVED-STAMPED-CODE");
  });
});
