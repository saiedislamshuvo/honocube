import React, { useState, useMemo } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@honocube/ui";
import type { Collection, InferRecord } from "../types/collection.js";
import { useCollectionQuery } from "../query/use-query.js";
import { useCollectionMutation } from "../query/use-mutation.js";
import { toHumanLabel, formatCellValue } from "../utils/format.js";
import type { KanbanViewProps, KanbanColumn } from "./types.js";

export function KanbanView<TCollection extends Collection<any>>({
  collection,
  groupBy,
  columns: customColumns,
  onCardClick,
  onCardMove,
  onAddCard,
  className = "",
  emptyText = "No cards in this pipeline.",
}: KanbanViewProps<TCollection>): React.JSX.Element {
  const queryResult = useCollectionQuery({
    collection,
    params: { limit: 100 },
  });

  const mutation = useCollectionMutation(collection);

  const rawData: InferRecord<TCollection>[] = useMemo(() => {
    const list = queryResult.data?.data;
    return Array.isArray(list) ? (list as InferRecord<TCollection>[]) : [];
  }, [queryResult.data]);

  // Local optimistic record cache for instant drag-and-drop response
  const [localOverrides, setLocalOverrides] = useState<Record<string, Record<string, any>>>({});

  const records = useMemo(() => {
    return rawData.map((rec: any) => {
      const override = localOverrides[rec.id];
      return override ? { ...rec, ...override } : rec;
    });
  }, [rawData, localOverrides]);

  const groupByField = String(groupBy || collection.kanban?.groupBy || "status");
  const fieldConfig = collection.getField(groupByField);
  const cardConfig = collection.kanban?.card;
  const columnSummary = collection.kanban?.columnSummary || "count";

  // Resolve Kanban columns
  const columns: KanbanColumn[] = useMemo(() => {
    if (customColumns && customColumns.length > 0) {
      return customColumns;
    }

    // 1. From select options
    if (fieldConfig?.type === "select" && Array.isArray((fieldConfig as any).options)) {
      return (fieldConfig as any).options.map((opt: any) => {
        const value = typeof opt === "object" && opt !== null ? String(opt.value) : String(opt);
        const label = typeof opt === "object" && opt !== null ? String(opt.label) : toHumanLabel(value);
        return { value, label };
      });
    }

    // 2. From workflow states
    if (collection.workflow?.states && Array.isArray(collection.workflow.states)) {
      return collection.workflow.states.map((st: any) => {
        const name = typeof st === "object" && st !== null ? String(st.name) : String(st);
        const label = typeof st === "object" && st !== null && st.label ? String(st.label) : toHumanLabel(name);
        return { value: name, label };
      });
    }

    // 3. Fallback: discover distinct values from records
    const distinctSet = new Set<string>();
    records.forEach((r: any) => {
      if (r[groupByField] !== undefined && r[groupByField] !== null) {
        distinctSet.add(String(r[groupByField]));
      }
    });

    if (distinctSet.size > 0) {
      return Array.from(distinctSet).map((val) => ({
        value: val,
        label: toHumanLabel(val),
      }));
    }

    // Fallback default columns
    return [
      { value: "todo", label: "To Do" },
      { value: "in_progress", label: "In Progress" },
      { value: "done", label: "Done" },
    ];
  }, [customColumns, fieldConfig, collection.workflow, records, groupByField]);

  // Handle card moving between columns
  const handleMoveCard = async (recordId: string | number, targetColumn: string) => {
    const targetRecord = records.find((r: any) => String(r.id) === String(recordId));
    if (!targetRecord) return;
    if (String(targetRecord[groupByField]) === targetColumn) return;

    // Optimistically update
    setLocalOverrides((prev) => ({
      ...prev,
      [String(recordId)]: { [groupByField]: targetColumn },
    }));

    if (onCardMove) {
      await onCardMove(targetRecord, targetColumn);
    } else {
      await mutation.update.mutateAsync({
        id: recordId,
        [groupByField]: targetColumn,
      } as any);
    }
  };

  // Group records by column
  const recordsByColumn = useMemo(() => {
    const map: Record<string, InferRecord<TCollection>[]> = {};
    columns.forEach((col) => {
      map[col.value] = [];
    });

    records.forEach((rec: any) => {
      const colVal = String(rec[groupByField] ?? "");
      if (map[colVal]) {
        map[colVal].push(rec);
      } else if (columns[0]) {
        // Fallback to first column if no match
        map[columns[0].value]?.push(rec);
      }
    });

    return map;
  }, [columns, records, groupByField]);

  return (
    <div className={`space-y-4 ${className}`}>
      {queryResult.isLoading && records.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mb-2" />
          <span className="text-sm">Loading pipeline...</span>
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground border rounded-lg bg-card">
          <p className="font-medium text-foreground">{emptyText}</p>
        </div>
      ) : (
        /* Horizontal scrolling Kanban Board */
        <div className="flex gap-4 overflow-x-auto pb-4 items-start">
          {columns.map((column) => {
            const columnItems = recordsByColumn[column.value] || [];

            // Calculate column summary
            const summaryText = (() => {
              if (columnSummary === "sum" && cardConfig?.value) {
                const total = columnItems.reduce(
                  (acc, item: any) => acc + (Number(item[cardConfig.value!]) || 0),
                  0
                );
                const valField = collection.getField(cardConfig.value);
                return formatCellValue(total, valField);
              }
              if (columnSummary === "avg" && cardConfig?.value) {
                const avg =
                  columnItems.length > 0
                    ? columnItems.reduce(
                        (acc, item: any) => acc + (Number(item[cardConfig.value!]) || 0),
                        0
                      ) / columnItems.length
                    : 0;
                const valField = collection.getField(cardConfig.value);
                return `Avg: ${formatCellValue(avg, valField)}`;
              }
              return null;
            })();

            return (
              <div
                key={column.value}
                data-column={column.value}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  try {
                    const data = JSON.parse(e.dataTransfer.getData("text/plain"));
                    if (data?.id) {
                      handleMoveCard(data.id, column.value);
                    }
                  } catch {
                    // Ignore invalid drag payload
                  }
                }}
                className="flex-shrink-0 w-72 sm:w-80 rounded-lg border bg-muted/30 p-3 space-y-3"
              >
                {/* 1. Column Header */}
                <div className="flex items-center justify-between pb-1 border-b">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{column.label}</span>
                    <Badge variant="secondary" className="px-1.5 py-0 text-xs font-normal">
                      {columnItems.length}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {summaryText && (
                      <span className="text-xs font-medium text-muted-foreground">
                        {summaryText}
                      </span>
                    )}
                    {onAddCard && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={() => onAddCard(column.value)}
                        aria-label={`Add card to ${column.label}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* 2. Column Cards List */}
                <div className="space-y-2 min-h-[150px]">
                  {columnItems.map((record: any) => {
                    const titleKey = (cardConfig?.title as string) || "title";
                    const titleVal =
                      record[titleKey] ??
                      record.name ??
                      record.id;
                    const subtitleVal =
                      cardConfig?.subtitle && record[cardConfig.subtitle]
                        ? String(record[cardConfig.subtitle])
                        : undefined;
                    const badgeVal =
                      cardConfig?.badge && record[cardConfig.badge]
                        ? String(record[cardConfig.badge])
                        : undefined;
                    const amountVal =
                      cardConfig?.value && record[cardConfig.value] !== undefined
                        ? formatCellValue(
                            record[cardConfig.value],
                            collection.getField(cardConfig.value)
                          )
                        : undefined;

                    return (
                      <Card
                        key={record.id}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            "text/plain",
                            JSON.stringify({ id: record.id, fromCol: column.value })
                          );
                        }}
                        onClick={() => onCardClick?.(record)}
                        className={`p-3 bg-card shadow-sm hover:shadow-md transition-shadow select-none ${
                          onCardClick ? "cursor-pointer" : "cursor-grab"
                        }`}
                      >
                        <CardContent className="p-0 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium line-clamp-2">
                              {String(titleVal)}
                            </span>
                            {badgeVal && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize flex-shrink-0">
                                {badgeVal}
                              </Badge>
                            )}
                          </div>

                          {subtitleVal && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {subtitleVal}
                            </p>
                          )}

                          {amountVal && (
                            <div className="pt-1 flex items-center justify-between text-xs font-semibold text-foreground">
                              <span>{amountVal}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
