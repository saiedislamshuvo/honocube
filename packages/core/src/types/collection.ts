import type { FieldConfig, InferFieldValue } from "./fields.js";
import type {
  TableViewConfig,
  ListViewConfig,
  GridViewConfig,
  KanbanViewConfig,
  CalendarViewConfig,
  GanttViewConfig,
  TreeViewConfig,
  ViewType,
} from "./views.js";
import type { WorkflowConfig } from "./workflow.js";

export type PresentationMode = "dialog" | "drawer" | "page" | "inline";

export interface PresentationConfig {
  create?: PresentationMode;
  edit?: PresentationMode;
  view?: PresentationMode;
}

export interface FormSection<TFieldKeys extends string = string> {
  title?: string;
  description?: string;
  columns?: number;
  fields: TFieldKeys[];
  collapsible?: boolean;
}

export interface FormTab<TFieldKeys extends string = string> {
  label: string;
  icon?: string;
  sections?: FormSection<TFieldKeys>[];
  fields?: TFieldKeys[];
}

export interface FormLayoutConfig<TFieldKeys extends string = string> {
  tabs?: FormTab<TFieldKeys>[];
  sections?: FormSection<TFieldKeys>[];
  columns?: number;
}

export interface SidePanelConfig {
  enabled?: boolean;
  tabs?: Array<"activity" | "comments" | "attachments" | string>;
}

export interface DocumentAction<TRecord = Record<string, unknown>> {
  name: string;
  label: string;
  icon?: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
  execute: (ctx: { record: TRecord; api?: any }) => Promise<void> | void;
  visible?: (ctx: { record: TRecord; user?: Record<string, unknown> }) => boolean;
}

export interface BulkAction {
  name: string;
  label: string;
  icon?: string;
  execute: (ctx: { selectedIds: (string | number)[]; api?: any }) => Promise<void> | void;
}

export interface CollectionIdentifier {
  field?: string;
  series?: string;
  titleField?: string;
}

export interface CollectionConfig<
  TFields extends Record<string, FieldConfig<any>> = Record<string, FieldConfig<any>>
> {
  name: string;
  endpoint?: string;
  label?: string;
  singular?: string;
  icon?: string;
  group?: string;
  hidden?: boolean;
  identifier?: CollectionIdentifier;
  fields: TFields;
  form?: FormLayoutConfig<Extract<keyof TFields, string>>;
  table?: TableViewConfig<Extract<keyof TFields, string>>;
  list?: ListViewConfig<Extract<keyof TFields, string>>;
  grid?: GridViewConfig<Extract<keyof TFields, string>>;
  kanban?: KanbanViewConfig<Extract<keyof TFields, string>>;
  calendar?: CalendarViewConfig<Extract<keyof TFields, string>>;
  gantt?: GanttViewConfig<Extract<keyof TFields, string>>;
  tree?: TreeViewConfig<Extract<keyof TFields, string>>;
  defaultView?: ViewType;
  workflow?: WorkflowConfig<InferRecord<TFields>>;
  sidePanel?: SidePanelConfig;
  presentation?: PresentationConfig;
  actions?: DocumentAction<InferRecord<TFields>>[];
  bulkActions?: BulkAction[];
}

export type InferRecord<TFieldsOrCollection> = TFieldsOrCollection extends { fields: infer TFields extends Record<string, FieldConfig<any>> }
  ? { [K in keyof TFields]: InferFieldValue<TFields[K]> }
  : TFieldsOrCollection extends Record<string, FieldConfig<any>>
  ? { [K in keyof TFieldsOrCollection]: InferFieldValue<TFieldsOrCollection[K]> }
  : Record<string, unknown>;

export interface Collection<TFields extends Record<string, FieldConfig<any>> = Record<string, FieldConfig<any>>>
  extends CollectionConfig<TFields> {
  readonly _isCollection: true;
  getField: (key: keyof TFields) => TFields[keyof TFields] | undefined;
  getFieldKeys: () => (keyof TFields)[];
}
