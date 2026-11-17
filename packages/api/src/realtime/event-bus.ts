import type {
  EventBus,
  EventBusSubscriber,
  EventBusSubscriptionFilter,
  RealtimeEvent,
} from "../types.js";

/**
 * Creates an in-memory Realtime EventBus supporting channel filtering,
 * resource wildcards, and multi-tenant isolation.
 */
export function createEventBus(): EventBus {
  let counter = 0;
  const subscriptions = new Map<
    number,
    { filter: EventBusSubscriptionFilter; subscriber: EventBusSubscriber }
  >();

  return {
    publish(eventInput) {
      counter++;
      const event: RealtimeEvent = {
        id: eventInput.id || `evt_${Date.now()}_${counter}`,
        timestamp: eventInput.timestamp || Date.now(),
        type: eventInput.type,
        resource: eventInput.resource,
        data: eventInput.data,
        ids: eventInput.ids,
        tenantId: eventInput.tenantId,
        meta: eventInput.meta,
      };

      for (const { filter, subscriber } of subscriptions.values()) {
        // 1. Check resource match
        if (filter.resource) {
          if (Array.isArray(filter.resource)) {
            if (!filter.resource.includes(event.resource) && !filter.resource.includes("*")) {
              continue;
            }
          } else if (filter.resource !== "*" && filter.resource !== event.resource) {
            continue;
          }
        }

        // 2. Check type match
        if (filter.type) {
          if (Array.isArray(filter.type)) {
            if (!filter.type.includes(event.type) && !filter.type.includes("*")) {
              continue;
            }
          } else if (filter.type !== "*" && filter.type !== event.type) {
            continue;
          }
        }

        // 3. Check tenant match
        if (filter.tenantId && event.tenantId && filter.tenantId !== event.tenantId) {
          continue;
        }

        try {
          subscriber(event);
        } catch (err) {
          console.error("[HonoCube EventBus] Error in subscriber callback:", err);
        }
      }
    },

    subscribe(filterOrChannel, subscriber) {
      counter++;
      const subId = counter;
      let filter: EventBusSubscriptionFilter;

      if (typeof filterOrChannel === "string") {
        if (filterOrChannel.startsWith("resource:")) {
          filter = { resource: filterOrChannel.replace("resource:", "") };
        } else if (filterOrChannel.startsWith("tenant:")) {
          filter = { tenantId: filterOrChannel.replace("tenant:", "") };
        } else if (filterOrChannel === "*") {
          filter = { resource: "*" };
        } else {
          filter = { resource: filterOrChannel };
        }
      } else {
        filter = filterOrChannel;
      }

      subscriptions.set(subId, { filter, subscriber });
      return () => {
        subscriptions.delete(subId);
      };
    },

    subscriberCount() {
      return subscriptions.size;
    },
  };
}
