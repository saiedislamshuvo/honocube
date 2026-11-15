import React, { useState } from "react";
import {
  Search,
  X,
  SlidersHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Button,
  Input,
  Badge,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@honocube/ui";
import type { Collection, BulkAction } from "../types/collection.js";
import type {
  CollectionListFilters,
  CollectionListSearch,
  CollectionListSelection,
  CollectionListVisibility,
} from "../table/types.js";
import { toHumanLabel } from "../utils/format.js";

export interface TableToolbarProps<TCollection extends Collection<any>> {
  collection: TCollection;
  search: CollectionListSearch;
  filters: CollectionListFilters;
  visibility: CollectionListVisibility;
  selection: CollectionListSelection<any>;
  bulkActions?: BulkAction[];
  showSearch?: boolean;
  showFilters?: boolean;
  showColumnSelector?: boolean;
  actions?: React.ReactNode;
}

export function TableToolbar<TCollection extends Collection<any>>({
  collection,
  search,
  filters,
  visibility,
  selection,
  bulkActions,
  showSearch = true,
  showFilters = true,
  showColumnSelector = true,
  actions,
}: TableToolbarProps<TCollection>): React.JSX.Element {
  const [filterField, setFilterField] = useState<string>("");
  const [filterValue, setFilterValue] = useState<string>("");
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);

  const activeFilterEntries = Object.entries(filters.activeFilters);
  const selectedCount = Object.keys(selection.selectedRowIds).filter(
    (k) => selection.selectedRowIds[k]
  ).length;

  const handleAddFilter = () => {
    if (filterField.trim() && filterValue.trim()) {
      filters.setFilter(filterField, filterValue);
      setFilterField("");
      setFilterValue("");
      setIsFilterPopoverOpen(false);
    }
  };

  const fieldKeys = collection.getFieldKeys ? collection.getFieldKeys() : Object.keys(collection.fields || {});

  return (
    <div className="flex flex-col gap-3">
      {/* 1. Main Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          {showSearch && (
            <div className="relative min-w-[200px] sm:min-w-[260px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search.query}
                onChange={(e) => search.setQuery(e.target.value)}
                placeholder={`Search ${collection.label || "records"}...`}
                className="pl-8 pr-8 h-9"
              />
              {search.query && (
                <button
                  type="button"
                  onClick={search.clearSearch}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Clear search</span>
                </button>
              )}
            </div>
          )}

          {/* Add Filter Popover */}
          {showFilters && (
            <Popover open={isFilterPopoverOpen} onOpenChange={setIsFilterPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                  <Plus className="h-4 w-4" />
                  <span>Filter</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3 space-y-3" align="start">
                <div className="font-medium text-sm">Add Filter</div>
                <div className="space-y-2">
                  <Select value={filterField} onValueChange={setFilterField}>
                    <SelectTrigger className="w-full h-8 px-2 text-xs">
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldKeys.map((key) => (
                        <SelectItem key={String(key)} value={String(key)} className="text-xs">
                          {collection.getField(String(key))?.label || toHumanLabel(String(key))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Filter value..."
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    className="h-8 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddFilter();
                    }}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setIsFilterPopoverOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleAddFilter}
                    disabled={!filterField || !filterValue}
                  >
                    Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Column Visibility Selector */}
          {showColumnSelector && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>Columns</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {fieldKeys.map((colKey) => {
                  const keyStr = String(colKey);
                  const isVisible = visibility.columnVisibility[keyStr] !== false;
                  return (
                    <DropdownMenuCheckboxItem
                      key={keyStr}
                      checked={isVisible}
                      onCheckedChange={() => visibility.toggleColumn(keyStr)}
                    >
                      {collection.getField(keyStr)?.label || toHumanLabel(keyStr)}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Custom Actions (e.g. + New) */}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* 2. Active Filter Pills */}
      {showFilters && activeFilterEntries.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground font-medium">Filters:</span>
          {activeFilterEntries.map(([key, value]) => (
            <Badge
              key={key}
              variant="secondary"
              className="gap-1.5 pl-2.5 pr-1.5 py-0.5 text-xs font-normal"
            >
              <span>
                {`${collection.getField(key)?.label || toHumanLabel(key)}: `}
                <strong>{value}</strong>
              </span>
              <button
                type="button"
                onClick={() => filters.removeFilter(key)}
                className="hover:text-foreground text-muted-foreground"
              >
                <X className="h-3 w-3" />
                <span className="sr-only">Remove filter</span>
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={filters.clearFilters}
          >
            Clear all
          </Button>
        </div>
      )}

      {/* 3. Floating Bulk Action Toolbar */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/70 px-4 py-2 shadow-sm animate-in fade-in">
          <span className="text-sm font-medium">
            {selectedCount} row{selectedCount > 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            {bulkActions?.map((action) => (
              <Button
                key={action.name}
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={() =>
                  action.execute({
                    selectedIds: Object.keys(selection.selectedRowIds).filter(
                      (k) => selection.selectedRowIds[k]
                    ),
                  })
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{action.label}</span>
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={selection.clearSelection}
            >
              Deselect
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
