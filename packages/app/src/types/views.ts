export type ViewType =
  | "table"
  | "list"
  | "grid"
  | "kanban"
  | "calendar"
  | "gantt"
  | "tree";

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

export interface KanbanViewConfig<TFieldKeys extends string = string> {
  groupBy: TFieldKeys;
  card?: {
    title?: TFieldKeys;
    subtitle?: TFieldKeys;
    badge?: TFieldKeys;
    value?: TFieldKeys;
  };
  columnSummary?: "count" | "sum" | "avg";
}

export interface CalendarViewConfig<TFieldKeys extends string = string> {
  title?: TFieldKeys;
  start: TFieldKeys;
  end?: TFieldKeys;
  colorField?: TFieldKeys;
}

export interface GanttViewConfig<TFieldKeys extends string = string> {
  title?: TFieldKeys;
  start: TFieldKeys;
  end?: TFieldKeys;
  progress?: TFieldKeys;
  dependencies?: TFieldKeys;
}

export interface TreeViewConfig<TFieldKeys extends string = string> {
  parentField: TFieldKeys;
  labelField?: TFieldKeys;
}
