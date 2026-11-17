import React, { useState, useCallback, useMemo } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, SearchX } from "lucide-react";
import { flexRender } from "@tanstack/react-table";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Checkbox,
  Switch,
  EmptyState,
} from "@honocube/ui";
import {
  useCollectionList,
  useApiClient,
  toHumanLabel,
  type Collection,
  type BulkAction,
  type TableViewProps,
} from "@honocube/core";
import { TableToolbar } from "./table-toolbar.js";
import { TablePagination } from "./table-pagination.js";

export function TableView<TCollection extends Collection<any>>({
  collection,
  options,
  onRowClick,
  showSearch = true,
  showFilters = true,
  showColumnSelector = true,
  enableRowSelection = true,
  enableInlineToggle = true,
  onToggleField,
  onBulkToggle,
  bulkActions: propBulkActions,
  actions,
  className = "",
  emptyText = "No records found.",
  loadingText = "Loading records...",
}: TableViewProps<TCollection>): React.JSX.Element {
  // 1. Initialize Headless Collection List Engine
  const listResult = useCollectionList(collection, {
    ...options,
    enableRowSelection,
  });

  const {
    table,
    rows,
    isLoading,
    pagination,
    sorting,
    filters,
    search,
    selection,
    visibility,
  } = listResult;

  // 2. Resolve ApiClient safely
  let apiClient: any = null;
  try {
    apiClient = useApiClient();
  } catch {
    // Standalone / test environment without ApiClientProvider
  }

  // 3. In-table boolean toggle state & handler
  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<string, boolean>>({});
  const [pendingToggles, setPendingToggles] = useState<Record<string, boolean>>({});

  const handleInlineToggle = useCallback(
    async (record: any, fieldKey: string, nextVal: boolean) => {
      const recordId = record?.id;
      const toggleKey = `${recordId}-${fieldKey}`;
      const prevVal = Boolean(
        toggleKey in optimisticOverrides ? optimisticOverrides[toggleKey] : record[fieldKey]
      );

      setOptimisticOverrides((prev) => ({ ...prev, [toggleKey]: nextVal }));
      setPendingToggles((prev) => ({ ...prev, [toggleKey]: true }));

      try {
        if (onToggleField) {
          await onToggleField(record, fieldKey, nextVal);
        } else if (apiClient && recordId !== undefined) {
          const endpoint = collection.endpoint || `/${collection.name}`;
          await apiClient.post(`${endpoint}/${recordId}/toggle/${fieldKey}`, { value: nextVal });
        }
      } catch (err) {
        // Rollback on error
        setOptimisticOverrides((prev) => ({ ...prev, [toggleKey]: prevVal }));
        throw err;
      } finally {
        setPendingToggles((prev) => {
          const next: Record<string, boolean> = {};
          for (const [k, v] of Object.entries(prev)) {
            if (k !== toggleKey) next[k] = v;
          }
          return next;
        });
      }
    },
    [onToggleField, apiClient, collection.endpoint, collection.name, optimisticOverrides]
  );

  // 4. Resolve Bulk Actions (including automatic bulk boolean toggles)
  const bulkActionsMap = useMemo(() => {
    const map = new Map<string, BulkAction>();
    for (const action of collection.bulkActions || []) {
      map.set(action.name, action);
    }
    if (propBulkActions) {
      for (const action of propBulkActions) {
        map.set(action.name, action);
      }
    }

    // Automatically provision bulk actions for boolean fields
    if (enableInlineToggle && collection.fields) {
      for (const [key, fieldDef] of Object.entries(collection.fields)) {
        const field: any =
          typeof (fieldDef as any)?.build === "function" ? (fieldDef as any).build() : fieldDef;
        if (field.type === "boolean" && !field.readOnly) {
          if (
            Array.isArray(collection.table?.inlineToggle) &&
            !collection.table.inlineToggle.includes(key)
          ) {
            continue;
          }
          if (collection.table?.inlineToggle === false || field.inlineToggle === false) {
            continue;
          }

          const label = field.label || toHumanLabel(key);
          const enableKey = `bulk_enable_${key}`;
          const disableKey = `bulk_disable_${key}`;

          if (!map.has(enableKey)) {
            map.set(enableKey, {
              name: enableKey,
              label: `Enable ${label}`,
              execute: async ({ selectedIds, api }) => {
                if (onBulkToggle) {
                  await onBulkToggle(selectedIds, key, true);
                } else {
                  const client = api || apiClient;
                  if (client) {
                    await client.post(`${collection.endpoint || `/${collection.name}`}/batch-toggle`, {
                      ids: selectedIds,
                      field: key,
                      value: true,
                    });
                  }
                }
              },
            });
          }

          if (!map.has(disableKey)) {
            map.set(disableKey, {
              name: disableKey,
              label: `Disable ${label}`,
              execute: async ({ selectedIds, api }) => {
                if (onBulkToggle) {
                  await onBulkToggle(selectedIds, key, false);
                } else {
                  const client = api || apiClient;
                  if (client) {
                    await client.post(`${collection.endpoint || `/${collection.name}`}/batch-toggle`, {
                      ids: selectedIds,
                      field: key,
                      value: false,
                    });
                  }
                }
              },
            });
          }
        }
      }
    }

    return map;
  }, [collection, propBulkActions, enableInlineToggle, onBulkToggle, apiClient]);

  const activeBulkActions = Array.from(bulkActionsMap.values());

  const visibleLeafColumns = table.getVisibleLeafColumns();
  const totalColSpan = enableRowSelection
    ? visibleLeafColumns.length + 1
    : visibleLeafColumns.length;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 1. Filter, Search, Column Selector & Bulk Actions Toolbar */}
      <TableToolbar
        collection={collection}
        search={search}
        filters={filters}
        visibility={visibility}
        selection={selection}
        bulkActions={activeBulkActions}
        showSearch={showSearch}
        showFilters={showFilters}
        showColumnSelector={showColumnSelector}
        actions={actions}
      />

      {/* 2. Responsive Bordered Data Table */}
      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {enableRowSelection && (
                  <TableHead className="w-[48px] px-3">
                    <Checkbox
                      checked={selection.isAllSelected}
                      onCheckedChange={(checked) =>
                        selection.toggleAllRowsSelected(checked === true)
                      }
                      aria-label="Select all rows"
                    />
                  </TableHead>
                )}
                {headerGroup.headers.map((header) => {
                  const isSorted = sorting.sortField === header.column.id;
                  const isDesc = isSorted && sorting.sortOrder === "desc";
                  const isAsc = isSorted && sorting.sortOrder === "asc";

                  return (
                    <TableHead key={header.id} className="whitespace-nowrap">
                      <button
                        type="button"
                        className="flex items-center gap-1.5 text-xs font-semibold hover:text-foreground transition-colors group cursor-pointer focus:outline-none"
                        onClick={() => sorting.setSort(header.column.id)}
                        aria-label={`Sort by ${String(header.column.id)}`}
                      >
                        <span>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </span>
                        {isDesc ? (
                          <ArrowDown className="h-3.5 w-3.5 text-foreground" />
                        ) : isAsc ? (
                          <ArrowUp className="h-3.5 w-3.5 text-foreground" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground opacity-30 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={totalColSpan}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span>{loadingText}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={totalColSpan}
                  className="p-8 text-center"
                >
                  <EmptyState
                    icon={<SearchX className="h-6 w-6 text-muted-foreground" />}
                    title={emptyText}
                    description={
                      search.query ||
                      Object.keys(filters.activeFilters).length > 0
                        ? "Try adjusting your search or filters."
                        : `No records found in this view.`
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const isSelected = Boolean(selection.selectedRowIds[row.id]);
                return (
                  <TableRow
                    key={row.id}
                    data-state={isSelected ? "selected" : undefined}
                    className={
                      onRowClick
                        ? "cursor-pointer hover:bg-muted/50 transition-colors"
                        : undefined
                    }
                    onClick={() => {
                      if (onRowClick) {
                        onRowClick(row.original);
                      }
                    }}
                  >
                    {enableRowSelection && (
                      <TableCell
                        className="w-[48px] px-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            selection.toggleRowSelected(
                              row.id,
                              checked === true
                            )
                          }
                          aria-label={`Select row ${row.id}`}
                        />
                      </TableCell>
                    )}
                    {row.getVisibleCells().map((cell) => {
                      const colId = cell.column.id;
                      const field: any = collection.getField
                        ? collection.getField(colId)
                        : (collection.fields as any)?.[colId];
                      const isBooleanField = field?.type === "boolean";
                      const isToggleAllowed =
                        enableInlineToggle &&
                        isBooleanField &&
                        !field?.readOnly &&
                        field?.inlineToggle !== false &&
                        collection.table?.inlineToggle !== false &&
                        (!Array.isArray(collection.table?.inlineToggle) ||
                          collection.table.inlineToggle.includes(colId));

                      if (isToggleAllowed) {
                        const recordId = (row.original as any)?.id ?? row.id;
                        const toggleKey = `${recordId}-${colId}`;
                        const rawVal = cell.getValue();
                        const currentVal = Boolean(
                          toggleKey in optimisticOverrides
                            ? optimisticOverrides[toggleKey]
                            : rawVal
                        );
                        const isPending = Boolean(pendingToggles[toggleKey]);

                        return (
                          <TableCell
                            key={cell.id}
                            className="text-sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-2">
                              <Switch
                                size="sm"
                                disabled={isPending}
                                checked={currentVal}
                                aria-label={`Toggle ${field?.label || colId} for record ${recordId}`}
                                data-testid={`inline-toggle-${colId}-${recordId}`}
                                onCheckedChange={async (nextVal) => {
                                  await handleInlineToggle(row.original, colId, nextVal);
                                }}
                              />
                              <span className="text-xs text-muted-foreground select-none">
                                {currentVal ? "Yes" : "No"}
                              </span>
                            </div>
                          </TableCell>
                        );
                      }

                      return (
                        <TableCell key={cell.id} className="text-sm">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 3. Keyset & Offset Pagination Footer */}
      <TablePagination
        pagination={pagination}
        selection={enableRowSelection ? selection : undefined}
      />
    </div>
  );
}
