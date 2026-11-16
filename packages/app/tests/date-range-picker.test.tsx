import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  defineApp,
  defineCollection,
  AppProvider,
  FormView,
  f,
  DateRangePicker,
  DATE_RANGE_PRESETS,
  parseDateRange,
} from "../src/index.js";

describe("Date Range and DateTime Range Picker with Presets", () => {
  describe("Field Builder f.dateRange()", () => {
    it("creates default dateRange field configuration", () => {
      const field = f.dateRange("Booking Window").build();
      expect(field.type).toBe("daterange");
      expect(field.label).toBe("Booking Window");
      expect(field.presets).toBe(true);
    });

    it("configures includeTime, format, and custom presets", () => {
      const field = f
        .dateRange("Billing Interval")
        .includeTime(true)
        .format("YYYY-MM-DD HH:mm")
        .presets(["Today", "Last 7 Days", "This Month"])
        .required()
        .build();

      expect(field.type).toBe("daterange");
      expect(field.label).toBe("Billing Interval");
      expect(field.includeTime).toBe(true);
      expect(field.format).toBe("YYYY-MM-DD HH:mm");
      expect(field.presets).toEqual(["Today", "Last 7 Days", "This Month"]);
      expect(field.required).toBe(true);
    });
  });

  describe("parseDateRange utility", () => {
    it("handles null and undefined values", () => {
      expect(parseDateRange(null)).toEqual({});
      expect(parseDateRange(undefined)).toEqual({});
      expect(parseDateRange("")).toEqual({});
    });

    it("parses object values with strings or Date instances", () => {
      const parsed = parseDateRange({
        from: "2026-01-01",
        to: "2026-01-15",
      });
      expect(parsed.from).toBeInstanceOf(Date);
      expect(parsed.to).toBeInstanceOf(Date);
      expect(parsed.from?.getFullYear()).toBe(2026);
      expect(parsed.to?.getFullYear()).toBe(2026);
    });

    it("parses JSON string serialized ranges", () => {
      const jsonStr = JSON.stringify({ from: "2026-05-01", to: "2026-05-31" });
      const parsed = parseDateRange(jsonStr);
      expect(parsed.from).toBeInstanceOf(Date);
      expect(parsed.to).toBeInstanceOf(Date);
    });

    it("parses 'from to to' and comma separated strings", () => {
      const parsedFromTo = parseDateRange("2026-03-01 to 2026-03-10");
      expect(parsedFromTo.from).toBeInstanceOf(Date);
      expect(parsedFromTo.to).toBeInstanceOf(Date);

      const parsedComma = parseDateRange("2026-04-01,2026-04-30");
      expect(parsedComma.from).toBeInstanceOf(Date);
      expect(parsedComma.to).toBeInstanceOf(Date);
    });
  });

  describe("DATE_RANGE_PRESETS presets definition", () => {
    it("contains all standard business enterprise presets", () => {
      const labels = DATE_RANGE_PRESETS.map((p) => p.label);
      expect(labels).toContain("Today");
      expect(labels).toContain("Yesterday");
      expect(labels).toContain("Last 7 Days");
      expect(labels).toContain("Last 30 Days");
      expect(labels).toContain("This Month");
      expect(labels).toContain("Last Month");
      expect(labels).toContain("This Quarter");
      expect(labels).toContain("Year to Date");
    });

    it("evaluates presets into valid chronological dates (from <= to)", () => {
      for (const preset of DATE_RANGE_PRESETS) {
        const { from, to } = preset.getValue();
        expect(from).toBeInstanceOf(Date);
        expect(to).toBeInstanceOf(Date);
        expect(from.getTime()).toBeLessThanOrEqual(to.getTime());
      }
    });
  });

  describe("DateRangePicker Component", () => {
    it("renders empty state placeholder", () => {
      const html = renderToString(
        <DateRangePicker
          name="dateRange"
          placeholder="Choose booking range"
          onChange={vi.fn()}
        />
      );
      expect(html).toContain("Choose booking range");
    });

    it("renders formatted dates and clear button when range is selected", () => {
      const html = renderToString(
        <DateRangePicker
          name="dateRange"
          value={{ from: "2026-06-01", to: "2026-06-15" }}
          onChange={vi.fn()}
        />
      );
      expect(html).toContain("2026-06-01");
      expect(html).toContain("2026-06-15");
      expect(html).toContain("date-range-clear-btn");
    });

    it("renders disabled state and hides clear button", () => {
      const html = renderToString(
        <DateRangePicker
          name="dateRange"
          value={{ from: "2026-06-01", to: "2026-06-15" }}
          disabled
          onChange={vi.fn()}
        />
      );
      expect(html).toContain("disabled");
      expect(html).not.toContain("date-range-clear-btn");
    });

    it("renders error styling when hasError is true", () => {
      const html = renderToString(
        <DateRangePicker
          name="dateRange"
          hasError
          onChange={vi.fn()}
        />
      );
      expect(html).toContain("border-destructive");
    });
  });

  describe("FormView Integration", () => {
    it("renders daterange field inside FormView", () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      const auditLog = defineCollection({
        name: "audit_logs",
        fields: {
          period: f.dateRange("Audit Interval").presets(true),
        },
      });

      const app = defineApp({
        title: "Test App",
        apiBaseUrl: "http://localhost:3000/api",
        collections: [auditLog],
      });

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <AppProvider app={app}>
            <FormView
              collection={auditLog}
              initialValues={{
                period: { from: "2026-01-01", to: "2026-01-31" },
              }}
            />
          </AppProvider>
        </QueryClientProvider>
      );

      expect(html).toContain("Audit Interval");
      expect(html).toContain("2026-01-01");
      expect(html).toContain("2026-01-31");
    });
  });
});
