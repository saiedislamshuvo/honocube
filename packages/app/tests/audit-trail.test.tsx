import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { AuditTrailView } from "../src/index.js";
import type { AuditEntry } from "@honocube/core";

describe("Comprehensive Activity Logging & Mutation Audit Trail UI (Issue #144)", () => {
  const mockEntries: AuditEntry[] = [
    {
      id: "audit-1",
      resource: "orders",
      recordId: 1001,
      action: "create",
      actorId: "usr_alice",
      newData: { id: 1001, status: "pending", total: 250 },
      ip: "192.168.1.10",
      userAgent: "ERP-Admin/1.0",
      timestamp: new Date().toISOString(),
    },
    {
      id: "audit-2",
      resource: "orders",
      recordId: 1001,
      action: "update",
      actorId: "usr_bob",
      diff: [
        { field: "status", from: "pending", to: "approved" },
        { field: "total", from: 250, to: 300 },
      ],
      oldData: { status: "pending", total: 250 },
      newData: { status: "approved", total: 300 },
      timestamp: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: "audit-3",
      resource: "customers",
      recordId: "cust_99",
      action: "delete",
      actorId: "usr_charlie",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
    },
  ];

  it("renders AuditTrailView empty state when no entries exist", () => {
    const html = renderToString(
      <AuditTrailView entries={[]} onClearAudit={vi.fn()} />
    );

    expect(html).toContain("data-testid=\"audit-trail-view\"");
    expect(html).toContain("No audit entries found");
    expect(html).toContain("0 entries");
  });

  it("renders AuditTrailView with entries, diffs, and action badges", () => {
    const html = renderToString(
      <AuditTrailView
        entries={mockEntries}
        onClearAudit={vi.fn()}
      />
    );

    expect(html).toContain("data-testid=\"audit-trail-view\"");
    expect(html).toContain("3 entries");
    expect(html).toContain("orders");
    expect(html).toContain("customers");
    expect(html).toContain("#1001");
    expect(html).toContain("#cust_99");
    expect(html).toContain("usr_alice");
    expect(html).toContain("usr_bob");
    expect(html).toContain("usr_charlie");
    expect(html).toContain("Create");
    expect(html).toContain("Update");
    expect(html).toContain("Delete");
    expect(html).toContain("2 fields changed:");
    expect(html).toContain("status");
    expect(html).toContain("total");
  });

  it("filters entries by resource and recordId", () => {
    const html = renderToString(
      <AuditTrailView
        entries={mockEntries}
        resource="orders"
        recordId={1001}
      />
    );

    expect(html).toContain("Audit Trail for #1001");
    expect(html).toContain("2 entries");
    expect(html).not.toContain("cust_99");
    expect(html).not.toContain("customers");
  });
});
