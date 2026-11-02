import React, { useMemo } from "react";
import { Loader2 } from "lucide-react";
import {
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@honocube/ui";
import type { Collection, InferRecord } from "../types/collection.js";
import { useCollectionQuery } from "../query/use-query.js";
import type { GridViewProps } from "./types.js";

export function GridView<TCollection extends Collection<any>>({
  collection,
  titleField: propTitleField,
  subtitleField: propSubtitleField,
  bodyField: propBodyField,
  badgeField: propBadgeField,
  imageField: propImageField,
  columns = 3,
  onCardClick,
  className = "",
  emptyText = "No items to display.",
}: GridViewProps<TCollection>): React.JSX.Element {
  const queryResult = useCollectionQuery({
    collection,
    params: { limit: 100 },
  });

  const records: InferRecord<TCollection>[] = useMemo(() => {
    const data = queryResult.data?.data;
    return Array.isArray(data) ? (data as InferRecord<TCollection>[]) : [];
  }, [queryResult.data]);

  const gridConfig = collection.grid;
  const titleField = String(propTitleField || gridConfig?.title || "title");
  const subtitleField = propSubtitleField || gridConfig?.subtitle || "subtitle";
  const bodyField = propBodyField || gridConfig?.body || "description";
  const badgeField = propBadgeField || gridConfig?.badge || "status";
  const imageField = propImageField || gridConfig?.image || "image";

  const getGridColsClass = (cols: number) => {
    if (cols === 2) return "grid-cols-1 sm:grid-cols-2";
    if (cols === 4) return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
    return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {queryResult.isLoading && records.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mb-2" />
          <span className="text-sm">Loading cards...</span>
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground border rounded-lg bg-card">
          <p className="font-medium text-foreground">{emptyText}</p>
        </div>
      ) : (
        <div className={`grid gap-4 ${getGridColsClass(columns)}`}>
          {records.map((record: any) => {
            const rawTitle = record[titleField] ?? record.name ?? record.id;
            const title = String(rawTitle ?? "");
            const subtitle = subtitleField && record[subtitleField] ? String(record[subtitleField]) : undefined;
            const body = bodyField && record[bodyField] ? String(record[bodyField]) : undefined;
            const badgeVal = badgeField && record[badgeField] ? String(record[badgeField]) : undefined;
            const imageSrc = imageField && record[imageField] ? String(record[imageField]) : undefined;

            return (
              <Card
                key={record.id}
                onClick={() => onCardClick?.(record)}
                className={`flex flex-col justify-between overflow-hidden transition-all duration-200 ${
                  onCardClick ? "hover:shadow-md cursor-pointer hover:border-primary/50" : ""
                }`}
              >
                {/* Optional Card Image / Banner */}
                {imageSrc && (
                  <div className="relative h-40 w-full overflow-hidden bg-muted">
                    <img
                      src={imageSrc}
                      alt={title}
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  </div>
                )}

                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold line-clamp-1">
                      {title}
                    </CardTitle>
                    {badgeVal && (
                      <Badge variant="outline" className="text-xs capitalize font-normal flex-shrink-0">
                        {badgeVal}
                      </Badge>
                    )}
                  </div>
                  {subtitle && (
                    <CardDescription className="text-xs line-clamp-1">
                      {subtitle}
                    </CardDescription>
                  )}
                </CardHeader>

                {body && (
                  <CardContent className="pt-0 pb-4 text-xs text-muted-foreground line-clamp-3">
                    {body}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
