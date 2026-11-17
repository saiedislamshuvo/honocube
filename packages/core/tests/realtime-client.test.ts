import { describe, it, expect, vi } from "vitest";
import {
  createRealtimeClient,
  setupRealtimeCacheSync,
  RealtimeEvent,
} from "../src/index.js";

describe("RealtimeClient & Cache Sync", () => {
  it("creates a client with default disconnected status and allows subscriptions", () => {
    const client = createRealtimeClient({
      url: "/api/events",
      autoConnect: false,
    });

    expect(client.status).toBe("disconnected");

    const events: RealtimeEvent[] = [];
    const unsubscribe = client.subscribe("orders", (evt) => {
      events.push(evt);
    });

    expect(client.subscriberCount("orders")).toBe(1);

    const testEvent: RealtimeEvent = {
      id: "evt-1",
      type: "create",
      resource: "orders",
      data: { id: 101, status: "pending" },
      timestamp: Date.now(),
    };

    client.simulateEvent(testEvent);
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe("evt-1");
    expect(events[0].resource).toBe("orders");

    // Unsubscribe removes listener
    unsubscribe();
    expect(client.subscriberCount("orders")).toBe(0);

    client.simulateEvent({
      id: "evt-2",
      type: "update",
      resource: "orders",
      timestamp: Date.now(),
    });
    expect(events).toHaveLength(1);
  });

  it("handles wildcard and event-type subscriptions", () => {
    const client = createRealtimeClient({
      url: "/api/events",
      autoConnect: false,
    });

    const wildcardEvents: RealtimeEvent[] = [];
    const deleteEvents: RealtimeEvent[] = [];

    const unsubWildcard = client.subscribe("*", (evt) => wildcardEvents.push(evt));
    const unsubDelete = client.on("delete", (evt) => deleteEvents.push(evt));

    client.simulateEvent({
      id: "evt-a",
      type: "create",
      resource: "products",
      timestamp: Date.now(),
    });

    client.simulateEvent({
      id: "evt-b",
      type: "delete",
      resource: "users",
      ids: [42],
      timestamp: Date.now(),
    });

    expect(wildcardEvents).toHaveLength(2);
    expect(deleteEvents).toHaveLength(1);
    expect(deleteEvents[0].id).toBe("evt-b");

    unsubWildcard();
    unsubDelete();
  });

  it("emits status changes to listeners", () => {
    const client = createRealtimeClient({
      url: "/api/events",
      autoConnect: false,
    });

    const statuses: string[] = [];
    const unsub = client.onStatusChange((s) => statuses.push(s));

    client.simulateStatus("connecting");
    client.simulateStatus("connected");
    client.simulateStatus("reconnecting");
    client.simulateStatus("disconnected");

    expect(statuses).toEqual(["connecting", "connected", "reconnecting", "disconnected"]);
    unsub();
  });

  it("invalidates TanStack Query caches automatically via setupRealtimeCacheSync", () => {
    const client = createRealtimeClient({
      url: "/api/events",
      autoConnect: false,
    });

    const invalidatedQueries: any[] = [];
    const mockQueryClient = {
      invalidateQueries: vi.fn((opts) => {
        invalidatedQueries.push(opts);
      }),
    };

    const cleanup = setupRealtimeCacheSync(client, mockQueryClient);

    // Simulate an update event on orders with id 55
    client.simulateEvent({
      id: "evt-sync-1",
      type: "update",
      resource: "orders",
      data: { id: 55, total: 200 },
      timestamp: Date.now(),
    });

    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(2);

    // Test predicate function
    const listPredicate = invalidatedQueries[0].predicate;
    expect(listPredicate({ queryKey: ["orders", "list"] })).toBe(true);
    expect(listPredicate({ queryKey: ["products", "list"] })).toBe(false);

    // Check detail query invalidation
    expect(invalidatedQueries[1].queryKey).toEqual(["orders", "detail", "55"]);

    cleanup();
  });
});
