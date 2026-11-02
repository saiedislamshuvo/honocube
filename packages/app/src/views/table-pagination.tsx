import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@honocube/ui";
import type {
  CollectionListPagination,
  CollectionListSelection,
} from "../table/types.js";

export interface TablePaginationProps {
  pagination: CollectionListPagination;
  selection?: CollectionListSelection<any>;
  pageSizeOptions?: number[];
  className?: string;
}

export function TablePagination({
  pagination,
  selection,
  pageSizeOptions = [10, 20, 50, 100],
  className = "",
}: TablePaginationProps): React.JSX.Element {
  const { page, limit, total, totalPages, hasNext, hasPrev, setPage, setLimit } =
    pagination;

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const selectedCount = selection
    ? Object.keys(selection.selectedRowIds).filter((k) => selection.selectedRowIds[k]).length
    : 0;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-4 px-2 py-4 ${className}`}
    >
      {/* 1. Left: Selection & Results Counter */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {selectedCount > 0 ? (
          <span>{`${selectedCount} of ${total} row${total === 1 ? "" : "s"} selected.`}</span>
        ) : (
          <span>{`Showing ${from} to ${to} of ${total} results`}</span>
        )}
      </div>

      {/* 2. Right: Page Size & Navigation */}
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        {/* Page size dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            Rows per page
          </span>
          <Select
            value={String(limit)}
            onValueChange={(value) => {
              setLimit(Number(value));
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={String(limit)} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Page indicator */}
        <div className="flex items-center justify-center text-sm font-medium whitespace-nowrap">
          {`Page ${page} of ${Math.max(totalPages, 1)}`}
        </div>

        {/* Pagination action buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 p-0"
            onClick={() => setPage(1)}
            disabled={!hasPrev || page <= 1}
            aria-label="Go to first page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 p-0"
            onClick={() => setPage(page - 1)}
            disabled={!hasPrev || page <= 1}
            aria-label="Go to previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 p-0"
            onClick={() => setPage(page + 1)}
            disabled={!hasNext || page >= totalPages}
            aria-label="Go to next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 p-0"
            onClick={() => setPage(totalPages)}
            disabled={!hasNext || page >= totalPages}
            aria-label="Go to last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
