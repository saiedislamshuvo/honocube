import React, { createContext, useContext, useEffect, useState } from "react";

export type RealtimeConnectionStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

export interface RealtimeEvent<T = any> {
  id: string;
  type: string;
  resource: string;
  data?: T;
  ids?: (string | number)[];
  tenantId?: string;
  timestamp: number;
  meta?: Record<string, unknown>;
}

export interface RealtimeClientOptions {
  url: string;
  resources?: string[];
  types?: string[];
  tenantId?: string;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectInterval?: number;
}

export type RealtimeEventListener<T = any> = (event: RealtimeEvent<T>) => void;
export type RealtimeStatusListener = (status: RealtimeConnectionStatus) => void;

export interface RealtimeClient {
  readonly status: RealtimeConnectionStatus;
  connect(): void;
  disconnect(): void;
  subscribe<T = any>(resourceOrPattern: string, listener: RealtimeEventListener<T>): () => void;
  on<T = any>(eventType: string, listener: RealtimeEventListener<T>): () => void;
  onStatusChange(listener: RealtimeStatusListener): () => void;
  simulateEvent(event: RealtimeEvent): void;
  simulateStatus(status: RealtimeConnectionStatus): void;
  subscriberCount(resource?: string): number;
}

/**
 * Creates a lightweight, cross-platform Realtime Client using Server-Sent Events.
 * Automatically handles reconnection, channel dispatching, and SSR fallback.
 */
export function createRealtimeClient(options: RealtimeClientOptions): RealtimeClient {
  const {
    url,
    resources,
    types,
    tenantId,
    autoConnect = true,
    reconnectInterval = 2000,
    maxReconnectInterval = 30000,
  } = options;

  let currentStatus: RealtimeConnectionStatus = "disconnected";
  let eventSource: EventSource | null = null;
  let reconnectTimer: any = null;
  let currentBackoff = reconnectInterval;
  let isExplicitlyClosed = false;

  const resourceSubscribers = new Map<string, Set<RealtimeEventListener>>();
  const typeSubscribers = new Map<string, Set<RealtimeEventListener>>();
  const statusListeners = new Set<RealtimeStatusListener>();

  const updateStatus = (nextStatus: RealtimeConnectionStatus) => {
    if (currentStatus !== nextStatus) {
      currentStatus = nextStatus;
      for (const listener of statusListeners) {
        try {
          listener(currentStatus);
        } catch (err) {
          console.error("[HonoCube Realtime] Error in status listener:", err);
        }
      }
    }
  };

  const dispatchEvent = (event: RealtimeEvent) => {
    // 1. Dispatch to wildcard subscribers
    const wildcards = resourceSubscribers.get("*");
    if (wildcards) {
      for (const fn of wildcards) {
        try {
          fn(event);
        } catch (err) {
          console.error("[HonoCube Realtime] Error in wildcard subscriber:", err);
        }
      }
    }

    // 2. Dispatch to specific resource subscribers
    const resSubs = resourceSubscribers.get(event.resource);
    if (resSubs) {
      for (const fn of resSubs) {
        try {
          fn(event);
        } catch (err) {
          console.error("[HonoCube Realtime] Error in resource subscriber:", err);
        }
      }
    }

    // 3. Dispatch to event type subscribers
    const typeSubs = typeSubscribers.get(event.type);
    if (typeSubs) {
      for (const fn of typeSubs) {
        try {
          fn(event);
        } catch (err) {
          console.error("[HonoCube Realtime] Error in type subscriber:", err);
        }
      }
    }
  };

  const connect = () => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      updateStatus("connected"); // SSR / Node mock status
      return;
    }

    if (eventSource || currentStatus === "connected" || currentStatus === "connecting") {
      return;
    }

    isExplicitlyClosed = false;
    updateStatus("connecting");

    // Build URL with query parameters
    const queryParams = new URLSearchParams();
    if (resources && resources.length > 0) queryParams.set("resources", resources.join(","));
    if (types && types.length > 0) queryParams.set("types", types.join(","));
    if (tenantId) queryParams.set("tenantId", tenantId);

    const fullUrl = queryParams.toString() ? `${url}?${queryParams.toString()}` : url;

    try {
      eventSource = new EventSource(fullUrl);

      eventSource.onopen = () => {
        currentBackoff = reconnectInterval;
        updateStatus("connected");
      };

      eventSource.onmessage = (e) => {
        if (!e.data || e.data.trim() === "" || e.data.startsWith(":")) return;
        try {
          const parsed = JSON.parse(e.data);
          dispatchEvent(parsed);
        } catch {
          // ignore non-json messages
        }
      };

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }

        if (!isExplicitlyClosed) {
          updateStatus("reconnecting");
          if (!reconnectTimer) {
            reconnectTimer = setTimeout(() => {
              reconnectTimer = null;
              currentBackoff = Math.min(currentBackoff * 1.5, maxReconnectInterval);
              connect();
            }, currentBackoff);
          }
        } else {
          updateStatus("disconnected");
        }
      };
    } catch {
      updateStatus("disconnected");
    }
  };

  const disconnect = () => {
    isExplicitlyClosed = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    updateStatus("disconnected");
  };

  if (autoConnect) {
    connect();
  }

  return {
    get status() {
      return currentStatus;
    },
    connect,
    disconnect,
    subscribe(resourceOrPattern, listener) {
      if (!resourceSubscribers.has(resourceOrPattern)) {
        resourceSubscribers.set(resourceOrPattern, new Set());
      }
      resourceSubscribers.get(resourceOrPattern)!.add(listener);

      return () => {
        const subs = resourceSubscribers.get(resourceOrPattern);
        if (subs) {
          subs.delete(listener);
          if (subs.size === 0) resourceSubscribers.delete(resourceOrPattern);
        }
      };
    },
    on(eventType, listener) {
      if (!typeSubscribers.has(eventType)) {
        typeSubscribers.set(eventType, new Set());
      }
      typeSubscribers.get(eventType)!.add(listener);

      return () => {
        const subs = typeSubscribers.get(eventType);
        if (subs) {
          subs.delete(listener);
          if (subs.size === 0) typeSubscribers.delete(eventType);
        }
      };
    },
    onStatusChange(listener) {
      statusListeners.add(listener);
      return () => {
        statusListeners.delete(listener);
      };
    },
    simulateEvent(event) {
      dispatchEvent(event);
    },
    simulateStatus(status) {
      updateStatus(status);
    },
    subscriberCount(resource) {
      if (resource) {
        return resourceSubscribers.get(resource)?.size || 0;
      }
      let total = 0;
      for (const subs of resourceSubscribers.values()) total += subs.size;
      for (const subs of typeSubscribers.values()) total += subs.size;
      return total;
    },
  };
}

/**
 * Connects the realtime client to a TanStack QueryClient, automatically invalidating
 * cache keys for mutated resources when background updates occur.
 */
export function setupRealtimeCacheSync(client: RealtimeClient, queryClient: any): () => void {
  return client.subscribe("*", (event) => {
    if (!event.resource) return;

    // 1. Invalidate list queries for this resource
    if (queryClient.invalidateQueries) {
      queryClient.invalidateQueries({
        predicate: (query: any) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === event.resource;
        },
      });

      // 2. Invalidate specific detail query if target id is known
      const targetIds = event.ids || (event.data?.id !== undefined ? [event.data.id] : []);
      for (const id of targetIds) {
        queryClient.invalidateQueries({
          queryKey: [event.resource, "detail", String(id)],
        });
      }
    }
  });
}

// ---------------------------------------------------------------------------
// React Context & Hooks
// ---------------------------------------------------------------------------

export const RealtimeContext = createContext<RealtimeClient | null>(null);

export interface RealtimeProviderProps {
  client: RealtimeClient;
  children: React.ReactNode;
}

export function RealtimeProvider({ client, children }: RealtimeProviderProps): React.JSX.Element {
  return React.createElement(RealtimeContext.Provider, { value: client }, children);
}

export function useRealtimeClient(): RealtimeClient | null {
  return useContext(RealtimeContext);
}

export function useRealtimeStatus(clientProp?: RealtimeClient): RealtimeConnectionStatus {
  const contextClient = useRealtimeClient();
  const client = clientProp || contextClient;
  const [status, setStatus] = useState<RealtimeConnectionStatus>(client ? client.status : "disconnected");

  useEffect(() => {
    if (!client) return;
    setStatus(client.status);
    return client.onStatusChange(setStatus);
  }, [client]);

  return status;
}

export function useRealtimeSubscription<T = any>(
  resource: string,
  onEvent?: RealtimeEventListener<T>,
  clientProp?: RealtimeClient
): void {
  const contextClient = useRealtimeClient();
  const client = clientProp || contextClient;

  useEffect(() => {
    if (!client || !onEvent) return;
    return client.subscribe<T>(resource, onEvent);
  }, [client, resource, onEvent]);
}
