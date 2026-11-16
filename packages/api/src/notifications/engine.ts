import type {
  NotificationRule,
  NotificationChannelType,
  NotificationSeverity,
  InAppNotification,
  DispatchedNotification,
} from "./rules.js";
import {
  evaluateRule,
  renderNotification,
} from "./rules.js";
import type { EventBus, RealtimeEvent } from "../types.js";

export type ChannelHandler = (
  notification: DispatchedNotification
) => Promise<any> | any;

export interface NotificationStore {
  add(notification: InAppNotification): InAppNotification;
  list(filter?: {
    tenantId?: string;
    read?: boolean;
    limit?: number;
  }): InAppNotification[];
  get(id: string): InAppNotification | undefined;
  markAsRead(id: string): boolean;
  markAllAsRead(tenantId?: string): number;
  delete(id: string): boolean;
  clear(): void;
}

export interface NotificationEngineOptions {
  eventBus?: EventBus;
  store?: NotificationStore;
  initialRules?: NotificationRule[];
  channelHandlers?: Record<string, ChannelHandler>;
  maxHistorySize?: number;
}

export interface NotificationEngine {
  store: NotificationStore;
  addRule(rule: NotificationRule): NotificationRule;
  getRules(resource?: string): NotificationRule[];
  getRule(id: string): NotificationRule | undefined;
  updateRule(id: string, updates: Partial<NotificationRule>): NotificationRule | undefined;
  removeRule(id: string): boolean;
  registerChannelHandler(
    type: NotificationChannelType | string,
    handler: ChannelHandler
  ): void;
  getDispatchedHistory(limit?: number): DispatchedNotification[];
  processEvent(event: RealtimeEvent): Promise<DispatchedNotification[]>;
  testRule(
    rule: NotificationRule,
    mockEvent: any
  ): { matched: boolean; rendered?: { title: string; body: string; severity: NotificationSeverity } };
}

/**
 * Creates an in-memory notification store for InAppNotification records.
 */
export function createNotificationStore(): NotificationStore {
  const notifications = new Map<string, InAppNotification>();

  return {
    add(notification) {
      notifications.set(notification.id, notification);
      return notification;
    },

    list(filter = {}) {
      let items = Array.from(notifications.values());

      if (filter.tenantId) {
        items = items.filter((n) => !n.tenantId || n.tenantId === filter.tenantId);
      }

      if (filter.read !== undefined) {
        items = items.filter((n) => n.read === filter.read);
      }

      // Sort newest first
      items.sort((a, b) => b.createdAt - a.createdAt);

      if (filter.limit && filter.limit > 0) {
        items = items.slice(0, filter.limit);
      }

      return items;
    },

    get(id) {
      return notifications.get(id);
    },

    markAsRead(id) {
      const item = notifications.get(id);
      if (item) {
        item.read = true;
        return true;
      }
      return false;
    },

    markAllAsRead(tenantId) {
      let count = 0;
      for (const item of notifications.values()) {
        if (!tenantId || item.tenantId === tenantId) {
          if (!item.read) {
            item.read = true;
            count++;
          }
        }
      }
      return count;
    },

    delete(id) {
      return notifications.delete(id);
    },

    clear() {
      notifications.clear();
    },
  };
}

/**
 * Creates a reactive Notification Engine capable of evaluating condition-based rules
 * on record mutation events and dispatching notifications across multiple channels.
 */
export function createNotificationEngine(
  options: NotificationEngineOptions = {}
): NotificationEngine {
  const store = options.store || createNotificationStore();
  const rules = new Map<string, NotificationRule>();
  const channelHandlers = new Map<string, ChannelHandler>();
  const dispatchHistory: DispatchedNotification[] = [];
  const maxHistory = options.maxHistorySize || 500;
  const eventBus = options.eventBus;

  // Register default channel handlers
  const defaultInAppHandler: ChannelHandler = (notification) => {
    const inApp: InAppNotification = {
      id: notification.id,
      ruleId: notification.ruleId,
      title: notification.title,
      body: notification.body,
      severity: notification.severity,
      resource: notification.event?.resource,
      recordId: notification.event?.data?.id,
      data: notification.event?.data,
      read: false,
      createdAt: notification.timestamp,
      tenantId: notification.tenantId,
    };

    store.add(inApp);

    // If event bus is present, broadcast instant notification event to live clients
    if (eventBus) {
      eventBus.publish({
        type: "notification:received",
        resource: "notifications",
        data: inApp,
        tenantId: inApp.tenantId,
      });
    }

    return inApp;
  };

  channelHandlers.set("in_app", defaultInAppHandler);

  // Register optional custom handlers passed via options
  if (options.channelHandlers) {
    for (const [type, handler] of Object.entries(options.channelHandlers)) {
      channelHandlers.set(type, handler);
    }
  }

  // Register initial rules
  if (options.initialRules) {
    for (const rule of options.initialRules) {
      rules.set(rule.id, rule);
    }
  }

  const engine: NotificationEngine = {
    store,

    addRule(rule) {
      rules.set(rule.id, rule);
      return rule;
    },

    getRules(resource) {
      const all = Array.from(rules.values());
      if (resource && resource !== "*") {
        return all.filter((r) => r.resource === "*" || r.resource === resource);
      }
      return all;
    },

    getRule(id) {
      return rules.get(id);
    },

    updateRule(id, updates) {
      const existing = rules.get(id);
      if (!existing) return undefined;
      const updated = { ...existing, ...updates };
      rules.set(id, updated);
      return updated;
    },

    removeRule(id) {
      return rules.delete(id);
    },

    registerChannelHandler(type, handler) {
      channelHandlers.set(type, handler);
    },

    getDispatchedHistory(limit = 100) {
      return dispatchHistory.slice(0, limit);
    },

    async processEvent(event) {
      const matchingRules: NotificationRule[] = [];

      for (const rule of rules.values()) {
        if (evaluateRule(rule, event)) {
          matchingRules.push(rule);
        }
      }

      if (matchingRules.length === 0) return [];

      const dispatched: DispatchedNotification[] = [];

      for (const rule of matchingRules) {
        const { title, body, severity } = renderNotification(rule, event);

        for (const channel of rule.channels) {
          const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          const dispatchedItem: DispatchedNotification = {
            id: notificationId,
            ruleId: rule.id,
            channel,
            title,
            body,
            severity,
            event,
            timestamp: Date.now(),
            tenantId: event.tenantId,
          };

          // Record in bounded history
          dispatchHistory.unshift(dispatchedItem);
          if (dispatchHistory.length > maxHistory) {
            dispatchHistory.pop();
          }

          dispatched.push(dispatchedItem);

          // Invoke handler if registered
          const handler = channelHandlers.get(channel.type);
          if (handler) {
            try {
              await handler(dispatchedItem);
            } catch (err) {
              console.error(
                `[HonoCube NotificationEngine] Failed dispatch on channel '${channel.type}':`,
                err
              );
            }
          }
        }
      }

      return dispatched;
    },

    testRule(rule, mockEvent) {
      const event = {
        resource: rule.resource === "*" ? "test" : rule.resource,
        type: rule.event && rule.event !== "*" ? rule.event : "create",
        data: mockEvent?.data || mockEvent,
        ...mockEvent,
      };

      const matched = evaluateRule(rule, event);
      if (!matched) {
        return { matched: false };
      }

      const rendered = renderNotification(rule, event);
      return { matched: true, rendered };
    },
  };

  // If eventBus provided, automatically listen to all events
  if (eventBus) {
    eventBus.subscribe("*", (event) => {
      // Don't loop on notification events
      if (event.resource === "notifications") return;
      engine.processEvent(event);
    });
  }

  return engine;
}
