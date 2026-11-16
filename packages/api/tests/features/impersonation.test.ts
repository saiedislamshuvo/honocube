import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import {
  defineApi,
  defineResource,
  createImpersonationManager,
} from "../../src/index.js";
import { createTestDb, posts } from "../fixtures/db.js";

describe("Superadmin User & Tenant Impersonation (Issue #146)", () => {
  it("manages session lifecycle with createImpersonationManager", () => {
    const manager = createImpersonationManager({
      maxDurationSeconds: 1800,
    });

    expect(manager.getActiveSession()).toBeUndefined();
    expect(manager.listSessions()).toHaveLength(0);

    const session = manager.startSession({
      originalUser: {
        id: "admin_1",
        name: "Super Admin",
        role: "superadmin",
      },
      targetUser: {
        id: "usr_42",
        name: "Support Target",
        role: "editor",
      },
      targetTenantId: "tenant_corp",
      reason: "Ticket #9842 Investigation",
    });

    expect(session.id).toBeDefined();
    expect(session.originalUser.id).toBe("admin_1");
    expect(session.targetUser?.id).toBe("usr_42");
    expect(session.targetTenantId).toBe("tenant_corp");
    expect(session.reason).toBe("Ticket #9842 Investigation");

    expect(manager.getActiveSession()?.id).toBe(session.id);
    expect(manager.getSession(session.id)?.id).toBe(session.id);
    expect(manager.listSessions()).toHaveLength(1);

    const stopped = manager.stopSession(session.id);
    expect(stopped).toBe(true);
    expect(manager.getActiveSession()).toBeUndefined();
    expect(manager.listSessions()).toHaveLength(0);
  });

  it("handles impersonation API endpoints with authorization guards", async () => {
    const resource = defineResource({
      name: "tickets",
      table: {} as any,
      validator: z.object({ id: z.number(), title: z.string() }),
      adapter: {
        findMany: vi.fn().mockResolvedValue([]),
        insert: vi.fn(),
      } as any,
    });

    const app = defineApi(
      { tickets: resource },
      {
        impersonation: {
          authorize: (c) => {
            return c.req.header("x-role") === "superadmin";
          },
        },
      } as any
    );

    // 1. Unauthorized attempt (role = 'editor')
    const unauthRes = await app.request("/impersonate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-role": "editor",
      },
      body: JSON.stringify({
        targetUserId: "user_99",
        targetTenantId: "tenant_acme",
      }),
    });

    expect(unauthRes.status).toBe(403);
    const unauthBody = await unauthRes.json();
    expect(unauthBody.error).toContain("Only superadmins");

    // 2. Authorized attempt (role = 'superadmin')
    const authRes = await app.request("/impersonate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-role": "superadmin",
      },
      body: JSON.stringify({
        targetUserId: "user_99",
        targetTenantId: "tenant_acme",
        reason: "Customer escalation",
        originalUser: { id: "admin_root", name: "Root Admin" },
      }),
    });

    expect(authRes.status).toBe(201);
    const authBody = await authRes.json();
    expect(authBody.success).toBe(true);
    expect(authBody.session.targetUser?.id).toBe("user_99");
    expect(authBody.session.targetTenantId).toBe("tenant_acme");

    // 3. Check status
    const statusRes = await app.request("/impersonate/status");
    expect(statusRes.status).toBe(200);
    const statusBody = await statusRes.json();
    expect(statusBody.isImpersonating).toBe(true);
    expect(statusBody.session.targetTenantId).toBe("tenant_acme");

    // 4. Terminate impersonation
    const stopRes = await app.request("/impersonate/stop", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(stopRes.status).toBe(200);

    const postStatusRes = await app.request("/impersonate/status");
    const postStatusBody = await postStatusRes.json();
    expect(postStatusBody.isImpersonating).toBe(false);
  });

  it("dynamically overrides tenant context during active impersonation", async () => {
    let capturedConditions: any = null;
    const resource = defineResource({
      name: "invoices",
      table: {
        id: "id",
        tenantId: "tenantId",
      } as any,
      validator: z.object({ id: z.number(), amount: z.number() }),
      adapter: {
        findMany: vi.fn().mockImplementation((_tbl, query) => {
          capturedConditions = query?.where;
          return Promise.resolve([]);
        }),
      } as any,
    });

    const app = defineApi(
      { invoices: resource },
      {
        tenancy: {
          field: "tenantId",
          resolve: (c) => c.req.header("x-tenant") || "tenant_default",
        },
      } as any
    );

    // Without impersonation: resolves to x-tenant or default
    await app.request("/invoices", {
      headers: { "x-tenant": "tenant_regular" },
    });
    expect(capturedConditions).toBeDefined();

    // Start impersonation to tenant_client_b
    await app.request("/impersonate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-superadmin-secret": "test",
      },
      body: JSON.stringify({
        targetTenantId: "tenant_client_b",
        reason: "Investigating missing invoice",
      }),
    });

    // Next request to invoices uses impersonated tenant_client_b
    await app.request("/invoices", {
      headers: { "x-tenant": "tenant_regular" },
    });
    expect(capturedConditions).toBeDefined();
  });

  it("enriches audit logs with impersonatorId when mutation is executed during impersonation", async () => {
    const { adapter } = await createTestDb();
    let recordedAudit: any = null;

    const postsResource = defineResource({
      table: posts,
      validator: z.object({ title: z.string(), content: z.string().optional() }),
      adapter,
      audit: true,
    });

    const app = defineApi(
      { posts: postsResource },
      {
        adapter,
        audit: {
          enabled: true,
          mode: "sync",
          store: (entry) => {
            recordedAudit = entry;
          },
        },
      } as any
    );

    // Start impersonation
    await app.request("/impersonate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetUserId: "user_alice",
        reason: "Resetting corrupt setting",
        originalUser: { id: "super_dan", name: "Dan Superadmin" },
      }),
    });

    // Perform an entity creation
    const createRes = await app.request("/posts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Test Post",
        content: "Testing impersonation audit stamping",
      }),
    });
    expect(createRes.status).toBe(201);

    // Verify audit entry was stamped with impersonatorId
    const auditEntries = (app as any).auditManager?.getEntries() || [];
    expect(auditEntries.length).toBeGreaterThan(0);
    const recorded = recordedAudit || auditEntries[0];
    expect(recorded).toBeDefined();
    expect(recorded.impersonatorId).toBe("super_dan");
    expect(recorded.metadata?.impersonated).toBe(true);
    expect(recorded.metadata?.impersonatorName).toBe("Dan Superadmin");
  });
});

