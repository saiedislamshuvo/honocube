import {
  isWebhookEventMatch,
  dispatchSingleWebhook,
} from "../utils/webhooks.js";
import type {
  EventBus,
  RealtimeEvent,
  WebhookDeliveryRecord,
  WebhookEndpointConfig,
  OutboxRecord,
} from "../types.js";

export interface WebhookEndpoint {
  id: string;
  name?: string;
  description?: string;
  url: string;
  secret: string;
  events: string[];
  headers?: Record<string, string>;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
  tenantId?: string;
}

export interface WebhookDeliveryFilter {
  endpointUrl?: string;
  event?: string;
  status?: "all" | "success" | "failure";
  limit?: number;
  tenantId?: string;
}

export interface WebhookManagerOptions {
  initialEndpoints?: WebhookEndpoint[];
  maxLogSize?: number;
  eventBus?: EventBus;
  fetchFn?: typeof fetch;
  maxAttempts?: number;
  retryBackoffMs?: number;
}

export interface WebhookManager {
  getEndpoints: (tenantId?: string) => WebhookEndpoint[];
  getEndpoint: (id: string) => WebhookEndpoint | undefined;
  registerEndpoint: (endpoint: WebhookEndpoint) => WebhookEndpoint;
  updateEndpoint: (id: string, updates: Partial<WebhookEndpoint>) => WebhookEndpoint | undefined;
  deleteEndpoint: (id: string) => boolean;
  getDeliveries: (filter?: WebhookDeliveryFilter) => WebhookDeliveryRecord[];
  getDelivery: (id: string) => WebhookDeliveryRecord | undefined;
  recordDelivery: (delivery: WebhookDeliveryRecord) => void;
  clearDeliveries: () => void;
  testEndpoint: (
    endpoint: Partial<WebhookEndpoint> & { url: string; secret: string },
    eventName?: string,
    payload?: any
  ) => Promise<WebhookDeliveryRecord>;
  retryDelivery: (deliveryId: string) => Promise<WebhookDeliveryRecord | null>;
  dispatch: (event: {
    event: string;
    resource?: string;
    recordId?: string | number;
    payload?: any;
    tenantId?: string;
  }) => Promise<WebhookDeliveryRecord[]>;
}

export function generateWebhookSecret(prefix = "whsec_"): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return (
      prefix +
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    );
  }
  return prefix + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function createWebhookManager(
  options: WebhookManagerOptions = {}
): WebhookManager {
  const endpoints = new Map<string, WebhookEndpoint>();
  const deliveries: WebhookDeliveryRecord[] = [];
  const maxLogSize = options.maxLogSize ?? 500;
  const fetchFn = options.fetchFn ?? globalThis.fetch;

  // Initialize seed endpoints
  if (options.initialEndpoints) {
    for (const ep of options.initialEndpoints) {
      endpoints.set(ep.id, { ...ep });
    }
  }

  const getEndpoints = (tenantId?: string): WebhookEndpoint[] => {
    const all = Array.from(endpoints.values());
    if (!tenantId) return all;
    return all.filter((ep) => !ep.tenantId || ep.tenantId === tenantId);
  };

  const getEndpoint = (id: string): WebhookEndpoint | undefined => {
    return endpoints.get(id);
  };

  const registerEndpoint = (endpoint: WebhookEndpoint): WebhookEndpoint => {
    const item: WebhookEndpoint = {
      ...endpoint,
      id: endpoint.id || `wh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      events: endpoint.events?.length ? endpoint.events : ["*"],
      enabled: endpoint.enabled !== false,
      createdAt: endpoint.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    endpoints.set(item.id, item);
    return item;
  };

  const updateEndpoint = (
    id: string,
    updates: Partial<WebhookEndpoint>
  ): WebhookEndpoint | undefined => {
    const existing = endpoints.get(id);
    if (!existing) return undefined;

    const updated: WebhookEndpoint = {
      ...existing,
      ...updates,
      id: existing.id, // ID is immutable
      updatedAt: new Date().toISOString(),
    };
    endpoints.set(id, updated);
    return updated;
  };

  const deleteEndpoint = (id: string): boolean => {
    return endpoints.delete(id);
  };

  const recordDelivery = (delivery: WebhookDeliveryRecord) => {
    deliveries.unshift(delivery);
    if (deliveries.length > maxLogSize) {
      deliveries.length = maxLogSize;
    }
  };

  const getDeliveries = (filter?: WebhookDeliveryFilter): WebhookDeliveryRecord[] => {
    let result = deliveries;

    if (filter?.tenantId) {
      result = result.filter(
        (d: any) => !d.tenantId || d.tenantId === filter.tenantId
      );
    }

    if (filter?.endpointUrl) {
      result = result.filter((d) => d.endpointUrl === filter.endpointUrl);
    }

    if (filter?.event) {
      result = result.filter((d) => d.event === filter.event);
    }

    if (filter?.status && filter.status !== "all") {
      if (filter.status === "success") {
        result = result.filter(
          (d) =>
            !d.error &&
            d.statusCode !== null &&
            d.statusCode !== undefined &&
            d.statusCode >= 200 &&
            d.statusCode < 300
        );
      } else if (filter.status === "failure") {
        result = result.filter(
          (d) =>
            Boolean(d.error) ||
            d.statusCode === null ||
            d.statusCode === undefined ||
            d.statusCode < 200 ||
            d.statusCode >= 300
        );
      }
    }

    if (filter?.limit && filter.limit > 0) {
      result = result.slice(0, filter.limit);
    }

    return result;
  };

  const getDelivery = (id: string): WebhookDeliveryRecord | undefined => {
    return deliveries.find((d) => d.id === id);
  };

  const clearDeliveries = () => {
    deliveries.length = 0;
  };

  const testEndpoint = async (
    endpoint: Partial<WebhookEndpoint> & { url: string; secret: string },
    eventName = "ping",
    payload?: any
  ): Promise<WebhookDeliveryRecord> => {
    const simulatedOutboxRecord: OutboxRecord = {
      id: `test_${Date.now()}`,
      resource: "system",
      recordId: "test_ping",
      event: eventName as any,
      payload: payload ?? {
        event: eventName,
        message: "HonoCube Webhook Test Ping",
        timestamp: new Date().toISOString(),
      },
      status: "pending",
      attempts: 0,
      createdAt: new Date().toISOString(),
    };

    const config: WebhookEndpointConfig = {
      url: endpoint.url,
      secret: endpoint.secret,
      headers: endpoint.headers,
      disabled: false,
    };

    const delivery = await dispatchSingleWebhook(config, simulatedOutboxRecord, {
      fetchFn,
    });

    recordDelivery(delivery);
    return delivery;
  };

  const retryDelivery = async (
    deliveryId: string
  ): Promise<WebhookDeliveryRecord | null> => {
    const pastDelivery = deliveries.find((d) => d.id === deliveryId);
    if (!pastDelivery) return null;

    // Look for matching registered endpoint or reconstruct config
    let endpoint = Array.from(endpoints.values()).find(
      (ep) => ep.url === pastDelivery.endpointUrl
    );

    if (!endpoint) {
      endpoint = {
        id: "transient",
        url: pastDelivery.endpointUrl,
        secret: "whsec_fallback",
        events: ["*"],
        enabled: true,
      };
    }

    const retryOutboxRecord: OutboxRecord = {
      id: pastDelivery.outboxId || `retry_${Date.now()}`,
      resource:
        (pastDelivery.event.includes(".")
          ? pastDelivery.event.split(".")[0]
          : "unknown") || "unknown",
      recordId: "retry",
      event: pastDelivery.event as any,
      payload: pastDelivery.requestPayload ?? {},
      status: "pending",
      attempts: pastDelivery.attempt,
      createdAt: pastDelivery.timestamp || new Date().toISOString(),
    };

    const config: WebhookEndpointConfig = {
      url: endpoint.url,
      secret: endpoint.secret,
      headers: {
        ...(pastDelivery.requestHeaders || {}),
        ...(endpoint.headers || {}),
      },
      disabled: false,
    };

    const newDelivery = await dispatchSingleWebhook(config, retryOutboxRecord, {
      fetchFn,
    });

    recordDelivery(newDelivery);
    return newDelivery;
  };

  const dispatch = async (event: {
    event: string;
    resource?: string;
    recordId?: string | number;
    payload?: any;
    tenantId?: string;
  }): Promise<WebhookDeliveryRecord[]> => {
    const res = (event.resource || (event.event.includes(".") ? event.event.split(".")[0] : "*")) || "*";
    const ev = (event.event.includes(".") ? event.event.split(".")[1] : event.event) || "*";

    const matching = Array.from(endpoints.values()).filter(
      (ep) =>
        ep.enabled &&
        (!ep.tenantId || !event.tenantId || ep.tenantId === event.tenantId) &&
        isWebhookEventMatch(ep.events, res, ev)
    );

    if (matching.length === 0) return [];

    const outboxRecord: OutboxRecord = {
      id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      resource: res,
      recordId: event.recordId ?? "unknown",
      event: event.event as any,
      payload: event.payload ?? {},
      tenantId: event.tenantId ?? null,
      status: "pending",
      attempts: 0,
      createdAt: new Date().toISOString(),
    };

    const results: WebhookDeliveryRecord[] = [];

    for (const ep of matching) {
      const config: WebhookEndpointConfig = {
        url: ep.url,
        secret: ep.secret,
        headers: ep.headers,
        disabled: false,
      };

      const delivery = await dispatchSingleWebhook(config, outboxRecord, {
        fetchFn,
      });

      recordDelivery(delivery);
      results.push(delivery);
    }

    return results;
  };

  // Wire up to EventBus if provided
  if (options.eventBus) {
    options.eventBus.subscribe("*", (realtimeEvent: RealtimeEvent) => {
      // Avoid recursive loops
      if (realtimeEvent.resource === "system" && realtimeEvent.type === "webhook") {
        return;
      }
      const recordId =
        realtimeEvent.ids && realtimeEvent.ids.length === 1
          ? realtimeEvent.ids[0]
          : (realtimeEvent.data as any)?.id ?? "unknown";

      void dispatch({
        event: `${realtimeEvent.resource}.${realtimeEvent.type}`,
        resource: realtimeEvent.resource,
        recordId,
        payload: realtimeEvent.data ?? realtimeEvent,
        tenantId: realtimeEvent.tenantId,
      });
    });
  }

  return {
    getEndpoints,
    getEndpoint,
    registerEndpoint,
    updateEndpoint,
    deleteEndpoint,
    getDeliveries,
    getDelivery,
    recordDelivery,
    clearDeliveries,
    testEndpoint,
    retryDelivery,
    dispatch,
  };
}
