import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/core/factory.js";
import { createEventBus } from "../../src/realtime/event-bus.js";
import { createTestDb, posts } from "../fixtures/db.js";

describe("Realtime EventBus & Server-Sent Events Subsystem", () => {
  it("supports in-memory pub/sub with channel filtering and wildcards", () => {
    const bus = createEventBus();
    const received: any[] = [];

    // 1. Subscribe to specific resource
    const unsubPosts = bus.subscribe("posts", (evt) => {
      received.push({ sub: "posts", evt });
    });

    // 2. Subscribe to all resources (*)
    const unsubAll = bus.subscribe("*", (evt) => {
      received.push({ sub: "all", evt });
    });

    // 3. Subscribe with filter object (only updates)
    bus.subscribe({ type: "update" }, (evt) => {
      received.push({ sub: "only-updates", evt });
    });

    // Publish create event on posts
    bus.publish({
      type: "create",
      resource: "posts",
      data: { id: 1, title: "First Post" },
    });

    // Publish update event on posts
    bus.publish({
      type: "update",
      resource: "posts",
      data: { id: 1, title: "First Post Edited" },
    });

    // Publish create event on users (should only trigger wildcard 'all')
    bus.publish({
      type: "create",
      resource: "users",
      data: { id: 2, name: "Alice" },
    });

    expect(received.some((r) => r.sub === "posts" && r.evt.data?.title === "First Post")).toBe(true);
    expect(received.some((r) => r.sub === "all" && r.evt.resource === "users")).toBe(true);
    expect(received.some((r) => r.sub === "only-updates" && r.evt.type === "update")).toBe(true);
    expect(received.some((r) => r.sub === "only-updates" && r.evt.type === "create")).toBe(false);

    // Unsubscribe
    unsubPosts();
    unsubAll();
    expect(bus.subscriberCount()).toBe(1);
  });

  it("handles tenant isolation in event bus subscriptions", () => {
    const bus = createEventBus();
    const tenantAEvents: any[] = [];
    const tenantBEvents: any[] = [];

    bus.subscribe({ resource: "orders", tenantId: "tenant-A" }, (evt) => {
      tenantAEvents.push(evt);
    });
    bus.subscribe({ resource: "orders", tenantId: "tenant-B" }, (evt) => {
      tenantBEvents.push(evt);
    });

    bus.publish({
      type: "create",
      resource: "orders",
      tenantId: "tenant-A",
      data: { id: 101, amount: 50 },
    });

    expect(tenantAEvents.length).toBe(1);
    expect(tenantBEvents.length).toBe(0);
  });

  it("serves live SSE stream on GET /events and broadcasts resource mutations", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
    });

    // 1. Connect to SSE endpoint
    const sseRes = await postsResource.request("/events", {
      method: "GET",
    });

    expect(sseRes.status).toBe(200);
    expect(sseRes.headers.get("content-type")).toContain("text/event-stream");
    expect(sseRes.body).toBeDefined();

    const reader = sseRes.body!.getReader();
    const decoder = new TextDecoder();

    // First chunk should be initial connect comment
    const chunk1 = await reader.read();
    const text1 = decoder.decode(chunk1.value);
    expect(text1).toContain(": connected");

    // 2. Trigger mutation via POST /
    await postsResource.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "SSE Realtime Post" }),
    });

    // Read streamed event
    const chunk2 = await reader.read();
    const text2 = decoder.decode(chunk2.value);
    expect(text2).toContain("data: {");
    expect(text2).toContain("SSE Realtime Post");
    expect(text2).toContain('"type":"create"');
    expect(text2).toContain('"resource":"posts"');

    // Cancel reader to simulate client disconnect
    await reader.cancel();
  });

  it("supports global API SSE endpoint and custom broadcast events", async () => {
    const { adapter } = await createTestDb();
    const app = createApp({ adapter });

    const postsResource = app.defineResource({
      name: "posts",
      table: posts,
      validator: z.object({ title: z.string() }),
    });

    const api = app.defineApi({ posts: postsResource });

    const sseRes = await api.request("/events?resources=posts,system", {
      method: "GET",
    });

    expect(sseRes.status).toBe(200);
    expect(sseRes.headers.get("content-type")).toContain("text/event-stream");

    const reader = sseRes.body!.getReader();
    const decoder = new TextDecoder();

    // Connected comment
    const chunk1 = await reader.read();
    expect(decoder.decode(chunk1.value)).toContain(": connected");

    // Broadcast custom event
    (api as any).broadcast({
      type: "custom",
      resource: "system",
      data: { message: "System maintenance in 10 minutes" },
    });

    const chunk2 = await reader.read();
    const text2 = decoder.decode(chunk2.value);
    expect(text2).toContain("System maintenance in 10 minutes");

    await reader.cancel();
  });
});
