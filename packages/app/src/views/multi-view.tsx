import React, { useState, useMemo } from "react";
import type { Collection } from "../types/collection.js";
import type { ViewType } from "../types/views.js";
import { ViewSwitcher } from "./view-switcher.js";
import { TableView } from "./table-view.js";
import { KanbanView } from "./kanban-view.js";
import { CalendarView } from "./calendar-view.js";
import { ListView } from "./list-view.js";
import { GridView } from "./grid-view.js";
import { useAppTheme } from "../theme/theme-provider.js";
import type { CollectionMultiViewProps } from "./types.js";

export function CollectionMultiView<TCollection extends Collection<any>>({
  collection,
  defaultView,
  availableViews: propAvailableViews,
  onRecordClick,
  actions,
  className = "",
}: CollectionMultiViewProps<TCollection>): React.JSX.Element {
  // 1. Resolve available views from collection configuration
  const resolvedAvailableViews: ViewType[] = useMemo(() => {
    if (propAvailableViews && propAvailableViews.length > 0) {
      return propAvailableViews;
    }

    const views: ViewType[] = ["table"];
    if (collection.kanban) views.push("kanban");
    if (collection.calendar) views.push("calendar");
    if (collection.list) views.push("list");
    if (collection.grid) views.push("grid");

    return views;
  }, [collection, propAvailableViews]);

  // 2. Active View State
  const initialView =
    defaultView ||
    collection.defaultView ||
    (resolvedAvailableViews.includes("table") ? "table" : resolvedAvailableViews[0] || "table");

  const [activeView, setActiveView] = useState<ViewType>(initialView);

  const appTheme = useAppTheme();
  const TableComponent = appTheme?.components?.views?.table || TableView;
  const KanbanComponent = appTheme?.components?.views?.kanban || KanbanView;
  const CalendarComponent = appTheme?.components?.views?.calendar || CalendarView;
  const ListComponent = appTheme?.components?.views?.list || ListView;
  const GridComponent = appTheme?.components?.views?.grid || GridView;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 1. Header Toolbar with Title, ViewSwitcher & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {collection.label || "Records"}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {resolvedAvailableViews.length > 1 && (
            <ViewSwitcher
              activeView={activeView}
              onViewChange={setActiveView}
              availableViews={resolvedAvailableViews}
            />
          )}

          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>

      {/* 2. Active View Content */}
      {(() => {
        const handleRecordClick = onRecordClick ? (rec: any) => onRecordClick(rec) : undefined;
        switch (activeView) {
          case "kanban":
            return (
              <KanbanComponent
                collection={collection}
                onCardClick={handleRecordClick}
              />
            );

          case "calendar":
            return (
              <CalendarComponent
                collection={collection}
                onEventClick={handleRecordClick}
              />
            );

          case "list":
            return (
              <ListComponent
                collection={collection}
                onItemClick={handleRecordClick}
              />
            );

          case "grid":
            return (
              <GridComponent
                collection={collection}
                onCardClick={handleRecordClick}
              />
            );

          case "table":
          default:
            return (
              <TableComponent
                collection={collection}
                onRowClick={handleRecordClick}
              />
            );
        }
      })()}
    </div>
  );
}
