import * as React from "react";
import { useState, useMemo } from "react";
import {
  Globe,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronRight,
  Code2,
  ArrowUpRight,
  Send,
} from "lucide-react";
import { Button, Badge } from "@honocube/ui";
import {
  formatRelativeTime,
  type WebhookDeliveriesViewProps,
  type WebhookDeliveryRecord,
  type WebhookEndpoint,
} from "@honocube/core";

export function WebhookDeliveriesView({
  deliveries = [],
  endpoints = [],
  onRetryDelivery,
  onClearDeliveries,
  isLoading = false,
  className = "",
}: WebhookDeliveriesViewProps): React.JSX.Element {
  const [filter, setFilter] = useState<"all" | "success" | "failure">("all");
  const [expandedDeliveryIds, setExpandedDeliveryIds] = useState<Record<string, boolean>>({});
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedDeliveryIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleRetry = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onRetryDelivery) return;
    setRetryingId(id);
    try {
      await onRetryDelivery(id);
    } finally {
      setRetryingId(null);
    }
  };

  const filteredDeliveries = useMemo(() => {
    if (filter === "all") return deliveries;
    if (filter === "success") {
      return deliveries.filter(
        (d: WebhookDeliveryRecord) =>
          !d.error &&
          d.statusCode !== null &&
          d.statusCode !== undefined &&
          d.statusCode >= 200 &&
          d.statusCode < 300
      );
    }
    return deliveries.filter(
      (d: WebhookDeliveryRecord) =>
        Boolean(d.error) ||
        d.statusCode === null ||
        d.statusCode === undefined ||
        d.statusCode < 200 ||
        d.statusCode >= 300
    );
  }, [deliveries, filter]);

  const stats = useMemo(() => {
    const total = deliveries.length;
    const success = deliveries.filter(
      (d: WebhookDeliveryRecord) =>
        !d.error &&
        d.statusCode !== null &&
        d.statusCode !== undefined &&
        d.statusCode >= 200 &&
        d.statusCode < 300
    ).length;
    const failure = total - success;
    return { total, success, failure };
  }, [deliveries]);

  const getStatusBadge = (delivery: WebhookDeliveryRecord) => {
    const isSuccess =
      !delivery.error &&
      delivery.statusCode !== null &&
      delivery.statusCode !== undefined &&
      delivery.statusCode >= 200 &&
      delivery.statusCode < 300;

    if (isSuccess) {
      return (
        <Badge
          variant="outline"
          className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 flex items-center gap-1 font-mono font-medium text-xs"
        >
          <CheckCircle2 className="h-3 w-3" />
          <span>{`${delivery.statusCode} OK`}</span>
        </Badge>
      );
    }

    if (delivery.statusCode) {
      return (
        <Badge
          variant="outline"
          className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 flex items-center gap-1 font-mono font-medium text-xs"
        >
          <XCircle className="h-3 w-3" />
          <span>{String(delivery.statusCode)}</span>
        </Badge>
      );
    }

    return (
      <Badge
        variant="outline"
        className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 flex items-center gap-1 font-medium text-xs"
      >
        <AlertCircle className="h-3 w-3" />
        Failed
      </Badge>
    );
  };

  return (
    <div
      className={`border rounded-xl bg-card text-card-foreground shadow-sm overflow-hidden ${className}`}
      data-testid="webhook-deliveries-view"
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b bg-muted/20">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Globe className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Webhook Deliveries</h3>
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {`${stats.total} ${stats.total === 1 ? "delivery" : "deliveries"}`}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live audit history, response payloads, and HMAC signing records
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter tabs */}
          <div className="flex items-center bg-muted/50 p-1 rounded-lg border text-xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === "all"
                  ? "bg-background text-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {`All (${stats.total})`}
            </button>
            <button
              type="button"
              onClick={() => setFilter("success")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === "success"
                  ? "bg-background text-emerald-600 font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {`Success (${stats.success})`}
            </button>
            <button
              type="button"
              onClick={() => setFilter("failure")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === "failure"
                  ? "bg-background text-rose-600 font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {`Failed (${stats.failure})`}
            </button>
          </div>

          {onClearDeliveries && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearDeliveries}
              disabled={isLoading || deliveries.length === 0}
              className="text-xs h-8 text-muted-foreground hover:text-destructive gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Body content */}
      {filteredDeliveries.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center px-4">
          <div className="p-3 bg-muted rounded-full text-muted-foreground mb-3">
            <Send className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium">No webhook deliveries recorded</p>
          <p className="text-xs text-muted-foreground max-w-sm mt-1">
            {filter === "all"
              ? "Outbound webhook dispatch logs will appear here when subscribed entity mutation events trigger active endpoints."
              : `No webhook deliveries with "${filter}" status were recorded.`}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {filteredDeliveries.map((delivery: WebhookDeliveryRecord) => {
            const isExpanded = !!expandedDeliveryIds[delivery.id];
            const matchingEndpoint = endpoints.find(
              (ep: WebhookEndpoint) => ep.url === delivery.endpointUrl
            );

            return (
              <div key={delivery.id} className="transition-colors hover:bg-muted/30">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpand(delivery.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleExpand(delivery.id);
                    }
                  }}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:px-4 cursor-pointer gap-2"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <button
                      type="button"
                      className="mt-0.5 sm:mt-0 text-muted-foreground hover:text-foreground p-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(delivery.id);
                      }}
                      aria-label={isExpanded ? "Collapse delivery details" : "Expand delivery details"}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(delivery)}
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 font-mono"
                        >
                          {delivery.event}
                        </Badge>
                        {matchingEndpoint?.name && (
                          <span className="font-semibold text-xs text-foreground">
                            {matchingEndpoint.name}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground font-mono truncate max-w-xs sm:max-w-md">
                          {delivery.endpointUrl}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span>{`Attempt ${delivery.attempt}`}</span>
                        <span>•</span>
                        <span>{`${delivery.durationMs}ms`}</span>
                        <span>•</span>
                        <span>{formatRelativeTime(new Date(delivery.timestamp).getTime())}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {onRetryDelivery && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleRetry(delivery.id, e)}
                        disabled={retryingId === delivery.id}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                        title="Retry Webhook Dispatch"
                      >
                        <RefreshCw
                          className={`h-3 w-3 ${
                            retryingId === delivery.id ? "animate-spin" : ""
                          }`}
                        />
                        <span>Retry</span>
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground font-mono">
                      {new Date(delivery.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {/* Expanded Payload & Header Inspector */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 bg-muted/10 border-t border-dashed space-y-3">
                    {/* Error message */}
                    {delivery.error && (
                      <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-200 text-rose-700 dark:text-rose-400 text-xs font-mono">
                        {`Delivery Failure: ${delivery.error}`}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* Request Payload */}
                      <div className="border rounded-lg bg-card p-3 space-y-1.5">
                        <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Code2 className="h-3 w-3 text-primary" />
                            Request Payload
                          </span>
                          <span className="font-mono text-[10px]">application/json</span>
                        </div>
                        <pre className="bg-muted/40 p-2 rounded text-[11px] font-mono overflow-x-auto max-h-48 text-muted-foreground">
                          {delivery.requestPayload
                            ? JSON.stringify(delivery.requestPayload, null, 2)
                            : "No payload recorded"}
                        </pre>
                      </div>

                      {/* Response Body */}
                      <div className="border rounded-lg bg-card p-3 space-y-1.5">
                        <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                            Response Body
                          </span>
                          <span className="font-mono text-[10px]">
                            {delivery.statusCode ? `HTTP ${delivery.statusCode}` : "No Response"}
                          </span>
                        </div>
                        <pre className="bg-muted/40 p-2 rounded text-[11px] font-mono overflow-x-auto max-h-48 text-muted-foreground">
                          {delivery.responseBody || (delivery.error ? delivery.error : "Empty Response")}
                        </pre>
                      </div>
                    </div>

                    {/* Request Headers */}
                    {delivery.requestHeaders && (
                      <div className="border rounded-lg bg-card p-3 space-y-1.5">
                        <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                          HTTP Request Headers
                        </div>
                        <div className="bg-muted/40 p-2 rounded text-[11px] font-mono grid grid-cols-1 sm:grid-cols-2 gap-1 text-muted-foreground">
                          {Object.entries(delivery.requestHeaders).map(([key, val]) => (
                            <div key={key} className="truncate">
                              <span className="text-foreground font-medium">{`${key}: `}</span>
                              <span title={String(val)}>{String(val)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
