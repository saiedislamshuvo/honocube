import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { defineApi, defineResource } from "../../src/core/factory.js";
import { createEventBus } from "../../src/realtime/event-bus.js";
import { createNotificationEngine, createNotificationStore } from "../../src/notifications/engine.js";
import { createTestDb, posts } from "../fixtures/db.js";
import type { NotificationRule } from "@honocube/core";

describe("Event-Driven Notification Rules Engine & Multi-Channel Dispatch (Issue #140)", () => {
  it("evaluates rules on event bus mutations and stores in-app notifications", async () => {
    const eventBus = createEventBus();
    const store = createNotificationStore();
    const slackHandler = vi.fn();

    const rule: NotificationRule = {
      id: "rule-high-value-order",
      name: "High Value Order Alert",
      enabled: true,
      resource: "orders",
      event: "create",
      conditions: [
        { field: "total", operator: "greater_than", value: 1000 },
      ],
      template: {
        title: "High Value Order #{{id}}",
        body: "Received order for ${{total}} from {{customerName}}",
        severity: "warning",
      },
      channels: [
        { type: "in_app" },
        { type: "slack", target: "#alerts" },
      ],
    };

    const engine = createNotificationEngine({
      eventBus,
      store,
      initialRules: [rule],
      channelHandlers: {
        slack: slackHandler,
      },
    });

    // 1. Publish non-matching event (total <= 1000)
    await engine.processEvent({
      id: "evt-1",
      timestamp: Date.now(),
      type: "create",
      resource: "orders",
      data: { id: "ORD-1", total: 500, customerName: "Alice" },
    });

    expect(store.list()).toHaveLength(0);
    expect(slackHandler).not.toHaveBeenCalled();

    // 2. Publish matching event (total > 1000)
    await engine.processEvent({
      id: "evt-2",
      timestamp: Date.now(),
      type: "create",
      resource: "orders",
      data: { id: "ORD-2", total: 2500, customerName: "Bob" },
    });

    const notifications = store.list();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.title).toBe("High Value Order #ORD-2");
    expect(notifications[0]?.body).toBe("Received order for $2500 from Bob");
    expect(notifications[0]?.severity).toBe("warning");
    expect(notifications[0]?.read).toBe(false);

    // Slack channel handler was called
    expect(slackHandler).toHaveBeenCalledTimes(1);
    expect(slackHandler.mock.calls[0][0].title).toBe("High Value Order #ORD-2");

    // 3. Mark notification as read
    const notifId = notifications[0]!.id;
    const markSuccess = store.markAsRead(notifId);
    expect(markSuccess).toBe(true);
    expect(store.get(notifId)?.read).toBe(true);
    expect(store.list({ read: false })).toHaveLength(0);
  });

  it("exposes REST endpoints for notification inbox and rule management", async () => {
    const { adapter } = await createTestDb();
    const eventBus = createEventBus();

    const postsResource = defineResource({
      name: "posts",
      table: posts,
      adapter,
      validator: z.object({
        title: z.string(),
        content: z.string().optional(),
      }),
    });

    const initialRule: NotificationRule = {
      id: "rule-posts",
      name: "New Post Alert",
      enabled: true,
      resource: "posts",
      event: "create",
      template: {
        title: "New Post: {{title}}",
        body: "A post titled '{{title}}' was published.",
        severity: "info",
      },
      channels: [{ type: "in_app" }],
    };

    const app = defineApi({ posts: postsResource }, {
      eventBus,
      notifications: {
        enabled: true,
        rules: [initialRule],
      },
    });

    // 1. GET /notification-rules
    const rulesRes = await app.request("/notification-rules");
    expect(rulesRes.status).toBe(200);
    const rulesJson: any = await rulesRes.json();
    expect(rulesJson.data).toHaveLength(1);
    expect(rulesJson.data[0].name).toBe("New Post Alert");

    // 2. POST /notification-rules/test (dry run rule testing)
    const testRes = await app.request("/notification-rules/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rule: initialRule,
        mockEvent: { data: { title: "Hello World Post" } },
      }),
    });
    expect(testRes.status).toBe(200);
    const testJson: any = await testRes.json();
    expect(testJson.matched).toBe(true);
    expect(testJson.rendered.title).toBe("New Post: Hello World Post");

    // 3. Trigger event on event bus via simulated resource creation
    eventBus.publish({
      type: "create",
      resource: "posts",
      data: { id: 101, title: "Launch Day Announcement" },
    });

    // 4. GET /notifications
    const notifsRes = await app.request("/notifications");
    expect(notifsRes.status).toBe(200);
    const notifsJson: any = await notifsRes.json();
    expect(notifsJson.data).toHaveLength(1);
    expect(notifsJson.meta.unreadCount).toBe(1);
    expect(notifsJson.data[0].title).toBe("New Post: Launch Day Announcement");

    const notifId = notifsJson.data[0].id;

    // 5. PATCH /notifications/:id/read
    const patchRes = await app.request(`/notifications/${notifId}/read`, {
      method: "PATCH",
    });
    expect(patchRes.status).toBe(200);

    const afterPatchRes = await app.request("/notifications?read=false");
    const afterPatchJson: any = await afterPatchRes.json();
    expect(afterPatchJson.data).toHaveLength(0);
    expect(afterPatchJson.meta.unreadCount).toBe(0);

    // 6. POST /notification-rules (Add new rule)
    const addRuleRes = await app.request("/notification-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "rule-inventory",
        name: "Inventory Threshold",
        enabled: true,
        resource: "inventory",
        template: {
          title: "Low Inventory",
          body: "Restock required",
        },
        channels: [{ type: "in_app" }],
      }),
    });
    expect(addRuleRes.status).toBe(201);

    // 7. PUT /notification-rules/:id
    const putRuleRes = await app.request("/notification-rules/rule-inventory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Inventory Threshold" }),
    });
    expect(putRuleRes.status).toBe(200);

    // 8. DELETE /notification-rules/:id
    const delRuleRes = await app.request("/notification-rules/rule-inventory", {
      method: "DELETE",
    });
    expect(delRuleRes.status).toBe(200);

    // 9. DELETE /notifications/:id
    const delNotifRes = await app.request(`/notifications/${notifId}`, {
      method: "DELETE",
    });
    expect(delNotifRes.status).toBe(200);
  });
});
