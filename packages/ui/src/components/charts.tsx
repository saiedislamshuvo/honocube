import * as React from "react";
import { cn } from "../lib/utils.js";

export const DEFAULT_CHART_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
  "#64748B", // Slate
];

export interface ChartSeries {
  key: string;
  label?: string;
  color?: string;
  strokeWidth?: number;
}

export type ChartDataPoint = Record<string, unknown>;

export interface BaseChartProps {
  data: ChartDataPoint[];
  indexKey: string;
  series: ChartSeries[];
  width?: number | string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  valueFormatter?: (value: number) => string;
  className?: string;
}

export interface LineChartProps extends BaseChartProps {
  curve?: "linear" | "smooth";
  showDots?: boolean;
}

export interface AreaChartProps extends BaseChartProps {
  curve?: "linear" | "smooth";
  showDots?: boolean;
  gradientOpacity?: number;
  stacked?: boolean;
}

export interface BarChartProps extends BaseChartProps {
  layout?: "vertical" | "horizontal";
  stacked?: boolean;
  radius?: number;
}

export interface PieChartItem {
  label: string;
  value: number;
  color?: string;
}

export interface DonutChartProps {
  data: PieChartItem[];
  innerRadiusRatio?: number;
  width?: number;
  height?: number;
  centerLabel?: string;
  centerValue?: string | number;
  showLegend?: boolean;
  showTooltip?: boolean;
  valueFormatter?: (value: number) => string;
  className?: string;
}

export interface SparklineProps {
  data: number[];
  width?: number | string;
  height?: number;
  color?: string;
  type?: "line" | "area";
  strokeWidth?: number;
  showGradient?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helper: Smooth SVG Bezier Path Generator
// ---------------------------------------------------------------------------
function getSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  const first = points[0];
  if (!first) return "";
  if (points.length === 1) return `M ${first.x} ${first.y}`;

  let path = `M ${first.x} ${first.y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    if (!p0 || !p1 || !p2 || !p3) continue;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;

    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return path;
}

function getLinearPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  const first = points[0];
  if (!first) return "";
  return points.reduce(
    (acc, pt, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y}`,
    ""
  );
}

// ---------------------------------------------------------------------------
// Chart Legend Component
// ---------------------------------------------------------------------------
export function ChartLegend({
  series,
  className = "",
}: {
  series: Array<{ label: string; color: string }>;
  className?: string;
}): React.JSX.Element {
  return (
    <div
      data-testid="chart-legend"
      className={cn("flex flex-wrap items-center justify-center gap-4 text-xs mt-3", className)}
    >
      {series.map((s, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: s.color }}
          />
          <span className="text-muted-foreground font-medium">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sparkline Component
// ---------------------------------------------------------------------------
export function Sparkline({
  data,
  width = 120,
  height = 36,
  color = "#3B82F6",
  type = "line",
  strokeWidth = 2,
  showGradient = true,
  className = "",
}: SparklineProps): React.JSX.Element {
  const gradientId = React.useId();
  const validData = Array.isArray(data) && data.length > 0 ? data : [0, 0];

  const min = Math.min(...validData);
  const max = Math.max(...validData);
  const range = max - min || 1;

  const w = 120;
  const h = 40;
  const padding = 2;

  const points = validData.map((val, idx) => {
    const x = padding + (idx / Math.max(1, validData.length - 1)) * (w - 2 * padding);
    const y = h - padding - ((val - min) / range) * (h - 2 * padding);
    return { x, y };
  });

  const linePath = getSmoothPath(points);
  const lastPt = points[points.length - 1] ?? { x: w - padding, y: h - padding };
  const firstPt = points[0] ?? { x: padding, y: h - padding };
  const areaPath = `${linePath} L ${lastPt.x} ${h} L ${firstPt.x} ${h} Z`;

  return (
    <div
      data-testid="sparkline-container"
      className={cn("inline-block overflow-hidden", className)}
      style={{ width, height }}
    >
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </linearGradient>
        </defs>

        {type === "area" && showGradient && (
          <path d={areaPath} fill={`url(#${gradientId})`} />
        )}

        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LineChart Component
// ---------------------------------------------------------------------------
export function LineChart({
  data,
  indexKey,
  series,
  width = "100%",
  height = 280,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  showDots = true,
  curve = "smooth",
  valueFormatter = (v) => v.toLocaleString(),
  className = "",
}: LineChartProps): React.JSX.Element {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);

  const viewWidth = 500;
  const viewHeight = 260;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 35;

  const plotWidth = viewWidth - padLeft - padRight;
  const plotHeight = viewHeight - padTop - padBottom;

  const allValues = data.flatMap((d) =>
    series.map((s) => (typeof d[s.key] === "number" ? (d[s.key] as number) : 0))
  );
  const maxVal = allValues.length > 0 ? Math.max(...allValues, 0) : 100;
  const minVal = allValues.length > 0 ? Math.min(...allValues, 0) : 0;
  const range = maxVal - minVal || 1;

  // Grid steps (4 horizontal lines)
  const gridTicks = [0, 0.33, 0.66, 1].map((pct) => {
    const val = minVal + pct * range;
    const y = padTop + (1 - pct) * plotHeight;
    return { val, y };
  });

  const seriesPoints = series.map((s, sIdx) => {
    const color = s.color || DEFAULT_CHART_COLORS[sIdx % DEFAULT_CHART_COLORS.length] || "#3B82F6";
    const pts = data.map((d, dIdx) => {
      const x = padLeft + (dIdx / Math.max(1, data.length - 1)) * plotWidth;
      const v = typeof d[s.key] === "number" ? (d[s.key] as number) : 0;
      const y = padTop + (1 - (v - minVal) / range) * plotHeight;
      return { x, y, value: v };
    });
    const path = curve === "smooth" ? getSmoothPath(pts) : getLinearPath(pts);
    return { ...s, color, pts, path };
  });

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!containerRef.current || data.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const relativeX = (clientX / rect.width) * viewWidth;
    const plotX = Math.max(0, Math.min(plotWidth, relativeX - padLeft));
    const idx = Math.round((plotX / plotWidth) * (data.length - 1));
    setHoverIndex(idx);
  };

  const handlePointerLeave = () => {
    setHoverIndex(null);
  };

  const activeDataPoint = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div
      ref={containerRef}
      data-testid="line-chart-container"
      className={cn("relative w-full select-none", className)}
      style={{ width, height: typeof height === "number" ? `${height}px` : height }}
    >
      <svg
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        className="w-full h-full overflow-visible"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {/* Horizontal Grid lines */}
        {showGrid &&
          gridTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padLeft}
                y1={tick.y}
                x2={viewWidth - padRight}
                y2={tick.y}
                stroke="currentColor"
                className="text-border"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
              <text
                x={padLeft - 6}
                y={tick.y + 3}
                textAnchor="end"
                className="fill-muted-foreground text-[10px]"
              >
                {valueFormatter(Math.round(tick.val))}
              </text>
            </g>
          ))}

        {/* X Axis Labels */}
        {data.map((d, idx) => {
          const x = padLeft + (idx / Math.max(1, data.length - 1)) * plotWidth;
          const label = String(d[indexKey] ?? "");
          return (
            <text
              key={idx}
              x={x}
              y={viewHeight - padBottom + 16}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {label}
            </text>
          );
        })}

        {/* Series Lines */}
        {seriesPoints.map((s, idx) => (
          <path
            key={idx}
            d={s.path}
            fill="none"
            stroke={s.color}
            strokeWidth={s.strokeWidth ?? 2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Series Dots */}
        {showDots &&
          seriesPoints.map((s, sIdx) =>
            s.pts.map((pt, pIdx) => (
              <circle
                key={`${sIdx}-${pIdx}`}
                cx={pt.x}
                cy={pt.y}
                r={hoverIndex === pIdx ? 5 : 3.5}
                fill={s.color}
                className="stroke-background stroke-2 transition-all"
              />
            ))
          )}

        {/* Hover Crosshair */}
        {hoverIndex !== null && data[hoverIndex] && (
          <line
            x1={padLeft + (hoverIndex / Math.max(1, data.length - 1)) * plotWidth}
            y1={padTop}
            x2={padLeft + (hoverIndex / Math.max(1, data.length - 1)) * plotWidth}
            y2={viewHeight - padBottom}
            stroke="currentColor"
            className="text-muted-foreground"
            strokeDasharray="2 2"
            strokeWidth={1.5}
          />
        )}
      </svg>

      {/* Interactive Tooltip Card */}
      {showTooltip && activeDataPoint && hoverIndex !== null && (
        <div
          data-testid="chart-tooltip"
          className="absolute z-20 pointer-events-none rounded-lg border bg-popover px-3 py-2 text-xs shadow-md animate-in fade-in-0 zoom-in-95"
          style={{
            left: `${((padLeft + (hoverIndex / Math.max(1, data.length - 1)) * plotWidth) / viewWidth) * 100}%`,
            top: "10%",
            transform: "translateX(-50%)",
          }}
        >
          <div className="font-semibold text-popover-foreground mb-1">
            {String(activeDataPoint[indexKey] ?? "")}
          </div>
          <div className="space-y-1">
            {series.map((s, idx) => {
              const val = activeDataPoint[s.key];
              const color = s.color || DEFAULT_CHART_COLORS[idx % DEFAULT_CHART_COLORS.length];
              return (
                <div key={s.key} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-muted-foreground">{s.label || s.key}:</span>
                  </div>
                  <span className="font-medium text-foreground">
                    {typeof val === "number" ? valueFormatter(val) : String(val ?? "-")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <ChartLegend
          series={seriesPoints.map((s) => ({ label: s.label || s.key, color: s.color }))}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AreaChart Component
// ---------------------------------------------------------------------------
export function AreaChart({
  data,
  indexKey,
  series,
  width = "100%",
  height = 280,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  showDots = true,
  curve = "smooth",
  gradientOpacity = 0.35,
  valueFormatter = (v) => v.toLocaleString(),
  className = "",
}: AreaChartProps): React.JSX.Element {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const gradientPrefix = React.useId();

  const viewWidth = 500;
  const viewHeight = 260;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 35;

  const plotWidth = viewWidth - padLeft - padRight;
  const plotHeight = viewHeight - padTop - padBottom;

  const allValues = data.flatMap((d) =>
    series.map((s) => (typeof d[s.key] === "number" ? (d[s.key] as number) : 0))
  );
  const maxVal = allValues.length > 0 ? Math.max(...allValues, 0) : 100;
  const minVal = allValues.length > 0 ? Math.min(...allValues, 0) : 0;
  const range = maxVal - minVal || 1;

  const gridTicks = [0, 0.33, 0.66, 1].map((pct) => {
    const val = minVal + pct * range;
    const y = padTop + (1 - pct) * plotHeight;
    return { val, y };
  });

  const seriesPoints = series.map((s, sIdx) => {
    const color = s.color || DEFAULT_CHART_COLORS[sIdx % DEFAULT_CHART_COLORS.length] || "#3B82F6";
    const pts = data.map((d, dIdx) => {
      const x = padLeft + (dIdx / Math.max(1, data.length - 1)) * plotWidth;
      const v = typeof d[s.key] === "number" ? (d[s.key] as number) : 0;
      const y = padTop + (1 - (v - minVal) / range) * plotHeight;
      return { x, y, value: v };
    });

    const linePath = curve === "smooth" ? getSmoothPath(pts) : getLinearPath(pts);
    const lastPt = pts[pts.length - 1] ?? { x: padLeft + plotWidth, y: padTop + plotHeight };
    const firstPt = pts[0] ?? { x: padLeft, y: padTop + plotHeight };
    const areaPath = `${linePath} L ${lastPt.x} ${padTop + plotHeight} L ${firstPt.x} ${padTop + plotHeight} Z`;

    return { ...s, color, pts, linePath, areaPath, gradientId: `${gradientPrefix}-${sIdx}` };
  });

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!containerRef.current || data.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const relativeX = (clientX / rect.width) * viewWidth;
    const plotX = Math.max(0, Math.min(plotWidth, relativeX - padLeft));
    const idx = Math.round((plotX / plotWidth) * (data.length - 1));
    setHoverIndex(idx);
  };

  const activeDataPoint = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div
      ref={containerRef}
      data-testid="area-chart-container"
      className={cn("relative w-full select-none", className)}
      style={{ width, height: typeof height === "number" ? `${height}px` : height }}
    >
      <svg
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        className="w-full h-full overflow-visible"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <defs>
          {seriesPoints.map((s) => (
            <linearGradient key={s.gradientId} id={s.gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={gradientOpacity} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.0} />
            </linearGradient>
          ))}
        </defs>

        {/* Grid lines */}
        {showGrid &&
          gridTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padLeft}
                y1={tick.y}
                x2={viewWidth - padRight}
                y2={tick.y}
                stroke="currentColor"
                className="text-border"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
              <text
                x={padLeft - 6}
                y={tick.y + 3}
                textAnchor="end"
                className="fill-muted-foreground text-[10px]"
              >
                {valueFormatter(Math.round(tick.val))}
              </text>
            </g>
          ))}

        {/* X Labels */}
        {data.map((d, idx) => {
          const x = padLeft + (idx / Math.max(1, data.length - 1)) * plotWidth;
          return (
            <text
              key={idx}
              x={x}
              y={viewHeight - padBottom + 16}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {String(d[indexKey] ?? "")}
            </text>
          );
        })}

        {/* Area Gradient Fills */}
        {seriesPoints.map((s) => (
          <path key={s.key} d={s.areaPath} fill={`url(#${s.gradientId})`} />
        ))}

        {/* Outlines */}
        {seriesPoints.map((s) => (
          <path
            key={s.key}
            d={s.linePath}
            fill="none"
            stroke={s.color}
            strokeWidth={s.strokeWidth ?? 2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Dots */}
        {showDots &&
          seriesPoints.map((s, sIdx) =>
            s.pts.map((pt, pIdx) => (
              <circle
                key={`${sIdx}-${pIdx}`}
                cx={pt.x}
                cy={pt.y}
                r={hoverIndex === pIdx ? 5 : 3.5}
                fill={s.color}
                className="stroke-background stroke-2 transition-all"
              />
            ))
          )}

        {hoverIndex !== null && data[hoverIndex] && (
          <line
            x1={padLeft + (hoverIndex / Math.max(1, data.length - 1)) * plotWidth}
            y1={padTop}
            x2={padLeft + (hoverIndex / Math.max(1, data.length - 1)) * plotWidth}
            y2={viewHeight - padBottom}
            stroke="currentColor"
            className="text-muted-foreground"
            strokeDasharray="2 2"
            strokeWidth={1.5}
          />
        )}
      </svg>

      {showTooltip && activeDataPoint && hoverIndex !== null && (
        <div
          data-testid="chart-tooltip"
          className="absolute z-20 pointer-events-none rounded-lg border bg-popover px-3 py-2 text-xs shadow-md animate-in fade-in-0 zoom-in-95"
          style={{
            left: `${((padLeft + (hoverIndex / Math.max(1, data.length - 1)) * plotWidth) / viewWidth) * 100}%`,
            top: "10%",
            transform: "translateX(-50%)",
          }}
        >
          <div className="font-semibold text-popover-foreground mb-1">
            {String(activeDataPoint[indexKey] ?? "")}
          </div>
          <div className="space-y-1">
            {series.map((s, idx) => {
              const val = activeDataPoint[s.key];
              const color = s.color || DEFAULT_CHART_COLORS[idx % DEFAULT_CHART_COLORS.length];
              return (
                <div key={s.key} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-muted-foreground">{s.label || s.key}:</span>
                  </div>
                  <span className="font-medium text-foreground">
                    {typeof val === "number" ? valueFormatter(val) : String(val ?? "-")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showLegend && (
        <ChartLegend
          series={seriesPoints.map((s) => ({ label: s.label || s.key, color: s.color }))}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BarChart Component
// ---------------------------------------------------------------------------
export function BarChart({
  data,
  indexKey,
  series,
  width = "100%",
  height = 280,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  radius = 3,
  valueFormatter = (v) => v.toLocaleString(),
  className = "",
}: BarChartProps): React.JSX.Element {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);

  const viewWidth = 500;
  const viewHeight = 260;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 35;

  const plotWidth = viewWidth - padLeft - padRight;
  const plotHeight = viewHeight - padTop - padBottom;

  const allValues = data.flatMap((d) =>
    series.map((s) => (typeof d[s.key] === "number" ? (d[s.key] as number) : 0))
  );
  const maxVal = allValues.length > 0 ? Math.max(...allValues, 0) : 100;
  const minVal = 0;
  const range = maxVal - minVal || 1;

  const gridTicks = [0, 0.33, 0.66, 1].map((pct) => {
    const val = minVal + pct * range;
    const y = padTop + (1 - pct) * plotHeight;
    return { val, y };
  });

  const slotWidth = data.length > 0 ? plotWidth / data.length : 0;
  const groupPadding = slotWidth * 0.15;
  const barWidth = series.length > 0 ? (slotWidth - 2 * groupPadding) / series.length : 0;

  const activeDataPoint = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div
      ref={containerRef}
      data-testid="bar-chart-container"
      className={cn("relative w-full select-none", className)}
      style={{ width, height: typeof height === "number" ? `${height}px` : height }}
    >
      <svg
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        className="w-full h-full overflow-visible"
        onPointerLeave={() => setHoverIndex(null)}
      >
        {/* Grid lines */}
        {showGrid &&
          gridTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padLeft}
                y1={tick.y}
                x2={viewWidth - padRight}
                y2={tick.y}
                stroke="currentColor"
                className="text-border"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
              <text
                x={padLeft - 6}
                y={tick.y + 3}
                textAnchor="end"
                className="fill-muted-foreground text-[10px]"
              >
                {valueFormatter(Math.round(tick.val))}
              </text>
            </g>
          ))}

        {/* Bars */}
        {data.map((d, dIdx) => {
          const slotX = padLeft + dIdx * slotWidth;
          const isHovered = hoverIndex === dIdx;

          return (
            <g
              key={dIdx}
              onPointerEnter={() => setHoverIndex(dIdx)}
              className="cursor-pointer"
            >
              {series.map((s, sIdx) => {
                const color =
                  s.color || DEFAULT_CHART_COLORS[sIdx % DEFAULT_CHART_COLORS.length] || "#3B82F6";
                const val = typeof d[s.key] === "number" ? (d[s.key] as number) : 0;
                const bHeight = ((val - minVal) / range) * plotHeight;
                const bx = slotX + groupPadding + sIdx * barWidth;
                const by = padTop + plotHeight - bHeight;

                return (
                  <rect
                    key={s.key}
                    x={bx}
                    y={by}
                    width={Math.max(1, barWidth * 0.9)}
                    height={Math.max(1, bHeight)}
                    rx={radius}
                    fill={color}
                    className={cn(
                      "transition-opacity",
                      isHovered ? "opacity-100" : hoverIndex !== null ? "opacity-60" : "opacity-90"
                    )}
                  />
                );
              })}

              {/* X Axis Label */}
              <text
                x={slotX + slotWidth / 2}
                y={viewHeight - padBottom + 16}
                textAnchor="middle"
                className={cn(
                  "text-[10px] transition-colors",
                  isHovered ? "fill-foreground font-semibold" : "fill-muted-foreground"
                )}
              >
                {String(d[indexKey] ?? "")}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {showTooltip && activeDataPoint && hoverIndex !== null && (
        <div
          data-testid="chart-tooltip"
          className="absolute z-20 pointer-events-none rounded-lg border bg-popover px-3 py-2 text-xs shadow-md animate-in fade-in-0 zoom-in-95"
          style={{
            left: `${((padLeft + hoverIndex * slotWidth + slotWidth / 2) / viewWidth) * 100}%`,
            top: "10%",
            transform: "translateX(-50%)",
          }}
        >
          <div className="font-semibold text-popover-foreground mb-1">
            {String(activeDataPoint[indexKey] ?? "")}
          </div>
          <div className="space-y-1">
            {series.map((s, idx) => {
              const val = activeDataPoint[s.key];
              const color = s.color || DEFAULT_CHART_COLORS[idx % DEFAULT_CHART_COLORS.length];
              return (
                <div key={s.key} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-muted-foreground">{s.label || s.key}:</span>
                  </div>
                  <span className="font-medium text-foreground">
                    {typeof val === "number" ? valueFormatter(val) : String(val ?? "-")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showLegend && (
        <ChartLegend
          series={series.map((s, idx) => ({
            label: s.label || s.key,
            color: s.color || DEFAULT_CHART_COLORS[idx % DEFAULT_CHART_COLORS.length] || "#3B82F6",
          }))}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DonutChart / PieChart Component
// ---------------------------------------------------------------------------
export function DonutChart({
  data,
  innerRadiusRatio = 0.65,
  width = 240,
  height = 240,
  centerLabel,
  centerValue,
  showLegend = true,
  showTooltip = true,
  valueFormatter = (v) => v.toLocaleString(),
  className = "",
}: DonutChartProps): React.JSX.Element {
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);

  const cx = 120;
  const cy = 120;
  const outerR = 95;
  const innerR = outerR * Math.max(0, Math.min(0.9, innerRadiusRatio));

  const total = data.reduce((acc, d) => acc + (d.value > 0 ? d.value : 0), 0) || 1;

  let currentAngle = -Math.PI / 2;

  const slices = data.map((item, idx) => {
    const fraction = item.value > 0 ? item.value / total : 0;
    const angle = fraction * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const color = item.color || DEFAULT_CHART_COLORS[idx % DEFAULT_CHART_COLORS.length] || "#3B82F6";

    // Handle full circle
    if (fraction >= 0.999) {
      return {
        ...item,
        color,
        isFull: true,
        pathData: "",
        fraction,
      };
    }

    const x1 = cx + outerR * Math.cos(startAngle);
    const y1 = cy + outerR * Math.sin(startAngle);
    const x2 = cx + outerR * Math.cos(endAngle);
    const y2 = cy + outerR * Math.sin(endAngle);

    const x3 = cx + innerR * Math.cos(endAngle);
    const y3 = cy + innerR * Math.sin(endAngle);
    const x4 = cx + innerR * Math.cos(startAngle);
    const y4 = cy + innerR * Math.sin(startAngle);

    const largeArc = angle > Math.PI ? 1 : 0;

    const pathData =
      innerR > 0
        ? `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`
        : `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${cx} ${cy} Z`;

    return {
      ...item,
      color,
      pathData,
      isFull: false,
      fraction,
    };
  });

  const activeSlice = hoverIndex !== null ? slices[hoverIndex] : null;

  return (
    <div
      data-testid="donut-chart-container"
      className={cn("relative flex flex-col items-center justify-center select-none", className)}
    >
      <div style={{ width: `${width}px`, height: `${height}px` }} className="relative">
        <svg viewBox="0 0 240 240" className="w-full h-full overflow-visible">
          {slices.map((slice, idx) => {
            const isHovered = hoverIndex === idx;

            if (slice.isFull) {
              return (
                <circle
                  key={idx}
                  cx={cx}
                  cy={cy}
                  r={(outerR + innerR) / 2}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={outerR - innerR}
                  onPointerEnter={() => setHoverIndex(idx)}
                  onPointerLeave={() => setHoverIndex(null)}
                  className="cursor-pointer transition-opacity"
                />
              );
            }

            return (
              <path
                key={idx}
                d={slice.pathData}
                fill={slice.color}
                onPointerEnter={() => setHoverIndex(idx)}
                onPointerLeave={() => setHoverIndex(null)}
                className={cn(
                  "cursor-pointer transition-all",
                  isHovered ? "opacity-100 scale-[1.03] origin-center" : hoverIndex !== null ? "opacity-60" : "opacity-95"
                )}
              />
            );
          })}

          {/* Center Label and Value (Donut mode) */}
          {innerRadiusRatio > 0 && (
            <g className="pointer-events-none">
              {centerLabel && (
                <text
                  x={cx}
                  y={centerValue !== undefined ? cy - 8 : cy + 4}
                  textAnchor="middle"
                  className="fill-muted-foreground text-xs font-medium"
                >
                  {centerLabel}
                </text>
              )}
              {centerValue !== undefined && (
                <text
                  x={cx}
                  y={centerLabel ? cy + 14 : cy + 6}
                  textAnchor="middle"
                  className="fill-foreground text-xl font-bold tracking-tight"
                >
                  {String(centerValue)}
                </text>
              )}
            </g>
          )}
        </svg>

        {/* Hover Tooltip */}
        {showTooltip && activeSlice && (
          <div
            data-testid="chart-tooltip"
            className="absolute z-20 pointer-events-none rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-in fade-in-0"
          >
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: activeSlice.color }} />
              <span>{activeSlice.label}</span>
            </div>
            <div className="text-muted-foreground font-semibold mt-0.5">
              {valueFormatter(activeSlice.value)} ({Math.round((activeSlice.value / total) * 100)}%)
            </div>
          </div>
        )}
      </div>

      {showLegend && (
        <ChartLegend
          series={slices.map((s) => ({ label: s.label, color: s.color }))}
        />
      )}
    </div>
  );
}
