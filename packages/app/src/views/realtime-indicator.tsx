import * as React from "react";
import { Badge, cn } from "@honocube/ui";
import {
  useRealtimeStatus,
  useRealtimeClient,
  type RealtimeIndicatorProps,
  type RealtimeConnectionStatus,
} from "@honocube/core";

export function RealtimeIndicator({
  client: clientProp,
  showLabel = true,
  onReconnect,
  className = "",
}: RealtimeIndicatorProps): React.JSX.Element {
  const contextClient = useRealtimeClient();
  const client = clientProp || contextClient;
  const status: RealtimeConnectionStatus = useRealtimeStatus(client || undefined);

  const handleReconnect = () => {
    if (onReconnect) {
      onReconnect();
    } else if (client && typeof client.connect === "function") {
      client.connect();
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case "connected":
        return {
          label: "Live",
          badgeClass:
            "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15",
          dotClass: "bg-emerald-500",
          pingClass: "bg-emerald-400 animate-ping",
          clickable: false,
        };
      case "connecting":
        return {
          label: "Connecting...",
          badgeClass:
            "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          dotClass: "bg-amber-500",
          pingClass: "bg-amber-400 animate-pulse",
          clickable: false,
        };
      case "reconnecting":
        return {
          label: "Reconnecting...",
          badgeClass:
            "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          dotClass: "bg-amber-500",
          pingClass: "bg-amber-400 animate-ping",
          clickable: false,
        };
      case "disconnected":
      default:
        return {
          label: "Offline",
          badgeClass:
            "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20 hover:bg-zinc-500/20 cursor-pointer",
          dotClass: "bg-zinc-400 dark:bg-zinc-500",
          pingClass: "",
          clickable: true,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Badge
      variant="outline"
      data-testid="realtime-indicator"
      data-status={status}
      onClick={config.clickable ? handleReconnect : undefined}
      title={config.clickable ? "Connection offline. Click to reconnect." : `Realtime status: ${config.label}`}
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-medium transition-all select-none",
        config.badgeClass,
        className
      )}
    >
      <span className="relative flex h-2 w-2 mr-1.5 items-center justify-center">
        {config.pingClass && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-75",
              config.pingClass
            )}
          />
        )}
        <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", config.dotClass)} />
      </span>
      {showLabel && <span>{config.label}</span>}
    </Badge>
  );
}
