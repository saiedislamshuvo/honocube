import { describe, it, expect } from "vitest";
import {
  defineApi,
  defineResource,
  createAuditManager,
} from "../../src/index.js";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

const tasksTable = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  status: text("status").notNull(),
});

describe("Comprehensive Activity Logging & Mutation Audit Trail (Issue #144)", () => {
  it("records and filters audit entries with diffs, metadata, and timestamps", () => {
    const manager = createAuditManager();

    const entry1 = manager.record({
      resource: "orders",
      recordId: "1001",
      action: "create",
      actorId: "usr_alice",
      newData: { id: "1001", amount: 120 },
      ip: "127.0.0.1",
      userAgent: "TestClient/1.0",
    });

    const _entry2 = manager.record({
      resource: "orders",
      recordId: "1001",
      action: "update",
      actorId: "usr_bob",
      diff: [{ field: "amount", from: 120, to: 150 }],
      oldData: { amount: 120 },
      newData: { amount: 150 },
    });

    const _entry3 = manager.record({
      resource: "tickets",
      recordId: "505",
      action: "delete",
      actorId: "usr_charlie",
    });

    expect(manager.getEntries()).toHaveLength(3);

    // Filter by resource
    const orderLogs = manager.getEntries({ resource: "orders" });
    expect(orderLogs).toHaveLength(2);

    // Filter by recordId
    const trail = manager.getRecordTrail("orders", "1001");
    expect(trail).toHaveLength(2);
    expect(trail[0].action).toBe("update"); // Most recent first
    expect(trail[1].action).toBe("create");

    // Filter by action
    const deleteLogs = manager.getEntries({ action: "delete" });
    expect(deleteLogs).toHaveLength(1);
    expect(deleteLogs[0].recordId).toBe("505");

    // Lookup by ID
    const found = manager.getEntry(entry1.id!);
    expect(found?.actorId).toBe("usr_alice");

    // Clear
    manager.clear();
    expect(manager.getEntries()).toHaveLength(0);
  });

  it("mounts REST endpoints for querying activity logs and record trails", async () => {
    const tasksResource = defineResource({
      table: tasksTable,
    });

    const api = defineApi(
      { tasks: tasksResource },
      {
        audit: {
          enabled: true,
        },
      } as any
    );

    // 1. Record custom audit log via POST /audit-logs
    const postRes = await api.request("/audit-logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "198.51.100.42",
        "User-Agent": "ConsoleAdmin/2.0",
      },
      body: JSON.stringify({
        resource: "security",
        action: "login",
        actorId: "usr_admin",
        metadata: { method: "passkey" },
      }),
    });
    expect(postRes.status).toBe(201);
    const postData = (await postRes.json() as any).data;
    expect(postData.id).toBeDefined();
    expect(postData.ip).toBe("198.51.100.42");
    expect(postData.userAgent).toBe("ConsoleAdmin/2.0");

    // 2. Query logs via GET /audit-logs
    const getRes = await api.request("/audit-logs");
    expect(getRes.status).toBe(200);
    const getData = (await getRes.json() as any).data;
    expect(getData.length).toBeGreaterThanOrEqual(1);

    // 3. Query single log via GET /audit-logs/:id
    const singleRes = await api.request(`/audit-logs/${postData.id}`);
    expect(singleRes.status).toBe(200);
    const singleData = (await singleRes.json() as any).data;
    expect(singleData.action).toBe("login");

    // 4. Query record trail via GET /audit-logs/resource/:resource/:recordId
    const trailRes = await api.request(`/audit-logs/resource/security/manual`);
    expect(trailRes.status).toBe(200);
    const trailData = (await trailRes.json() as any).data;
    expect(trailData.length).toBeGreaterThanOrEqual(1);

    // 5. Clear logs via POST /audit-logs/clear
    const clearRes = await api.request("/audit-logs/clear", {
      method: "POST",
    });
    expect(clearRes.status).toBe(200);
    const clearData = await clearRes.json() as any;
    expect(clearData.success).toBe(true);

    const afterClearRes = await api.request("/audit-logs");
    const afterClearData = (await afterClearRes.json() as any).data;
    expect(afterClearData).toHaveLength(0);
  });
});
