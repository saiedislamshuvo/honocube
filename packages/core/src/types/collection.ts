import type { FieldConfig, InferFieldValue } from "./fields.js";
import type { IFieldBuilder } from "./builder.js";

export type AnyFieldDef<TRecord = Record<string, unknown>> =
  | FieldConfig<TRecord>
  | IFieldBuilder<any, any, TRecord>;
import type {
  TableViewConfig,
  ListViewConfig,
  GridViewConfig,
  KanbanViewConfig,
  CalendarViewConfig,
  GanttViewConfig,
  TreeViewConfig,
  SpreadsheetViewConfig,
  SelectableFieldKeys,
  DateFieldKeys,
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

export interface CollectionIdentifier<TFieldKeys extends string = string> {
  field?: TFieldKeys;
  series?: TFieldKeys;
  titleField?: TFieldKeys;
}

export interface CollectionConfig<
  TFields extends Record<string, AnyFieldDef<any>> = Record<string, AnyFieldDef<any>>
> {
  name: string;
  endpoint?: string;
  label?: string;
  singular?: string;
  icon?: string;
  group?: string;
  hidden?: boolean;
  singleton?: boolean;
  identifier?: CollectionIdentifier<Extract<keyof TFields, string>>;
  fields: TFields;
  form?: FormLayoutConfig<Extract<keyof TFields, string>>;
  table?: TableViewConfig<Extract<keyof TFields, string>>;
  list?: ListViewConfig<Extract<keyof TFields, string>>;
  grid?: GridViewConfig<Extract<keyof TFields, string>>;
  kanban?: KanbanViewConfig<Extract<keyof TFields, string>, SelectableFieldKeys<TFields>>;
  calendar?: CalendarViewConfig<Extract<keyof TFields, string>, DateFieldKeys<TFields>>;
  gantt?: GanttViewConfig<Extract<keyof TFields, string>, DateFieldKeys<TFields>>;
  tree?: TreeViewConfig<Extract<keyof TFields, string>>;
  spreadsheet?: SpreadsheetViewConfig<Extract<keyof TFields, string>>;
  defaultView?: ViewType;
  workflow?: WorkflowConfig<InferRecord<TFields>>;
  sidePanel?: SidePanelConfig;
  presentation?: PresentationConfig;
  actions?: DocumentAction<InferRecord<TFields>>[];
  bulkActions?: BulkAction[];
}

export type FieldOverrideMap = Record<string, Partial<FieldConfig<any>> | any>;

export interface BaseDerivedCollectionConfig<
  TFields extends Record<string, AnyFieldDef<any>> = Record<string, AnyFieldDef<any>>
> {
  name?: string;
  endpoint?: string;
  label?: string;
  singular?: string;
  icon?: string;
  group?: string;
  hidden?: boolean;
  singleton?: boolean;
  identifier?: CollectionIdentifier<string>;
  fields?: FieldOverrideMap | TFields;
  form?: FormLayoutConfig<string>;
  table?: TableViewConfig<string> | any;
  list?: ListViewConfig<string>;
  grid?: GridViewConfig<string>;
  kanban?: KanbanViewConfig<string, string>;
  calendar?: CalendarViewConfig<string, string>;
  gantt?: GanttViewConfig<string, string>;
  tree?: TreeViewConfig<string>;
  defaultView?: ViewType;
  workflow?: WorkflowConfig<any>;
  sidePanel?: SidePanelConfig;
  presentation?: PresentationConfig;
  actions?: DocumentAction<any>[];
  bulkActions?: BulkAction[];
}

export interface ResourceCollectionConfig<
  TFields extends Record<string, AnyFieldDef<any>> = Record<string, AnyFieldDef<any>>
> extends BaseDerivedCollectionConfig<TFields> {
  resource: any;
}

export type TableCollectionConfig<
  TFields extends Record<string, AnyFieldDef<any>> = Record<string, AnyFieldDef<any>>
> =
  | (BaseDerivedCollectionConfig<TFields> & {
      drizzleTable: any;
      table?: TableViewConfig<string> | any;
    })
  | (BaseDerivedCollectionConfig<TFields> & {
      drizzleTable?: never;
      table: { _: any } | { [key: symbol]: any };
    });

export type DefineCollectionInput<
  TFields extends Record<string, AnyFieldDef<any>> = Record<string, AnyFieldDef<any>>
> = CollectionConfig<TFields> | ResourceCollectionConfig<TFields> | TableCollectionConfig<TFields>;

export type InferRecord<TFieldsOrCollection> = TFieldsOrCollection extends { fields: infer TFields extends Record<string, any> }
  ? { [K in keyof TFields]: InferFieldValue<TFields[K]> }
  : TFieldsOrCollection extends Record<string, any>
  ? { [K in keyof TFieldsOrCollection]: InferFieldValue<TFieldsOrCollection[K]> }
  : Record<string, unknown>;

export type NormalizedField<T> = T extends { build(): infer TBuilt }
  ? TBuilt extends FieldConfig<any>
    ? TBuilt
    : FieldConfig<any>
  : T extends { toConfig(): infer TBuilt }
  ? TBuilt extends FieldConfig<any>
    ? TBuilt
    : FieldConfig<any>
  : T extends FieldConfig<any>
  ? T
  : FieldConfig<any>;

export type NormalizedFields<TFields extends Record<string, any>> = {
  [K in keyof TFields]: NormalizedField<TFields[K]>;
};

export interface Collection<TFields extends Record<string, AnyFieldDef<any>> = Record<string, AnyFieldDef<any>>>
  extends Omit<CollectionConfig<TFields>, "fields"> {
  readonly _isCollection: true;
  endpoint: string;
  label: string;
  fields: NormalizedFields<TFields>;
  defaultView: ViewType;
  getField: (key: keyof TFields) => FieldConfig<any> | undefined;
  getFieldKeys: () => (keyof TFields)[];
}
