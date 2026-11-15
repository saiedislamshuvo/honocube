import { useState, useMemo, useEffect, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  type VisibilityState,
  type RowSelectionState,
} from "@tanstack/react-table";
import type { Collection, InferRecord } from "../types/collection.js";
import { useCollectionQuery } from "../query/use-query.js";
import { generateColumnsFromCollection } from "./columns.js";
import { parseTableStateFromUrl, syncUrlState } from "./url-sync.js";
import type {
  CollectionListOptions,
  CollectionListResult,
  SortOrder,
  TableUrlState,
} from "./types.js";

export function useCollectionList<TCollection extends Collection<any>>(
  collection: TCollection,
  options: CollectionListOptions<TCollection> = {}
): CollectionListResult<TCollection> {
  const {
    initialPage = 1,
    defaultLimit = 20,
    initialSort,
    initialSearch,
    initialFilters = {},
    syncUrl = true,
    searchParams,
    onUrlChange,
    columns: customColumns,
    getRowId = (row: any, i: number) => String(row.id ?? i),
  } = options;

  // 1. Initial State Resolution (URL vs Options)
  const urlState = useMemo(() => {
    if (searchParams) {
      return parseTableStateFromUrl(searchParams);
    }
    if (typeof window !== "undefined" && syncUrl) {
      return parseTableStateFromUrl(window.location.search);
    }
    return {};
  }, [searchParams, syncUrl]);

  const [page, setPageInternal] = useState<number>(urlState.page || initialPage);
  const [limit, setLimitInternal] = useState<number>(urlState.limit || defaultLimit);
  const [sortString, setSortInternal] = useState<string | undefined>(
    urlState.sort || initialSort || collection.table?.sort
  );
  const [searchQuery, setSearchInternal] = useState<string>(
    urlState.search || initialSearch || ""
  );
  const [activeFilters, setFiltersInternal] = useState<Record<string, string>>(
    urlState.filters || initialFilters
  );

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // 2. Parse Sort String ("-field", "field:desc", "field")
  const { sortField, sortOrder } = useMemo<{ sortField?: string; sortOrder?: SortOrder }>(() => {
    if (!sortString) return {};
    if (sortString.startsWith("-")) {
      return { sortField: sortString.slice(1), sortOrder: "desc" };
    }
    if (sortString.includes(":")) {
      const [f, o] = sortString.split(":");
      return { sortField: f, sortOrder: o?.toLowerCase() === "desc" ? "desc" : "asc" };
    }
    return { sortField: sortString, sortOrder: "asc" };
  }, [sortString]);

  // 3. Bidirectional URL Sync
  useEffect(() => {
    if (!syncUrl || typeof window === "undefined") return;

    const stateToSync: TableUrlState = {
      page,
      limit: limit !== defaultLimit ? limit : undefined,
      sort: sortString,
      search: searchQuery,
      filters: Object.keys(activeFilters).length > 0 ? activeFilters : undefined,
    };

    syncUrlState(stateToSync, { onUrlChange });
  }, [page, limit, sortString, searchQuery, activeFilters, syncUrl, defaultLimit, onUrlChange]);

  // Listen to browser Back/Forward (popstate)
  useEffect(() => {
    if (!syncUrl || typeof window === "undefined") return;

    const handlePopState = () => {
      const parsed = parseTableStateFromUrl(window.location.search);
      setPageInternal(parsed.page || initialPage);
      setLimitInternal(parsed.limit || defaultLimit);
      setSortInternal(parsed.sort || initialSort);
      setSearchInternal(parsed.search || initialSearch || "");
      setFiltersInternal(parsed.filters || initialFilters);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [syncUrl, initialPage, defaultLimit, initialSort, initialSearch, initialFilters]);

  // 4. Query API
  const queryParams = useMemo(() => {
    return {
      page,
      limit,
      sort: sortString,
      search: searchQuery || undefined,
      filters: Object.keys(activeFilters).length > 0 ? activeFilters : undefined,
    };
  }, [page, limit, sortString, searchQuery, activeFilters]);

  const queryResult = useCollectionQuery({
    collection,
    params: queryParams,
  });

  const rawData = queryResult.data?.data;
  const data: InferRecord<TCollection>[] = useMemo(() => {
    if (Array.isArray(rawData)) return rawData as InferRecord<TCollection>[];
    return [];
  }, [rawData]);

  const paginationMeta = queryResult.data?.meta?.pagination;
  const total = paginationMeta?.total ?? data.length;
  const totalPages = paginationMeta?.totalPages ?? (limit > 0 ? Math.ceil(total / limit) : 1);
  const hasNext = paginationMeta?.hasNext ?? page < totalPages;
  const hasPrev = paginationMeta?.hasPrevious ?? page > 1;

  // 5. TanStack Table Columns & Instance
  const columns = useMemo(
    () => generateColumnsFromCollection(collection, customColumns),
    [collection, customColumns]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
      columnVisibility,
    },
    enableRowSelection: options.enableRowSelection ?? true,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount: totalPages,
  });

  // 6. Action Handlers
  const setPage = useCallback((newPage: number) => {
    setPageInternal(Math.max(1, newPage));
  }, []);

  const setLimit = useCallback((newLimit: number) => {
    setLimitInternal(Math.max(1, newLimit));
    setPageInternal(1);
  }, []);

  const setSort = useCallback(
    (field: string, order?: SortOrder) => {
      if (!field) {
        setSortInternal(undefined);
        return;
      }
      const resolvedOrder = order || (sortField === field && sortOrder === "asc" ? "desc" : "asc");
      const formattedSort = resolvedOrder === "desc" ? `-${field}` : field;
      setSortInternal(formattedSort);
      setPageInternal(1);
    },
    [sortField, sortOrder]
  );

  const clearSort = useCallback(() => {
    setSortInternal(undefined);
    setPageInternal(1);
  }, []);

  const setFilter = useCallback((key: string, value: string) => {
    setFiltersInternal((prev) => ({ ...prev, [key]: value }));
    setPageInternal(1);
  }, []);

  const removeFilter = useCallback((key: string) => {
    setFiltersInternal((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setPageInternal(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersInternal({});
    setPageInternal(1);
  }, []);

  const setQuery = useCallback((q: string) => {
    setSearchInternal(q);
    setPageInternal(1);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchInternal("");
    setPageInternal(1);
  }, []);

  // Selection helpers
  const selectedRowIds = useMemo(() => rowSelection as Record<string, boolean>, [rowSelection]);
  const selectedRows = useMemo(() => {
    return table.getSelectedRowModel().rows.map((r) => r.original);
  }, [table]);

  const isAllSelected = useMemo(() => table.getIsAllRowsSelected(), [table]);

  const toggleRowSelected = useCallback((id: string, selected?: boolean) => {
    setRowSelection((prev) => ({
      ...prev,
      [id]: selected !== undefined ? selected : !prev[id],
    }));
  }, []);

  const toggleAllRowsSelected = useCallback(
    (selected?: boolean) => {
      table.toggleAllRowsSelected(selected);
    },
    [table]
  );

  const clearSelection = useCallback(() => {
    setRowSelection({});
  }, []);

  // Column visibility helpers
  const toggleColumn = useCallback(
    (columnId: string, isVisible?: boolean) => {
      const col = table.getColumn(columnId);
      if (col) {
        col.toggleVisibility(isVisible);
      }
    },
    [table]
  );

  return {
    table,
    rows: table.getRowModel().rows,
    columns,
    data,
    rawResponse: queryResult.data,
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    isError: queryResult.isError,
    error: queryResult.error,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
      setPage,
      setLimit,
    },
    sorting: {
      sortField,
      sortOrder,
      setSort,
      clearSort,
    },
    filters: {
      activeFilters,
      setFilter,
      removeFilter,
      clearFilters,
    },
    search: {
      query: searchQuery,
      setQuery,
      clearSearch,
    },
    selection: {
      selectedRowIds,
      selectedRows,
      isAllSelected,
      toggleRowSelected,
      toggleAllRowsSelected,
      clearSelection,
    },
    visibility: {
      columnVisibility,
      setColumnVisibility,
      toggleColumn,
    },
    refetch: queryResult.refetch,
  };
}
