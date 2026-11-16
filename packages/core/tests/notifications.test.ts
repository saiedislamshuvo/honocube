import { describe, it, expect } from "vitest";
import {
  getNestedValue,
  interpolateTemplate,
  evaluateCondition,
  evaluateRule,
  renderNotification,
  formatRelativeTime,
  type NotificationRule,
} from "../src/notifications/rules.js";

describe("Event-Driven Notification Rules Engine Core (Issue #140)", () => {
  describe("getNestedValue", () => {
    it("retrieves flat and nested values safely", () => {
      const obj = {
        name: "Acme Corp",
        order: { id: "ORD-99", total: 1500, customer: { email: "alice@acme.com" } },
        items: [{ sku: "SKU-A" }, { sku: "SKU-B" }],
      };

      expect(getNestedValue(obj, "name")).toBe("Acme Corp");
      expect(getNestedValue(obj, "order.id")).toBe("ORD-99");
      expect(getNestedValue(obj, "order.customer.email")).toBe("alice@acme.com");
      expect(getNestedValue(obj, "items.1.sku")).toBe("SKU-B");
      expect(getNestedValue(obj, "nonexistent.field")).toBeUndefined();
      expect(getNestedValue(null, "field")).toBeUndefined();
    });
  });

  describe("interpolateTemplate", () => {
    it("interpolates template tokens with record data", () => {
      const template = "Order #{{id}} confirmed for ${{total}} (Customer: {{customer.name}})";
      const data = {
        id: "10042",
        total: 250,
        customer: { name: "John Doe" },
      };

      expect(interpolateTemplate(template, data)).toBe(
        "Order #10042 confirmed for $250 (Customer: John Doe)"
      );
    });

    it("handles missing tokens by replacing with empty string", () => {
      const template = "Alert: {{type}} on {{unknownField}}";
      expect(interpolateTemplate(template, { type: "Urgent" })).toBe("Alert: Urgent on ");
    });
  });

  describe("evaluateCondition", () => {
    const record = {
      status: "pending",
      quantity: 5,
      total: 1200,
      tags: ["vip", "express"],
      notes: "Please deliver ASAP",
    };

    it("evaluates string comparisons", () => {
      expect(evaluateCondition(record, { field: "status", operator: "equals", value: "pending" })).toBe(true);
      expect(evaluateCondition(record, { field: "status", operator: "equals", value: "completed" })).toBe(false);
      expect(evaluateCondition(record, { field: "status", operator: "not_equals", value: "completed" })).toBe(true);
      expect(evaluateCondition(record, { field: "notes", operator: "contains", value: "deliver" })).toBe(true);
      expect(evaluateCondition(record, { field: "notes", operator: "starts_with", value: "Please" })).toBe(true);
      expect(evaluateCondition(record, { field: "notes", operator: "ends_with", value: "ASAP" })).toBe(true);
    });

    it("evaluates numeric comparisons", () => {
      expect(evaluateCondition(record, { field: "total", operator: "greater_than", value: 1000 })).toBe(true);
      expect(evaluateCondition(record, { field: "total", operator: "less_than", value: 500 })).toBe(false);
      expect(evaluateCondition(record, { field: "quantity", operator: "less_than_or_equal", value: 5 })).toBe(true);
      expect(evaluateCondition(record, { field: "quantity", operator: "greater_than_or_equal", value: 5 })).toBe(true);
    });

    it("evaluates in, not_in, and emptiness", () => {
      expect(evaluateCondition(record, { field: "status", operator: "in", value: ["pending", "draft"] })).toBe(true);
      expect(evaluateCondition(record, { field: "status", operator: "not_in", value: ["completed", "cancelled"] })).toBe(true);
      expect(evaluateCondition(record, { field: "notes", operator: "is_not_empty" })).toBe(true);
      expect(evaluateCondition(record, { field: "missingField", operator: "is_empty" })).toBe(true);
    });

    it("evaluates changed condition against previousRecord", () => {
      const prev = { status: "draft" };
      expect(evaluateCondition(record, { field: "status", operator: "changed" }, prev)).toBe(true);
      const same = { status: "pending" };
      expect(evaluateCondition(record, { field: "status", operator: "changed" }, same)).toBe(false);
    });
  });

  describe("evaluateRule", () => {
    const rule: NotificationRule = {
      id: "rule-1",
      name: "High Value Order",
      enabled: true,
      resource: "orders",
      event: "create",
      conditions: [
        { field: "total", operator: "greater_than", value: 1000 },
        { field: "status", operator: "equals", value: "paid" },
      ],
      matchAll: true,
      template: {
        title: "High Value Order #{{id}}",
        body: "Received order for ${{total}}",
        severity: "warning",
      },
      channels: [
        { type: "in_app" },
        { type: "email", target: "finance@example.com" },
      ],
    };

    it("returns true when event matches resource, action, and all conditions", () => {
      const event = {
        resource: "orders",
        type: "create",
        data: { id: "ORD-1", total: 2500, status: "paid" },
      };
      expect(evaluateRule(rule, event)).toBe(true);
    });

    it("returns false when condition fails", () => {
      const event = {
        resource: "orders",
        type: "create",
        data: { id: "ORD-2", total: 400, status: "paid" },
      };
      expect(evaluateRule(rule, event)).toBe(false);
    });

    it("returns false when disabled or resource/event mismatches", () => {
      expect(evaluateRule({ ...rule, enabled: false }, { resource: "orders", type: "create", data: { total: 2500, status: "paid" } })).toBe(false);
      expect(evaluateRule(rule, { resource: "customers", type: "create", data: { total: 2500, status: "paid" } })).toBe(false);
      expect(evaluateRule(rule, { resource: "orders", type: "update", data: { total: 2500, status: "paid" } })).toBe(false);
    });

    it("supports OR condition logic with matchAll: false", () => {
      const orRule: NotificationRule = {
        ...rule,
        matchAll: false,
      };
      // Only total matches, status does not
      const event = {
        resource: "orders",
        type: "create",
        data: { id: "ORD-3", total: 1500, status: "unpaid" },
      };
      expect(evaluateRule(orRule, event)).toBe(true);
    });
  });

  describe("renderNotification", () => {
    it("renders formatted title and body with severity", () => {
      const rule: NotificationRule = {
        id: "rule-inventory",
        name: "Low Stock Alert",
        enabled: true,
        resource: "inventory",
        template: {
          title: "Low Stock: {{sku}}",
          body: "Item {{name}} has dropped to {{quantity}} units (Threshold: {{threshold}}).",
          severity: "error",
        },
        channels: [{ type: "in_app" }],
      };

      const event = {
        resource: "inventory",
        type: "update",
        data: { sku: "WIDGET-01", name: "Super Widget", quantity: 2, threshold: 5 },
      };

      const rendered = renderNotification(rule, event);
      expect(rendered.title).toBe("Low Stock: WIDGET-01");
      expect(rendered.body).toBe("Item Super Widget has dropped to 2 units (Threshold: 5).");
      expect(rendered.severity).toBe("error");
    });
  });

  describe("formatRelativeTime", () => {
    it("formats relative timestamps", () => {
      const now = Date.now();
      expect(formatRelativeTime(now - 10000)).toBe("Just now");
      expect(formatRelativeTime(now - 5 * 60 * 1000)).toBe("5m ago");
      expect(formatRelativeTime(now - 3 * 3600 * 1000)).toBe("3h ago");
      expect(formatRelativeTime(now - 25 * 3600 * 1000)).toBe("Yesterday");
      expect(formatRelativeTime(now - 4 * 86400 * 1000)).toBe("4d ago");
    });
  });
});
