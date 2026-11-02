import React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { flexRender } from "@tanstack/react-table";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@honocube/ui";
import type { Collection, BulkAction } from "../types/collection.js";
import { useCollectionList } from "../table/use-collection-list.js";
import { TableToolbar } from "./table-toolbar.js";
import { TablePagination } from "./table-pagination.js";
import type { TableViewProps } from "./types.js";

export function TableView<TCollection extends Collection<any>>({
  collection,
  options,
  onRowClick,
  showSearch = true,
  showFilters = true,
  showColumnSelector = true,
  enableRowSelection = true,
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

  // 2. Resolve Bulk Actions
  const bulkActionsMap = new Map<string, BulkAction>();
  for (const action of collection.bulkActions || []) {
    bulkActionsMap.set(action.name, action);
  }
  if (propBulkActions) {
    for (const action of propBulkActions) {
      bulkActionsMap.set(action.name, action);
    }
  }
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
                    <input
                      type="checkbox"
                      checked={selection.isAllSelected}
                      onChange={(e) =>
                        selection.toggleAllRowsSelected(e.target.checked)
                      }
                      aria-label="Select all rows"
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
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
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-1">
                    <p className="font-medium text-foreground">{emptyText}</p>
                    {(search.query ||
                      Object.keys(filters.activeFilters).length > 0) && (
                      <p className="text-xs">
                        Try adjusting your search or filters.
                      </p>
                    )}
                  </div>
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
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) =>
                            selection.toggleRowSelected(
                              row.id,
                              e.target.checked
                            )
                          }
                          aria-label={`Select row ${row.id}`}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        />
                      </TableCell>
                    )}
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="text-sm">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
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
