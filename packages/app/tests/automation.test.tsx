import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import {
  AutomationRuleDialog,
  AutomationHistoryView,
} from "../src/index.js";
import type { AutomationExecutionResult } from "@honocube/core";

describe("Workflow Automation Engine UI (Issue #142)", () => {
  const mockExecutionLogs: AutomationExecutionResult[] = [
    {
      id: "exec-1",
      ruleId: "rule-101",
      ruleName: "Escalate Urgent Tickets",
      triggerEvent: "create",
      resource: "tickets",
      recordId: "1001",
      status: "success",
      timestamp: Date.now() - 30000,
      actionsExecuted: 2,
      actionDetails: [
        {
          action: { type: "update_field", target: "priority", value: "urgent" },
          status: "success",
          result: { updated: true },
        },
        {
          action: {
            type: "send_notification",
            target: "oncall-team",
            value: "Urgent ticket #1001 opened",
          },
          status: "success",
          result: { dispatched: true },
        },
      ],
    },
    {
      id: "exec-2",
      ruleId: "rule-102",
      ruleName: "Webhook Sync to Slack",
      triggerEvent: "state_change",
      resource: "orders",
      recordId: "505",
      status: "failure",
      timestamp: Date.now() - 3600000,
      actionsExecuted: 1,
      actionDetails: [
        {
          action: {
            type: "webhook_post",
            target: "https://hooks.slack.com/services/invalid",
          },
          status: "failure",
          error: "Connection timeout",
        },
      ],
    },
  ];

  it("renders AutomationRuleDialog in SSR when open", () => {
    const html = renderToString(
      <AutomationRuleDialog
        open={true}
        onOpenChange={vi.fn()}
        rule={{
          name: "Escalate Urgent Tickets",
          resource: "tickets",
        }}
      />
    );

    expect(html).toContain("data-testid=\"automation-rule-dialog\"");
    expect(html).toContain("Workflow Automation Builder: Escalate Urgent Tickets");
  });

  it("renders nothing when AutomationRuleDialog is closed", () => {
    const html = renderToString(
      <AutomationRuleDialog
        open={false}
        onOpenChange={vi.fn()}
        rule={{ name: "Escalate Urgent Tickets" }}
      />
    );

    expect(html).toBe("");
  });

  it("renders AutomationHistoryView empty state when no logs exist", () => {
    const html = renderToString(
      <AutomationHistoryView logs={[]} onClearLogs={vi.fn()} />
    );

    expect(html).toContain("Automation History");
    expect(html).toContain("No execution logs found");
    expect(html).toContain("0 runs");
  });

  it("renders AutomationHistoryView with execution logs and stats", () => {
    const html = renderToString(
      <AutomationHistoryView
        logs={mockExecutionLogs}
        onClearLogs={vi.fn()}
      />
    );

    expect(html).toContain("Automation History");
    expect(html).toContain("2 runs");
    expect(html).toContain("Escalate Urgent Tickets");
    expect(html).toContain("Webhook Sync to Slack");
    expect(html).toContain("tickets");
    expect(html).toContain("orders");
    expect(html).toContain("#1001");
    expect(html).toContain("#505");
    expect(html).toContain("Success");
    expect(html).toContain("Failed");
  });
});
