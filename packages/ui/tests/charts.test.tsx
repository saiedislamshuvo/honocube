import React from "react";
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  Sparkline,
  LineChart,
  AreaChart,
  BarChart,
  DonutChart,
  ChartLegend,
  DEFAULT_CHART_COLORS,
} from "../src/index.js";

describe("Interactive Analytics Chart Components (Issue #131)", () => {
  const sampleTimeData = [
    { month: "Jan", revenue: 12000, expenses: 8000 },
    { month: "Feb", revenue: 15000, expenses: 9500 },
    { month: "Mar", revenue: 18000, expenses: 11000 },
    { month: "Apr", revenue: 22000, expenses: 13000 },
  ];

  const sampleSeries = [
    { key: "revenue", label: "Gross Revenue", color: "#3B82F6" },
    { key: "expenses", label: "Operating Expenses", color: "#EF4444" },
  ];

  const sampleDistribution = [
    { label: "Active", value: 65, color: "#10B981" },
    { label: "Pending", value: 25, color: "#F59E0B" },
    { label: "Suspended", value: 10, color: "#EF4444" },
  ];

  describe("Sparkline", () => {
    it("renders compact micro-chart with SVG paths", () => {
      const html = renderToString(
        <Sparkline data={[10, 25, 18, 30, 45, 60]} color="#10B981" />
      );

      expect(html).toContain("data-testid=\"sparkline-container\"");
      expect(html).toContain("<svg");
      expect(html).toContain("stroke=\"#10B981\"");
      expect(html).toContain("fill=\"none\"");
    });

    it("renders area variant with gradient fill", () => {
      const html = renderToString(
        <Sparkline
          data={[5, 12, 8, 20, 35]}
          type="area"
          showGradient={true}
          color="#8B5CF6"
        />
      );

      expect(html).toContain("data-testid=\"sparkline-container\"");
      expect(html).toContain("<linearGradient");
      expect(html).toContain("stop-color=\"#8B5CF6\"");
    });
  });

  describe("LineChart", () => {
    it("renders line chart with axes, series lines, and data points", () => {
      const html = renderToString(
        <LineChart
          data={sampleTimeData}
          indexKey="month"
          series={sampleSeries}
          showDots={true}
          showGrid={true}
        />
      );

      expect(html).toContain("data-testid=\"line-chart-container\"");
      expect(html).toContain("Jan");
      expect(html).toContain("Apr");
      expect(html).toContain("stroke=\"#3B82F6\"");
      expect(html).toContain("stroke=\"#EF4444\"");
      expect(html).toContain("data-testid=\"chart-legend\"");
      expect(html).toContain("Gross Revenue");
      expect(html).toContain("Operating Expenses");
    });
  });

  describe("AreaChart", () => {
    it("renders area chart with gradient fills and smooth outlines", () => {
      const html = renderToString(
        <AreaChart
          data={sampleTimeData}
          indexKey="month"
          series={sampleSeries}
          gradientOpacity={0.4}
        />
      );

      expect(html).toContain("data-testid=\"area-chart-container\"");
      expect(html).toContain("<linearGradient");
      expect(html).toContain("Gross Revenue");
      expect(html).toContain("Operating Expenses");
    });
  });

  describe("BarChart", () => {
    it("renders categorical bars with grid and legend", () => {
      const html = renderToString(
        <BarChart
          data={sampleTimeData}
          indexKey="month"
          series={sampleSeries}
          radius={4}
        />
      );

      expect(html).toContain("data-testid=\"bar-chart-container\"");
      expect(html).toContain("<rect");
      expect(html).toContain("rx=\"4\"");
      expect(html).toContain("Jan");
      expect(html).toContain("Gross Revenue");
    });
  });

  describe("DonutChart & PieChart", () => {
    it("renders circular slice distribution with center metrics", () => {
      const html = renderToString(
        <DonutChart
          data={sampleDistribution}
          centerLabel="Total Users"
          centerValue="100%"
        />
      );

      expect(html).toContain("data-testid=\"donut-chart-container\"");
      expect(html).toContain("<svg");
      expect(html).toContain("Total Users");
      expect(html).toContain("100%");
      expect(html).toContain("Active");
      expect(html).toContain("Pending");
    });
  });

  describe("ChartLegend & Palettes", () => {
    it("renders legend items with color indicators", () => {
      const html = renderToString(
        <ChartLegend
          series={[
            { label: "Series A", color: "#3B82F6" },
            { label: "Series B", color: "#10B981" },
          ]}
        />
      );

      expect(html).toContain("data-testid=\"chart-legend\"");
      expect(html).toContain("Series A");
      expect(html).toContain("Series B");
      expect(html).toContain("background-color:#3B82F6");
    });

    it("provides modern DEFAULT_CHART_COLORS matching HonoCube tokens", () => {
      expect(DEFAULT_CHART_COLORS.length).toBeGreaterThanOrEqual(6);
      expect(DEFAULT_CHART_COLORS).toContain("#3B82F6");
      expect(DEFAULT_CHART_COLORS).toContain("#10B981");
    });
  });
});
