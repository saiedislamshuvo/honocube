import { describe, it, expect, vi } from "vitest";
import {
  defineApi,
  defineResource,
  createEventBus,
  createWebhookManager,
  verifyWebhookSignature,
} from "../../src/index.js";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

const postsTable = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
});

describe("Outbound Webhook Management & Delivery Logging (Issue #143)", () => {
  it("registers, updates, deletes, and lists webhook endpoints", () => {
    const manager = createWebhookManager();

    const registered = manager.registerEndpoint({
      id: "ep-101",
      name: "Slack Notifications",
      url: "https://hooks.slack.com/services/sample",
      secret: "whsec_test_secret_123",
      events: ["posts.create", "posts.update"],
      enabled: true,
    });

    expect(registered.id).toBe("ep-101");
    expect(manager.getEndpoints()).toHaveLength(1);
    expect(manager.getEndpoint("ep-101")?.name).toBe("Slack Notifications");

    // Update
    manager.updateEndpoint("ep-101", { name: "Slack Alerts Updated" });
    expect(manager.getEndpoint("ep-101")?.name).toBe("Slack Alerts Updated");

    // Delete
    const deleted = manager.deleteEndpoint("ep-101");
    expect(deleted).toBe(true);
    expect(manager.getEndpoints()).toHaveLength(0);
  });

  it("dispatches webhooks with valid HMAC signature and captures delivery logs", async () => {
    const capturedRequests: Array<{ url: string; headers: Headers; body: any }> = [];

    const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedRequests.push({
        url: String(url),
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)),
      });
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const manager = createWebhookManager({
      fetchFn: mockFetch as any,
    });

    manager.registerEndpoint({
      id: "ep-zapier",
      url: "https://hooks.zapier.com/catch/123",
      secret: "whsec_zapier_secret",
      events: ["posts.*"],
      enabled: true,
    });

    const deliveries = await manager.dispatch({
      event: "posts.create",
      resource: "posts",
      recordId: 42,
      payload: { id: 42, title: "Hello Webhooks" },
    });

    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].statusCode).toBe(200);
    expect(deliveries[0].endpointUrl).toBe("https://hooks.zapier.com/catch/123");

    // Verify HMAC signature
    const sentReq = capturedRequests[0];
    const sigHeader = sentReq.headers.get("X-Honocube-Signature");
    expect(sigHeader).toBeDefined();

    const verification = await verifyWebhookSignature(
      sentReq.body,
      sigHeader,
      "whsec_zapier_secret"
    );
    expect(verification.valid).toBe(true);

    // Verify Delivery Logs
    const logs = manager.getDeliveries();
    expect(logs).toHaveLength(1);
    expect(logs[0].statusCode).toBe(200);
    expect(logs[0].event).toBe("posts.create");

    // Filter by success
    const successLogs = manager.getDeliveries({ status: "success" });
    expect(successLogs).toHaveLength(1);

    const failLogs = manager.getDeliveries({ status: "failure" });
    expect(failLogs).toHaveLength(0);
  });

  it("supports retrying failed webhook deliveries", async () => {
    let callCount = 0;
    const mockFetch = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response("Internal Server Error", { status: 500 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const manager = createWebhookManager({
      fetchFn: mockFetch as any,
    });

    manager.registerEndpoint({
      id: "ep-failing",
      url: "https://example.com/webhook",
      secret: "whsec_fail_test",
      events: ["*"],
      enabled: true,
    });

    const firstDispatch = await manager.dispatch({
      event: "posts.delete",
      resource: "posts",
      recordId: 99,
      payload: { id: 99 },
    });

    expect(firstDispatch[0].statusCode).toBe(500);

    // Initial logs contain 1 failed delivery
    const failedLogs = manager.getDeliveries({ status: "failure" });
    expect(failedLogs).toHaveLength(1);
    const failedId = failedLogs[0].id;

    // Retry delivery
    const retried = await manager.retryDelivery(failedId);
    expect(retried).not.toBeNull();
    expect(retried?.statusCode).toBe(200);
    expect(callCount).toBe(2);

    // Logs now contain 2 deliveries (initial failed + retried success)
    expect(manager.getDeliveries()).toHaveLength(2);
    expect(manager.getDeliveries({ status: "success" })).toHaveLength(1);
  });

  it("mounts REST endpoints for managing webhooks and delivery logs", async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(JSON.stringify({ ping: "pong" }), { status: 200 });
    });

    const eventBus = createEventBus();
    const postsResource = defineResource({
      table: postsTable,
    });

    const api = defineApi(
      { posts: postsResource },
      {
        eventBus,
        webhooks: {
          fetch: mockFetch as any,
        },
      } as any
    );

    // 1. Create Webhook via POST /webhooks
    const createRes = await api.request("/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Endpoint",
        url: "https://example.com/api/webhook",
        secret: "whsec_api_secret_test",
        events: ["posts.create"],
      }),
    });
    expect(createRes.status).toBe(201);
    const createdData = (await createRes.json() as any).data;
    expect(createdData.id).toBeDefined();

    // 2. List Webhooks via GET /webhooks
    const listRes = await api.request("/webhooks");
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json() as any).data;
    expect(listData).toHaveLength(1);
    expect(listData[0].url).toBe("https://example.com/api/webhook");

    // 3. Test Webhook Ping via POST /webhooks/test
    const testRes = await api.request("/webhooks/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/api/webhook",
        secret: "whsec_api_secret_test",
        event: "ping",
      }),
    });
    expect(testRes.status).toBe(200);
    const testData = (await testRes.json() as any).data;
    expect(testData.statusCode).toBe(200);

    // 4. Inspect Deliveries via GET /webhooks/deliveries
    const deliveriesRes = await api.request("/webhooks/deliveries");
    expect(deliveriesRes.status).toBe(200);
    const deliveriesData = (await deliveriesRes.json() as any).data;
    expect(deliveriesData.length).toBeGreaterThanOrEqual(1);

    // 5. Delete Webhook via DELETE /webhooks/:id
    const deleteRes = await api.request(`/webhooks/${createdData.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(200);
    const deleteJson = await deleteRes.json() as any;
    expect(deleteJson.success).toBe(true);

    // Verify list is empty
    const listAfterRes = await api.request("/webhooks");
    const listAfterData = (await listAfterRes.json() as any).data;
    expect(listAfterData).toHaveLength(0);
  });
});
