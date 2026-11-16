export type ViewType =
  | "table"
  | "list"
  | "grid"
  | "kanban"
  | "calendar"
  | "gantt"
  | "tree"
  | "spreadsheet";

export interface TableViewConfig<TFieldKeys extends string = string> {
  columns?: TFieldKeys[];
  sort?: string;
  search?: TFieldKeys[];
  filters?: TFieldKeys[];
  pageSize?: number;
}

export interface ListViewConfig<TFieldKeys extends string = string> {
  title?: TFieldKeys;
  subtitle?: TFieldKeys;
  meta?: TFieldKeys;
  badge?: TFieldKeys;
  leading?: "icon" | "avatar" | TFieldKeys;
  trailing?: TFieldKeys;
}

export interface GridViewConfig<TFieldKeys extends string = string> {
  title?: TFieldKeys;
  subtitle?: TFieldKeys;
  body?: TFieldKeys;
  badge?: TFieldKeys;
  image?: TFieldKeys;
  columns?: { sm?: number; md?: number; lg?: number; xl?: number } | number;
}

export interface KanbanViewConfig<
  TFieldKeys extends string = string,
  TGroupKeys extends string = TFieldKeys
> {
  groupBy: TGroupKeys;
  card?: {
    title?: TFieldKeys;
    subtitle?: TFieldKeys;
    badge?: TFieldKeys;
    value?: TFieldKeys;
  };
  columnSummary?: "count" | "sum" | "avg";
}

export interface CalendarViewConfig<
  TFieldKeys extends string = string,
  TDateKeys extends string = TFieldKeys
> {
  title?: TFieldKeys;
  dateField?: TDateKeys;
  start?: TDateKeys;
  end?: TDateKeys;
  colorField?: TFieldKeys;
}

export interface GanttViewConfig<
  TFieldKeys extends string = string,
  TDateKeys extends string = TFieldKeys,
  TProgressKeys extends string = TFieldKeys
> {
  title?: TFieldKeys;
  start: TDateKeys;
  end?: TDateKeys;
  progress?: TProgressKeys;
  dependencies?: TFieldKeys;
}

export interface TreeViewConfig<TFieldKeys extends string = string> {
  parentField: TFieldKeys;
  labelField?: TFieldKeys;
  titleField?: TFieldKeys;
  descriptionField?: TFieldKeys;
  iconField?: TFieldKeys;
  badgeField?: TFieldKeys;
  orderField?: TFieldKeys;
  initialExpandedDepth?: number;
  allowDragAndDrop?: boolean;
}

export interface SpreadsheetViewConfig<TFieldKeys extends string = string> {
  columns?: TFieldKeys[];
  allowAddRows?: boolean;
  allowDeleteRows?: boolean;
  showSummaryRow?: boolean;
  showFormulaBar?: boolean;
  pageSize?: number;
  initialRowCount?: number;
}

/**
 * Extracts field keys that have selectable/enum options suitable for kanban columns and dropdowns.
 */
export type SelectableFieldKeys<TFields> = {
  [K in keyof TFields]: TFields[K] extends { type: "select" }
    ? K
    : TFields[K] extends { build(): { type: "select" } }
    ? K
    : TFields[K] extends { type: "status" | "enum" }
    ? K
    : TFields[K] extends { options: any[] }
    ? K
    : never;
}[keyof TFields] & string;

/**
 * Extracts field keys that represent dates or timestamps suitable for calendars and timelines.
 */
export type DateFieldKeys<TFields> = {
  [K in keyof TFields]: TFields[K] extends { type: "date" | "datetime" }
    ? K
    : TFields[K] extends { build(): { type: "date" | "datetime" } }
    ? K
    : never;
}[keyof TFields] & string;

/**
 * Extracts numeric or currency field keys suitable for metrics, progress, and aggregations.
 */
export type NumericFieldKeys<TFields> = {
  [K in keyof TFields]: TFields[K] extends { type: "number" | "currency" }
    ? K
    : TFields[K] extends { build(): { type: "number" | "currency" } }
    ? K
    : never;
}[keyof TFields] & string;

/**
 * Extracts text and textarea field keys.
 */
export type TextFieldKeys<TFields> = {
  [K in keyof TFields]: TFields[K] extends { type: "text" | "textarea" | "series" }
    ? K
    : TFields[K] extends { build(): { type: "text" | "textarea" | "series" } }
    ? K
    : never;
}[keyof TFields] & string;
