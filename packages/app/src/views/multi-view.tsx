import React, { useState, useMemo } from "react";
import type { Collection } from "../types/collection.js";
import type { ViewType } from "../types/views.js";
import { ViewSwitcher } from "./view-switcher.js";
import { TableView } from "./table-view.js";
import { KanbanView } from "./kanban-view.js";
import { CalendarView } from "./calendar-view.js";
import { ListView } from "./list-view.js";
import { GridView } from "./grid-view.js";
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
        switch (activeView) {
          case "kanban":
            return (
              <KanbanView
                collection={collection}
                onCardClick={onRecordClick}
              />
            );

          case "calendar":
            return (
              <CalendarView
                collection={collection}
                onEventClick={onRecordClick}
              />
            );

          case "list":
            return (
              <ListView
                collection={collection}
                onItemClick={onRecordClick}
              />
            );

          case "grid":
            return (
              <GridView
                collection={collection}
                onCardClick={onRecordClick}
              />
            );

          case "table":
          default:
            return (
              <TableView
                collection={collection}
                onRowClick={onRecordClick}
              />
            );
        }
      })()}
    </div>
  );
}
