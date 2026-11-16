import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { defineApi, defineResource } from "../../src/core/factory.js";
import { createEventBus } from "../../src/realtime/event-bus.js";
import { createNotificationEngine } from "../../src/notifications/engine.js";
import {
  createAutomationEngine,
  type AutomationRule,
} from "../../src/automation/engine.js";
import { createTestDb, posts } from "../fixtures/db.js";

describe("Low-Code Workflow Automation Engine (Issue #142)", () => {
  it("evaluates trigger-condition-action workflow rules on entity mutations", async () => {
    const eventBus = createEventBus();
    const notificationEngine = createNotificationEngine({ eventBus });
    const customWebhookHandler = vi.fn();

    const rule: AutomationRule = {
      id: "auto-urgent-ticket",
      name: "Escalate Urgent Support Tickets",
      enabled: true,
      resource: "tickets",
      event: "create",
      conditions: [
        { field: "priority", operator: "equals", value: "urgent" },
        { field: "slaHours", operator: "less_than", value: 4 },
      ],
      actions: [
        {
          type: "update_field",
          target: "assignedTier",
          value: "Tier-3-Specialist",
        },
        {
          type: "send_notification",
          target: "admin",
          value: "Ticket #{{id}} marked as urgent SLA for customer {{customer}}.",
          options: { title: "Urgent Ticket Escalation", severity: "error" },
        },
        {
          type: "log_activity",
          value: "Auto-escalated ticket #{{id}} to Tier-3.",
        },
        {
          type: "webhook_post",
          target: "https://hooks.slack.com/services/T00/B00/X00",
        },
      ],
    };

    const engine = createAutomationEngine({
      eventBus,
      notificationEngine,
      initialRules: [rule],
      actionHandlers: {
        webhook_post: customWebhookHandler,
      },
    });

    // 1. Non-matching event: priority normal
    const nonMatchingEvent = {
      id: "evt-1",
      timestamp: Date.now(),
      type: "create",
      resource: "tickets",
      data: { id: "TCK-101", priority: "normal", slaHours: 2, customer: "Acme" },
    };
    const r1 = await engine.processEvent(nonMatchingEvent);
    expect(r1).toHaveLength(0);
    expect(customWebhookHandler).not.toHaveBeenCalled();

    // 2. Matching event: priority urgent and slaHours < 4
    const ticketRecord = {
      id: "TCK-999",
      priority: "urgent",
      slaHours: 2,
      customer: "Global MegaCorp",
    };
    const matchingEvent = {
      id: "evt-2",
      timestamp: Date.now(),
      type: "create",
      resource: "tickets",
      data: ticketRecord,
    };
    const r2 = await engine.processEvent(matchingEvent);
    expect(r2).toHaveLength(1);
    expect(r2[0]?.status).toBe("success");
    expect(r2[0]?.actionsExecuted).toBe(4);

    // Verify update_field mutation on record
    expect((ticketRecord as any).assignedTier).toBe("Tier-3-Specialist");

    // Verify webhook handler was called
    expect(customWebhookHandler).toHaveBeenCalledTimes(1);

    // Verify notification was stored in notificationEngine
    const notifs = notificationEngine.store.list();
    expect(notifs.some((n) => n.title === "Urgent Ticket Escalation")).toBe(true);
    expect(notifs[0]?.body).toContain("Global MegaCorp");

    // Verify execution log
    const logs = engine.getExecutionLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.ruleName).toBe("Escalate Urgent Support Tickets");
    expect(logs[0]?.actionsExecuted).toBe(4);
  });

  it("exposes REST endpoints for managing automation rules and execution logs", async () => {
    const { adapter } = await createTestDb();
    const eventBus = createEventBus();

    const postsResource = defineResource({
      name: "posts",
      table: posts,
      adapter,
      validator: z.object({
        title: z.string(),
      }),
    });

    const initialRule: AutomationRule = {
      id: "auto-post-publish",
      name: "Auto Tag Published Posts",
      enabled: true,
      resource: "posts",
      event: "create",
      actions: [
        {
          type: "log_activity",
          value: "Post {{title}} was created.",
        },
      ],
    };

    const app = defineApi(
      { posts: postsResource },
      {
        eventBus,
        automation: {
          enabled: true,
          rules: [initialRule],
        },
      }
    );

    // 1. GET /automations
    const getRes = await app.request("/automations?resource=posts");
    expect(getRes.status).toBe(200);
    const getJson: any = await getRes.json();
    expect(getJson.data).toHaveLength(1);
    expect(getJson.data[0].name).toBe("Auto Tag Published Posts");

    // 2. POST /automations/test (dry run testing)
    const testRes = await app.request("/automations/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rule: initialRule,
        mockPayload: { title: "Special Article" },
      }),
    });
    expect(testRes.status).toBe(200);
    const testJson: any = await testRes.json();
    expect(testJson.matched).toBe(true);
    expect(testJson.actionsToRun[0]?.preview).toBe("Post Special Article was created.");

    // 3. Trigger event on EventBus to execute rule
    eventBus.publish({
      type: "create",
      resource: "posts",
      data: { id: 55, title: "Automated Blog Entry" },
    });

    // Wait for async automation action execution
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 4. GET /automations/logs
    const logsRes = await app.request("/automations/logs");
    expect(logsRes.status).toBe(200);
    const logsJson: any = await logsRes.json();
    expect(logsJson.data.length).toBeGreaterThan(0);
    expect(logsJson.data[0].ruleName).toBe("Auto Tag Published Posts");

    // 5. POST /automations (Add new rule)
    const addRuleRes = await app.request("/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "auto-order-fulfill",
        name: "Fulfill Order Automation",
        enabled: true,
        resource: "orders",
        event: "update",
        actions: [
          { type: "update_field", target: "fulfilled", value: true },
        ],
      }),
    });
    expect(addRuleRes.status).toBe(201);

    // 6. PUT /automations/:id
    const putRes = await app.request("/automations/auto-order-fulfill", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Order Fulfillment" }),
    });
    expect(putRes.status).toBe(200);

    // 7. DELETE /automations/:id
    const delRes = await app.request("/automations/auto-order-fulfill", {
      method: "DELETE",
    });
    expect(delRes.status).toBe(200);
  });
});
