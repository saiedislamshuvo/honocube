import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import {
  NotificationBell,
  NotificationRuleDialog,
} from "../src/index.js";
import type { InAppNotification } from "@honocube/core";

describe("Notification Bell & Rule Builder UI (Issue #140)", () => {
  const mockNotifications: InAppNotification[] = [
    {
      id: "notif-1",
      title: "High Value Order #ORD-101",
      body: "Order for $2,500 received from Acme Corp.",
      severity: "warning",
      read: false,
      createdAt: Date.now() - 60000,
    },
    {
      id: "notif-2",
      title: "System Update",
      body: "Database backup completed successfully.",
      severity: "info",
      read: true,
      createdAt: Date.now() - 3600000,
    },
  ];

  it("renders NotificationBell with unread indicator badge", () => {
    const html = renderToString(
      <NotificationBell
        notifications={mockNotifications}
        unreadCount={1}
        onMarkAsRead={vi.fn()}
        onMarkAllAsRead={vi.fn()}
      />
    );

    expect(html).toContain("data-testid=\"notification-bell\"");
    expect(html).toContain("1");
  });

  it("renders NotificationRuleDialog in SSR when open", () => {
    const html = renderToString(
      <NotificationRuleDialog
        open={true}
        onOpenChange={vi.fn()}
        rule={{
          name: "Inventory Threshold Alert",
          resource: "inventory",
        }}
      />
    );

    expect(html).toContain("data-testid=\"notification-rule-dialog\"");
    expect(html).toContain("Notification Rule Builder: Inventory Threshold Alert");
  });

  it("renders nothing when NotificationRuleDialog is closed", () => {
    const html = renderToString(
      <NotificationRuleDialog
        open={false}
        onOpenChange={vi.fn()}
      />
    );

    expect(html).toBe("");
  });
});
