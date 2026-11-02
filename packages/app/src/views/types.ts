import type React from "react";
import type { Collection, InferRecord, BulkAction } from "../types/collection.js";
import type { CollectionListOptions } from "../table/types.js";

export interface TableViewProps<TCollection extends Collection<any>> {
  /**
   * The collection schema definition to render.
   */
  collection: TCollection;

  /**
   * Options passed to the headless collection list engine (initialPage, defaultLimit, etc.).
   */
  options?: CollectionListOptions<TCollection>;

  /**
   * Callback invoked when a user clicks on a table row.
   */
  onRowClick?: (record: InferRecord<TCollection>) => void;

  /**
   * Whether to display the search bar in the toolbar. Defaults to true.
   */
  showSearch?: boolean;

  /**
   * Whether to display the filter pill bar and add filter dropdown. Defaults to true.
   */
  showFilters?: boolean;

  /**
   * Whether to display the column visibility selector. Defaults to true.
   */
  showColumnSelector?: boolean;

  /**
   * Whether to enable row selection checkboxes and bulk action bar. Defaults to true.
   */
  enableRowSelection?: boolean;

  /**
   * Custom bulk actions available when rows are selected (overrides or supplements collection.bulkActions).
   */
  bulkActions?: BulkAction[];

  /**
   * Custom actions or buttons to display on the right side of the toolbar (e.g. "+ New Record").
   */
  actions?: React.ReactNode;

  /**
   * Custom CSS class name for the root container.
   */
  className?: string;

  /**
   * Custom message to show when no records are found. Defaults to "No records found."
   */
  emptyText?: string;

  /**
   * Custom message to show while loading. Defaults to "Loading..."
   */
  loadingText?: string;
}
