import React, { useMemo } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { Badge } from "@honocube/ui";
import type { Collection, InferRecord } from "../types/collection.js";
import { useCollectionQuery } from "../query/use-query.js";
import { formatCellValue } from "../utils/format.js";
import type { ListViewProps } from "./types.js";

export function ListView<TCollection extends Collection<any>>({
  collection,
  titleField: propTitleField,
  subtitleField: propSubtitleField,
  metaField: propMetaField,
  badgeField: propBadgeField,
  onItemClick,
  className = "",
  emptyText = "No items found.",
}: ListViewProps<TCollection>): React.JSX.Element {
  const queryResult = useCollectionQuery({
    collection,
    params: { limit: 100 },
  });

  const records: InferRecord<TCollection>[] = useMemo(() => {
    const data = queryResult.data?.data;
    return Array.isArray(data) ? (data as InferRecord<TCollection>[]) : [];
  }, [queryResult.data]);

  const listConfig = collection.list;
  const titleField = String(propTitleField || listConfig?.title || "title");
  const subtitleField = propSubtitleField || listConfig?.subtitle || "subtitle";
  const metaField = propMetaField || listConfig?.meta || "createdAt";
  const badgeField = propBadgeField || listConfig?.badge || "status";

  return (
    <div className={`space-y-4 ${className}`}>
      {queryResult.isLoading && records.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mb-2" />
          <span className="text-sm">Loading list...</span>
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground border rounded-lg bg-card">
          <p className="font-medium text-foreground">{emptyText}</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card divide-y overflow-hidden shadow-sm">
          {records.map((record: any) => {
            const rawTitle = record[titleField] ?? record.name ?? record.id;
            const title = String(rawTitle ?? "");
            const subtitle = subtitleField && record[subtitleField] ? String(record[subtitleField]) : undefined;
            const metaVal = metaField && record[metaField] !== undefined
              ? formatCellValue(record[metaField], collection.getField(metaField))
              : undefined;
            const badgeVal = badgeField && record[badgeField] ? String(record[badgeField]) : undefined;

            const initials = title
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() || "HC";

            return (
              <div
                key={record.id}
                onClick={() => onItemClick?.(record)}
                className={`flex items-center justify-between p-4 transition-colors ${
                  onItemClick ? "hover:bg-muted/50 cursor-pointer" : ""
                }`}
              >
                {/* Left: Avatar & Text Details */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate text-foreground">
                      {title}
                    </p>
                    {subtitle && (
                      <p className="text-xs text-muted-foreground truncate">
                        {subtitle}
                      </p>
                    )}
                    {metaVal && (
                      <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                        {metaVal}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Badge & Chevron */}
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  {badgeVal && (
                    <Badge variant="outline" className="text-xs capitalize font-normal">
                      {badgeVal}
                    </Badge>
                  )}
                  {onItemClick && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
