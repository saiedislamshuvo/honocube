import React from "react";
import { Table2, Columns3, Calendar, List, LayoutGrid } from "lucide-react";
import { Button } from "@honocube/ui";
import type { ViewType } from "../types/views.js";
import type { ViewSwitcherProps } from "./types.js";

const VIEW_CONFIGS: Record<ViewType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  table: { label: "Table", icon: Table2 },
  kanban: { label: "Kanban", icon: Columns3 },
  calendar: { label: "Calendar", icon: Calendar },
  list: { label: "List", icon: List },
  grid: { label: "Grid", icon: LayoutGrid },
  gantt: { label: "Gantt", icon: Calendar },
  tree: { label: "Tree", icon: List },
};

export function ViewSwitcher({
  activeView,
  onViewChange,
  availableViews = ["table", "kanban", "calendar", "list", "grid"],
  className = "",
}: ViewSwitcherProps): React.JSX.Element {
  return (
    <div
      role="tablist"
      aria-label="View Switcher"
      className={`inline-flex items-center rounded-lg border bg-muted/60 p-1 text-muted-foreground ${className}`}
    >
      {availableViews.map((viewKey) => {
        const config = VIEW_CONFIGS[viewKey] || { label: viewKey, icon: Table2 };
        const Icon = config.icon;
        const isActive = activeView === viewKey;

        return (
          <Button
            key={viewKey}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={`${config.label} view`}
            variant={isActive ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewChange(viewKey)}
            className={`h-7 px-2.5 text-xs gap-1.5 transition-all ${
              isActive
                ? "bg-background text-foreground shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{config.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
