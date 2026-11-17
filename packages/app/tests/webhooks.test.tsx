import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import {
  WebhookManagerDialog,
  WebhookDeliveriesView,
} from "../src/index.js";
import type { WebhookDeliveryRecord, WebhookEndpoint } from "@honocube/core";

describe("Declarative Outbound Webhook Management UI (Issue #143)", () => {
  const mockEndpoints: WebhookEndpoint[] = [
    {
      id: "wh-1",
      name: "Slack Incoming Alerts",
      url: "https://hooks.slack.com/services/123",
      secret: "whsec_slack_123",
      events: ["posts.create"],
      enabled: true,
    },
  ];

  const mockDeliveries: WebhookDeliveryRecord[] = [
    {
      id: "del-101",
      endpointUrl: "https://hooks.slack.com/services/123",
      event: "posts.create",
      attempt: 1,
      statusCode: 200,
      durationMs: 42,
      timestamp: new Date().toISOString(),
      requestPayload: { id: 1, title: "Launch Post" },
      responseBody: "ok",
    },
    {
      id: "del-102",
      endpointUrl: "https://api.external.com/webhooks",
      event: "posts.delete",
      attempt: 2,
      statusCode: 500,
      durationMs: 120,
      error: "Internal Server Error",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      requestPayload: { id: 2 },
    },
  ];

  it("renders WebhookManagerDialog in SSR when open", () => {
    const html = renderToString(
      <WebhookManagerDialog
        open={true}
        onOpenChange={vi.fn()}
        endpoint={{
          name: "Zapier Order Sync",
          url: "https://hooks.zapier.com/catch/orders",
        }}
      />
    );

    expect(html).toContain("data-testid=\"webhook-manager-dialog\"");
    expect(html).toContain("Outbound Webhook: Zapier Order Sync");
  });

  it("renders nothing when WebhookManagerDialog is closed", () => {
    const html = renderToString(
      <WebhookManagerDialog
        open={false}
        onOpenChange={vi.fn()}
        endpoint={{ name: "Zapier Order Sync" }}
      />
    );

    expect(html).toBe("");
  });

  it("renders WebhookDeliveriesView empty state when no deliveries exist", () => {
    const html = renderToString(
      <WebhookDeliveriesView deliveries={[]} onClearDeliveries={vi.fn()} />
    );

    expect(html).toContain("Webhook Deliveries");
    expect(html).toContain("No webhook deliveries recorded");
    expect(html).toContain("0 deliveries");
  });

  it("renders WebhookDeliveriesView with execution deliveries and stats", () => {
    const html = renderToString(
      <WebhookDeliveriesView
        deliveries={mockDeliveries}
        endpoints={mockEndpoints}
        onRetryDelivery={vi.fn()}
        onClearDeliveries={vi.fn()}
      />
    );

    expect(html).toContain("Webhook Deliveries");
    expect(html).toContain("2 deliveries");
    expect(html).toContain("Slack Incoming Alerts");
    expect(html).toContain("https://hooks.slack.com/services/123");
    expect(html).toContain("https://api.external.com/webhooks");
    expect(html).toContain("posts.create");
    expect(html).toContain("posts.delete");
    expect(html).toContain("200 OK");
    expect(html).toContain("500");
  });
});
