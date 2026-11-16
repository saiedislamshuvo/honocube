import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import {
  MetricCard,
  AnalyticsChartCard,
  LineChart,
} from "../src/index.js";

describe("Dashboard Analytics Cards (Issue #131)", () => {
  describe("MetricCard", () => {
    it("renders metric title, value, and positive trend badge", () => {
      const html = renderToString(
        <MetricCard
          title="Total Revenue"
          value="$128,450"
          trend={{ value: "+14.2%", direction: "up", label: "vs last month" }}
          sparklineData={[100, 110, 105, 120, 135, 150]}
        />
      );

      expect(html).toContain("data-testid=\"metric-card\"");
      expect(html).toContain("Total Revenue");
      expect(html).toContain("$128,450");
      expect(html).toContain("data-testid=\"metric-card-trend\"");
      expect(html).toContain("+14.2%");
      expect(html).toContain("vs last month");
      expect(html).toContain("data-testid=\"metric-card-sparkline\"");
    });

    it("renders negative trend badge with down direction", () => {
      const html = renderToString(
        <MetricCard
          title="Churn Rate"
          value="4.2%"
          trend={{ value: "-0.8%", direction: "down" }}
        />
      );

      expect(html).toContain("data-testid=\"metric-card\"");
      expect(html).toContain("Churn Rate");
      expect(html).toContain("4.2%");
      expect(html).toContain("-0.8%");
    });
  });

  describe("AnalyticsChartCard", () => {
    it("renders chart card container with time-range filtering controls", () => {
      const html = renderToString(
        <AnalyticsChartCard
          title="Revenue Growth"
          description="Gross revenue over selected timeframe"
          timeRange="30d"
          onTimeRangeChange={vi.fn()}
        >
          <LineChart
            data={[
              { date: "W1", rev: 100 },
              { date: "W2", rev: 150 },
            ]}
            indexKey="date"
            series={[{ key: "rev", label: "Revenue" }]}
          />
        </AnalyticsChartCard>
      );

      expect(html).toContain("data-testid=\"analytics-chart-card\"");
      expect(html).toContain("Revenue Growth");
      expect(html).toContain("Gross revenue over selected timeframe");
      expect(html).toContain("data-testid=\"analytics-time-ranges\"");
      expect(html).toContain("data-testid=\"time-range-7d\"");
      expect(html).toContain("data-testid=\"time-range-30d\"");
      expect(html).toContain("data-testid=\"line-chart-container\"");
    });
  });
});
