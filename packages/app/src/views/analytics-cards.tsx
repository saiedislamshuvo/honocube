import * as React from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Sparkline,
  cn,
} from "@honocube/ui";
import type { AnalyticsChartCardProps, MetricCardProps } from "@honocube/core";

/**
 * Metric summary KPI card displaying a primary metric value, optional trend percentage,
 * and compact embedded sparkline micro-chart.
 */
export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  sparklineData,
  sparklineColor,
  icon,
  className = "",
}: MetricCardProps): React.JSX.Element {
  const isPositive = trend?.direction === "up";
  const isNegative = trend?.direction === "down";

  const resolvedColor =
    sparklineColor ||
    (isPositive ? "#10B981" : isNegative ? "#EF4444" : "#3B82F6");

  return (
    <Card
      data-testid="metric-card"
      className={cn("overflow-hidden shadow-sm hover:border-primary/40 transition-colors", className)}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
            {icon}
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="flex items-baseline justify-between gap-2">
          <div
            data-testid="metric-card-value"
            className="text-2xl font-bold tracking-tight text-foreground"
          >
            {value}
          </div>

          {sparklineData && sparklineData.length > 0 && (
            <div className="shrink-0" data-testid="metric-card-sparkline">
              <Sparkline
                data={sparklineData}
                color={resolvedColor}
                type="area"
                width={80}
                height={28}
              />
            </div>
          )}
        </div>

        {(trend || subtitle) && (
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            {trend && (
              <Badge
                variant="outline"
                data-testid="metric-card-trend"
                className={cn(
                  "gap-1 px-1.5 py-0.5 text-[11px] font-semibold border-0",
                  isPositive && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
                  isNegative && "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
                  !isPositive && !isNegative && "bg-muted text-muted-foreground"
                )}
              >
                {isPositive && <TrendingUp className="h-3 w-3" />}
                {isNegative && <TrendingDown className="h-3 w-3" />}
                {!isPositive && !isNegative && <Minus className="h-3 w-3" />}
                <span>{trend.value}</span>
              </Badge>
            )}

            {(trend?.label || subtitle) && (
              <span className="text-muted-foreground truncate">
                {trend?.label || subtitle}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Composite container card housing visual analytics charts (Area, Bar, Line, Donut)
 * with time-range filtering controls and contextual metadata.
 */
export function AnalyticsChartCard({
  title,
  description,
  children,
  actions,
  timeRange,
  onTimeRangeChange,
  timeRangeOptions = [
    { label: "7D", value: "7d" },
    { label: "30D", value: "30d" },
    { label: "90D", value: "90d" },
    { label: "1Y", value: "1y" },
  ],
  className = "",
}: AnalyticsChartCardProps): React.JSX.Element {
  return (
    <Card
      data-testid="analytics-chart-card"
      className={cn("shadow-sm overflow-hidden", className)}
    >
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 gap-2">
        <div>
          <CardTitle className="text-base font-semibold text-foreground">
            {title}
          </CardTitle>
          {description && (
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              {description}
            </CardDescription>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onTimeRangeChange && timeRangeOptions.length > 0 && (
            <div
              data-testid="analytics-time-ranges"
              className="flex items-center rounded-md border bg-muted/40 p-0.5 text-xs"
            >
              {timeRangeOptions.map((opt) => {
                const isSelected = opt.value === timeRange;
                return (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={isSelected ? "secondary" : "ghost"}
                    size="sm"
                    data-testid={`time-range-${opt.value}`}
                    onClick={() => onTimeRangeChange(opt.value)}
                    className={cn(
                      "h-6 px-2 text-[11px] font-medium rounded-sm shadow-none",
                      isSelected
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </Button>
                );
              })}
            </div>
          )}

          {actions}
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-4">{children}</CardContent>
    </Card>
  );
}
