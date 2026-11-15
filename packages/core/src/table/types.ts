import type { ColumnDef, Row, Table, VisibilityState } from "@tanstack/react-table";
import type { Collection, InferRecord } from "../types/collection.js";
import type { ApiClientError } from "../client/errors.js";

export type SortOrder = "asc" | "desc";

export interface SortState {
  field?: string;
  order?: SortOrder;
}

export interface TableUrlState {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  filters?: Record<string, string>;
}

export interface CollectionListPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
}

export interface CollectionListSorting {
  sortField?: string;
  sortOrder?: SortOrder;
  setSort: (field: string, order?: SortOrder) => void;
  clearSort: () => void;
}

export interface CollectionListFilters {
  activeFilters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  removeFilter: (key: string) => void;
  clearFilters: () => void;
}

export interface CollectionListSearch {
  query: string;
  setQuery: (q: string) => void;
  clearSearch: () => void;
}

export interface CollectionListSelection<TRecord = Record<string, unknown>> {
  selectedRowIds: Record<string, boolean>;
  selectedRows: TRecord[];
  isAllSelected: boolean;
  toggleRowSelected: (id: string, selected?: boolean) => void;
  toggleAllRowsSelected: (selected?: boolean) => void;
  clearSelection: () => void;
}

export interface CollectionListVisibility {
  columnVisibility: VisibilityState;
  setColumnVisibility: (visibility: VisibilityState) => void;
  toggleColumn: (columnId: string, isVisible?: boolean) => void;
}

export interface CollectionListOptions<TCollection extends Collection<any>> {
  initialPage?: number;
  defaultLimit?: number;
  initialSort?: string;
  initialSearch?: string;
  initialFilters?: Record<string, string>;
  syncUrl?: boolean;
  searchParams?: URLSearchParams | Record<string, string | string[] | undefined>;
  onUrlChange?: (newUrl: string) => void;
  columns?: ColumnDef<InferRecord<TCollection>, any>[];
  enableRowSelection?: boolean;
  getRowId?: (row: InferRecord<TCollection>, index: number) => string;
}

export interface CollectionListResult<TCollection extends Collection<any>> {
  table: Table<InferRecord<TCollection>>;
  rows: Row<InferRecord<TCollection>>[];
  columns: ColumnDef<InferRecord<TCollection>, any>[];
  data: InferRecord<TCollection>[];
  rawResponse?: any;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: ApiClientError | Error | null;
  pagination: CollectionListPagination;
  sorting: CollectionListSorting;
  filters: CollectionListFilters;
  search: CollectionListSearch;
  selection: CollectionListSelection<InferRecord<TCollection>>;
  visibility: CollectionListVisibility;
  refetch: () => Promise<unknown>;
}
