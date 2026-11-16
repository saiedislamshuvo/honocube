import * as React from "react";
import { useState, useMemo } from "react";
import {
  Bell,
  BellOff,
  CheckCheck,
  Check,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";
import {
  Badge,
} from "@honocube/ui";
import {
  formatRelativeTime,
  type NotificationBellProps,
  type NotificationSeverity,
} from "@honocube/core";

export function NotificationBell({
  notifications = [],
  unreadCount: explicitUnreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onNotificationClick,
  className = "",
}: NotificationBellProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const unreadCount = useMemo(() => {
    if (explicitUnreadCount !== undefined) return explicitUnreadCount;
    return notifications.filter((n) => !n.read).length;
  }, [explicitUnreadCount, notifications]);

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((n) => !n.read);
    }
    return notifications;
  }, [notifications, filter]);

  const getSeverityIcon = (severity: NotificationSeverity) => {
    switch (severity) {
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />;
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />;
      case "info":
      default:
        return <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />;
    }
  };

  // SSR fallback
  if (typeof document === "undefined") {
    return (
      <div data-testid="notification-bell" className={`relative inline-block ${className}`}>
        <button type="button" className="relative p-2">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && <span>{unreadCount}</span>}
        </button>
      </div>
    );
  }

  return (
    <div data-testid="notification-bell" className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-md hover:bg-muted text-foreground/80 hover:text-foreground transition-colors cursor-pointer"
        aria-label={`Notifications (${unreadCount} unread)`}
        data-testid="notification-bell-trigger"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            data-testid="unread-badge"
            className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-in zoom-in-50"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            data-testid="notification-popover"
            className="absolute right-0 mt-2 w-80 sm:w-96 rounded-lg border bg-popover text-popover-foreground shadow-lg z-50 animate-in fade-in-50 slide-in-from-top-1"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-medium">
                    {unreadCount} new
                  </Badge>
                )}
              </div>
              {onMarkAllAsRead && unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => onMarkAllAsRead()}
                  className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                  data-testid="mark-all-read-button"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center border-b px-3 py-1.5 text-xs gap-1 bg-muted/20">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                  filter === "all"
                    ? "bg-background font-medium shadow-xs text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                  filter === "unread"
                    ? "bg-background font-medium shadow-xs text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            {/* Notification Items List */}
            <div className="max-h-80 overflow-y-auto divide-y">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-2">
                    <BellOff className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-medium text-foreground">No notifications</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {filter === "unread"
                      ? "You're all caught up! No unread alerts."
                      : "No system alerts recorded."}
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    data-testid={`notification-item-${notif.id}`}
                    onClick={() => {
                      if (onNotificationClick) onNotificationClick(notif);
                      if (!notif.read && onMarkAsRead) onMarkAsRead(notif.id);
                    }}
                    className={`flex items-start gap-3 p-3 transition-colors cursor-pointer text-left ${
                      notif.read
                        ? "opacity-70 hover:opacity-100 hover:bg-muted/40"
                        : "bg-primary/5 hover:bg-primary/10"
                    }`}
                  >
                    {getSeverityIcon(notif.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs font-medium truncate ${notif.read ? "text-foreground" : "font-semibold text-foreground"}`}>
                          {notif.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                        {notif.body}
                      </p>
                    </div>
                    {!notif.read && onMarkAsRead && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkAsRead(notif.id);
                        }}
                        className="h-6 w-6 rounded hover:bg-background/80 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                        title="Mark as read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
