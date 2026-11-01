import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createTestDb, posts, comments, users } from "../fixtures/db.js";

describe("Workflow Relations: Cascades, Preconditions & Lock Propagation", () => {
  it("enforces requireChildren minCount and maxCount preconditions on transitions", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    // Seed author
    const author: any = await adapter.insert(users, {
      name: "Workflow Manager",
      email: "wm@example.com",
    });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string().optional(),
        status: z.string().optional(),
      }),
      relations: {
        many: [
          {
            name: "comments",
            table: comments,
            foreignKey: "postId",
            referenceKey: "id",
            schema: z.object({
              author: z.string(),
              content: z.string(),
            }),
          },
        ],
      },
      workflow: {
        field: "status",
        initial: "draft",
        states: {
          draft: { editable: true },
          submitted: { editable: false },
        },
        transitions: [
          {
            from: "draft",
            to: "submitted",
            requireChildren: [
              {
                relation: "comments",
                minCount: 2,
              },
            ],
          },
        ],
      },
    });

    const post: any = await adapter.insert(posts, {
      title: "Order with Lines",
      status: "draft",
      authorId: author.id,
    });

    // 1. Transition fails when 0 comments exist (requires at least 2)
    const resFail0 = await postsResource.request(`/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "submitted" }),
    });
    expect(resFail0.status).toBe(400);
    const err0 = await resFail0.json();
    expect(err0.error.code).toBe("WORKFLOW_REQUIREMENT_FAILED");
    expect(err0.error.details.requiredMin).toBe(2);
    expect(err0.error.details.actual).toBe(0);

    // 2. Add 1 comment -> still fails (1 < 2)
    await adapter.insert(comments, {
      postId: post.id,
      author: "Inspector 1",
      content: "Item #1 verified",
    });

    const resFail1 = await postsResource.request(`/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "submitted" }),
    });
    expect(resFail1.status).toBe(400);
    const err1 = await resFail1.json();
    expect(err1.error.code).toBe("WORKFLOW_REQUIREMENT_FAILED");
    expect(err1.error.details.actual).toBe(1);

    // 3. Add 2nd comment -> transition succeeds
    await adapter.insert(comments, {
      postId: post.id,
      author: "Inspector 2",
      content: "Item #2 verified",
    });

    const resOk = await postsResource.request(`/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "submitted" }),
    });
    expect(resOk.status).toBe(200);
    const okData = await resOk.json();
    expect(okData.data.status).toBe("submitted");
  });

  it("enforces requireChildren match criteria and custom validate callback", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string().optional(),
        status: z.string().optional(),
      }),
      relations: {
        many: [
          {
            name: "comments",
            table: comments,
            foreignKey: "postId",
            referenceKey: "id",
            schema: z.object({
              author: z.string(),
              content: z.string(),
            }),
          },
        ],
      },
      workflow: {
        field: "status",
        initial: "in_review",
        transitions: [
          {
            from: "in_review",
            to: "approved",
            requireChildren: [
              {
                relation: "comments",
                match: { author: "QA_PASSED" },
                validate: (children) => {
                  const hasSignoff = children.some((c) => c.content.includes("SIGNOFF"));
                  if (!hasSignoff) return "At least one item must include 'SIGNOFF' in notes.";
                  return true;
                },
              },
            ],
          },
        ],
      },
    });

    const post: any = await adapter.insert(posts, {
      title: "QA Order",
      status: "in_review",
    });

    const comment1: any = await adapter.insert(comments, {
      postId: post.id,
      author: "PENDING_QA",
      content: "Pending review",
    });

    // 1. Fails match criteria (author is not QA_PASSED)
    const resFailMatch = await postsResource.request(`/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    expect(resFailMatch.status).toBe(400);
    const errMatch = await resFailMatch.json();
    expect(errMatch.error.code).toBe("WORKFLOW_REQUIREMENT_FAILED");

    // 2. Update author to QA_PASSED, but validate callback fails because no SIGNOFF in content
    await adapter.update(comments, comment1.id, { author: "QA_PASSED" });

    const resFailValidate = await postsResource.request(`/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    expect(resFailValidate.status).toBe(400);
    const errValidate = await resFailValidate.json();
    expect(errValidate.error.message).toBe("At least one item must include 'SIGNOFF' in notes.");

    // 3. Update content to include SIGNOFF -> transition succeeds
    await adapter.update(comments, comment1.id, { content: "PASSED WITH SIGNOFF" });

    const resOk = await postsResource.request(`/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    expect(resOk.status).toBe(200);
    const okData = await resOk.json();
    expect(okData.data.status).toBe("approved");
  });

  it("cascades status updates to child relations atomically on parent transition", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string().optional(),
        status: z.string().optional(),
      }),
      relations: {
        many: [
          {
            name: "items",
            table: comments,
            foreignKey: "postId",
            referenceKey: "id",
            schema: z.object({
              author: z.string(),
              content: z.string(),
            }),
          },
        ],
      },
      workflow: {
        field: "status",
        initial: "draft",
        transitions: [
          {
            from: "draft",
            to: "approved",
            // Declarative cascade: auto-stamp child records
            cascade: [
              {
                relation: "items",
                set: (ctx, parentRecord) => ({
                  author: "APPROVED_SYSTEM",
                  content: `Approved under order: ${parentRecord.title}`,
                }),
              },
            ],
          },
        ],
      },
    });

    const post: any = await adapter.insert(posts, {
      title: "Parent WorkOrder #101",
      status: "draft",
    });

    const item1: any = await adapter.insert(comments, {
      postId: post.id,
      author: "Alice",
      content: "Draft line item 1",
    });

    const item2: any = await adapter.insert(comments, {
      postId: post.id,
      author: "Bob",
      content: "Draft line item 2",
    });

    // Execute transition to approved
    const patchRes = await postsResource.request(`/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    expect(patchRes.status).toBe(200);

    // Verify child items were cascaded in the database
    const inDbItem1: any = await adapter.findFirst(comments, {
      where: (cols: any, { eq }: any) => eq(cols.id, item1.id),
    });
    const inDbItem2: any = await adapter.findFirst(comments, {
      where: (cols: any, { eq }: any) => eq(cols.id, item2.id),
    });

    expect(inDbItem1.author).toBe("APPROVED_SYSTEM");
    expect(inDbItem1.content).toBe("Approved under order: Parent WorkOrder #101");
    expect(inDbItem2.author).toBe("APPROVED_SYSTEM");
    expect(inDbItem2.content).toBe("Approved under order: Parent WorkOrder #101");
  });

  it("propagates parent locks to child resources via parent lockRelations", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string().optional(),
        status: z.string().optional(),
      }),
      relations: {
        many: [
          {
            name: "comments",
            table: comments,
            foreignKey: "postId",
            referenceKey: "id",
            schema: z.object({
              author: z.string(),
              content: z.string(),
            }),
          },
        ],
      },
      workflow: {
        field: "status",
        initial: "draft",
        states: {
          draft: { editable: true },
          submitted: { editable: false },
        },
        transitions: [
          { from: "draft", to: "submitted" },
        ],
        // Declarative Lock Propagation: child items in comments are locked when post is not in draft
        lockRelations: ["comments"],
      },
    });

    const commentsResource = app.defineResource({
      name: "comments",
      table: comments,
      validator: z.object({
        author: z.string().optional(),
        content: z.string().optional(),
      }),
    });

    const post: any = await adapter.insert(posts, {
      title: "Parent PO",
      status: "draft",
    });

    const comment: any = await adapter.insert(comments, {
      postId: post.id,
      author: "Worker",
      content: "Line 1 initial",
    });

    // 1. While parent is in draft: child PATCH and DELETE are permitted
    const patchDraftRes = await commentsResource.request(`/${comment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Line 1 updated while draft" }),
    });
    expect(patchDraftRes.status).toBe(200);

    // 2. Transition parent to submitted (non-editable state)
    const patchParentRes = await postsResource.request(`/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "submitted" }),
    });
    expect(patchParentRes.status).toBe(200);

    // 3. Child PATCH is now rejected with 403 WORKFLOW_LOCKED
    const patchLockedRes = await commentsResource.request(`/${comment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Tampered after submit" }),
    });
    expect(patchLockedRes.status).toBe(403);
    const patchLockedErr = await patchLockedRes.json();
    expect(patchLockedErr.error.code).toBe("WORKFLOW_LOCKED");

    // 4. Child DELETE is now rejected with 403 WORKFLOW_LOCKED
    const deleteLockedRes = await commentsResource.request(`/${comment.id}`, {
      method: "DELETE",
    });
    expect(deleteLockedRes.status).toBe(403);
    const deleteLockedErr = await deleteLockedRes.json();
    expect(deleteLockedErr.error.code).toBe("WORKFLOW_LOCKED");
  });

  it("enforces direct parentLock on child resources and protects batch operations", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    app.defineResource({
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
          locked: { editable: false },
        },
        transitions: [{ from: "draft", to: "locked" }],
      },
    });

    const commentsResource = app.defineResource({
      name: "comments",
      table: comments,
      methods: ["list", "detail", "create", "update", "delete", "batch-update", "batch-delete"],
      validator: z.object({
        author: z.string().optional(),
        content: z.string().optional(),
      }),
      // Child explicitly defines parentLock
      workflow: {
        parentLock: {
          table: posts,
          foreignKey: "postId",
          editableStates: ["draft"],
        },
      },
    });

    const parent: any = await adapter.insert(posts, {
      title: "Invoice 500",
      status: "locked",
    });

    const comment1: any = await adapter.insert(comments, {
      postId: parent.id,
      author: "Accounting",
      content: "Line 1",
    });

    const comment2: any = await adapter.insert(comments, {
      postId: parent.id,
      author: "Accounting",
      content: "Line 2",
    });

    // 1. Direct PATCH /:id blocked
    const directPatch = await commentsResource.request(`/${comment1.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Direct edit blocked" }),
    });
    expect(directPatch.status).toBe(403);
    expect((await directPatch.json()).error.code).toBe("WORKFLOW_LOCKED");

    // 2. Direct DELETE /:id blocked
    const directDelete = await commentsResource.request(`/${comment1.id}`, {
      method: "DELETE",
    });
    expect(directDelete.status).toBe(403);
    expect((await directDelete.json()).error.code).toBe("WORKFLOW_LOCKED");

    // 3. Batch UPDATE blocked
    const batchUpdateRes = await commentsResource.request("/batch-update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [comment1.id, comment2.id],
        data: { content: "Batch edit attempted" },
      }),
    });
    expect(batchUpdateRes.status).toBe(403);
    expect((await batchUpdateRes.json()).error.code).toBe("WORKFLOW_LOCKED");

    // 4. Batch DELETE blocked
    const batchDeleteRes = await commentsResource.request("/batch-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [comment1.id, comment2.id],
      }),
    });
    expect(batchDeleteRes.status).toBe(403);
    expect((await batchDeleteRes.json()).error.code).toBe("WORKFLOW_LOCKED");
  });
  it("enforces requireChildren maxCount and rejects invalid relation configurations with 500 CONFIG_ERROR", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string().optional(),
        status: z.string().optional(),
      }),
      relations: {
        many: [
          {
            name: "comments",
            table: comments,
            foreignKey: "postId",
            referenceKey: "id",
            schema: z.object({ author: z.string(), content: z.string() }),
          },
        ],
      },
      workflow: {
        field: "status",
        initial: "draft",
        transitions: [
          {
            from: "draft",
            to: "capped",
            requireChildren: [
              {
                relation: "comments",
                maxCount: 2, // Allows at most 2 items
              },
            ],
          },
          {
            from: "draft",
            to: "broken",
            requireChildren: [
              {
                relation: "non_existent_relation",
              },
            ],
          },
        ],
      },
    });

    const post: any = await adapter.insert(posts, { title: "Capped Post", status: "draft" });

    // Seed 3 comments (exceeds maxCount 2)
    await adapter.insert(comments, { postId: post.id, author: "A", content: "1" });
    await adapter.insert(comments, { postId: post.id, author: "B", content: "2" });
    await adapter.insert(comments, { postId: post.id, author: "C", content: "3" });

    // 1. Fails maxCount
    const maxFail = await postsResource.request(`/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "capped" }),
    });
    expect(maxFail.status).toBe(400);
    const maxErr = await maxFail.json();
    expect(maxErr.error.code).toBe("WORKFLOW_REQUIREMENT_FAILED");
    expect(maxErr.error.details.requiredMax).toBe(2);
    expect(maxErr.error.details.actual).toBe(3);

    // 2. Misconfigured relation name throws 500 CONFIG_ERROR
    const brokenFail = await postsResource.request(`/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "broken" }),
    });
    expect(brokenFail.status).toBe(500);
    const brokenErr = await brokenFail.json();
    expect(brokenErr.error.code).toBe("CONFIG_ERROR");
  });

  it("supports custom editableStates in lockRelations object syntax", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({
        title: z.string().optional(),
        status: z.string().optional(),
      }),
      relations: {
        many: [
          {
            name: "items",
            table: comments,
            foreignKey: "postId",
            referenceKey: "id",
            schema: z.object({ author: z.string(), content: z.string() }),
          },
        ],
      },
      workflow: {
        field: "status",
        initial: "draft",
        states: {
          draft: { editable: true },
          qa_review: { editable: false }, // Parent post itself is locked
          approved: { editable: false },
        },
        transitions: [
          { from: "draft", to: "qa_review" },
          { from: "qa_review", to: "approved" },
        ],
        // Allow child items to be modified in BOTH draft and qa_review!
        lockRelations: [
          { relation: "items", editableStates: ["draft", "qa_review"] },
        ],
      },
    });

    const commentsResource = app.defineResource({
      name: "comments",
      table: comments,
      validator: z.object({
        content: z.string().optional(),
      }),
    });

    const post: any = await adapter.insert(posts, { title: "Custom Lock PO", status: "draft" });
    const item: any = await adapter.insert(comments, { postId: post.id, author: "QA", content: "Original" });

    // Transition post to qa_review (parent post fields are locked)
    await postsResource.request(`/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "qa_review" }),
    });

    // 1. Child item CAN still be updated during qa_review (custom editableStates)
    const qaItemUpdate = await commentsResource.request(`/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "QA Inspection Completed" }),
    });
    expect(qaItemUpdate.status).toBe(200);

    // Transition post to approved
    await postsResource.request(`/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });

    // 2. Now in approved state, child item is completely locked
    const approvedItemUpdate = await commentsResource.request(`/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Post-approval tamper" }),
    });
    expect(approvedItemUpdate.status).toBe(403);
    expect((await approvedItemUpdate.json()).error.code).toBe("WORKFLOW_LOCKED");
  });

  it("permits batch updates when parent is in editable state and handles null parentId gracefully", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    app.defineResource({
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
          locked: { editable: false },
        },
        transitions: [{ from: "draft", to: "locked" }],
      },
    });

    const commentsResource = app.defineResource({
      name: "comments",
      table: comments,
      methods: ["list", "detail", "create", "update", "delete", "batch-update", "batch-delete"],
      validator: z.object({
        author: z.string().optional(),
        content: z.string().optional(),
      }),
      workflow: {
        parentLock: {
          table: posts,
          foreignKey: "postId",
          editableStates: ["draft"],
        },
      },
    });

    const draftParent: any = await adapter.insert(posts, { title: "Draft PO", status: "draft" });
    const item1: any = await adapter.insert(comments, { postId: draftParent.id, author: "U1", content: "C1" });
    const item2: any = await adapter.insert(comments, { postId: draftParent.id, author: "U2", content: "C2" });

    // Standalone item with no parent (postId is null)
    const unparentedItem: any = await adapter.insert(comments, { postId: null, author: "U3", content: "Independent" });

    // 1. Batch update succeeds when parent is in draft
    const batchOk = await commentsResource.request("/batch-update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [item1.id, item2.id],
        data: { content: "Updated in draft" },
      }),
    });
    expect(batchOk.status).toBe(200);

    // 2. Standalone item with null postId can be updated and deleted without error
    const unparentedPatch = await commentsResource.request(`/${unparentedItem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Updated standalone" }),
    });
    expect(unparentedPatch.status).toBe(200);

    const unparentedDelete = await commentsResource.request(`/${unparentedItem.id}`, {
      method: "DELETE",
    });
    expect(unparentedDelete.status).toBe(200);
  });

});
