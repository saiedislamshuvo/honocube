import type { CollectionConfig } from "./collection.js";

export type BaseFieldType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "date"
  | "datetime"
  | "boolean"
  | "select"
  | "json"
  | "relation"
  | "collection"
  | "computed"
  | "series";

export interface FieldCapabilityContext<TRecord = Record<string, unknown>> {
  record: TRecord;
  user?: Record<string, unknown>;
}

export type DynamicRule<T = boolean, TRecord = Record<string, unknown>> =
  | T
  | ((ctx: FieldCapabilityContext<TRecord>) => T);

export interface SelectOption<T = string | number> {
  label: string;
  value: T;
}

export interface BaseFieldConfig<TRecord = Record<string, unknown>> {
  label?: string;
  description?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: DynamicRule<boolean, TRecord>;
  visible?: DynamicRule<boolean, TRecord>;
  readOnly?: boolean;
}

export interface TextFieldConfig<TRecord = Record<string, unknown>> extends BaseFieldConfig<TRecord> {
  type: "text" | "textarea";
  default?: string | (() => string);
  pattern?: string;
}

export interface NumberFieldConfig<TRecord = Record<string, unknown>> extends BaseFieldConfig<TRecord> {
  type: "number" | "currency";
  default?: number | (() => number);
  min?: number;
  max?: number;
  step?: number;
  format?: "currency" | "percent" | "number";
  currencyCode?: string;
}

export interface DateFieldConfig<TRecord = Record<string, unknown>> extends BaseFieldConfig<TRecord> {
  type: "date" | "datetime";
  default?: string | Date | (() => string | Date);
  format?: string;
}

export interface BooleanFieldConfig<TRecord = Record<string, unknown>> extends BaseFieldConfig<TRecord> {
  type: "boolean";
  default?: boolean | (() => boolean);
}

export interface SelectFieldConfig<TValue = string, TRecord = Record<string, unknown>> extends BaseFieldConfig<TRecord> {
  type: "select";
  options: Array<TValue | SelectOption<TValue>>;
  default?: TValue | (() => TValue);
}

export interface JsonFieldConfig<TRecord = Record<string, unknown>> extends BaseFieldConfig<TRecord> {
  type: "json";
  default?: unknown | (() => unknown);
}

export interface SeriesFieldConfig<TRecord = Record<string, unknown>> extends BaseFieldConfig<TRecord> {
  type: "series";
  prefix: string;
}

export interface RelationFieldConfig<TRecord = Record<string, unknown>> extends BaseFieldConfig<TRecord> {
  type: "relation";
  target: string;
  valueKey?: string;
  labelKey?: string;
  searchable?: boolean;
}

export interface SubCollectionFieldConfig<
  TChildCollection extends CollectionConfig<any> = CollectionConfig<any>,
  TRecord = Record<string, unknown>
> extends BaseFieldConfig<TRecord> {
  type: "collection";
  collection: TChildCollection;
  relation?: "hasMany" | "hasOne";
  inline?: boolean;
}

export interface ComputedFieldConfig<
  TReturn = any,
  TRecord = Record<string, unknown>,
  TParentRecord = Record<string, unknown>
> extends BaseFieldConfig<TRecord> {
  type: "computed";
  compute: (record: TRecord, parentRecord?: TParentRecord) => TReturn;
}

export type FieldConfig<TRecord = Record<string, unknown>> =
  | TextFieldConfig<TRecord>
  | NumberFieldConfig<TRecord>
  | DateFieldConfig<TRecord>
  | BooleanFieldConfig<TRecord>
  | SelectFieldConfig<any, TRecord>
  | JsonFieldConfig<TRecord>
  | SeriesFieldConfig<TRecord>
  | RelationFieldConfig<TRecord>
  | SubCollectionFieldConfig<any, TRecord>
  | ComputedFieldConfig<any, TRecord>;

export type InferFieldValue<TField> = TField extends { type: "text" | "textarea" | "series" }
  ? string
  : TField extends { type: "number" | "currency" }
  ? number
  : TField extends { type: "date" | "datetime" }
  ? string
  : TField extends { type: "boolean" }
  ? boolean
  : TField extends { type: "select"; options: Array<infer TOption> }
  ? TOption extends SelectOption<infer TVal>
    ? TVal
    : TOption
  : TField extends { type: "json" }
  ? unknown
  : TField extends { type: "relation" }
  ? string | number
  : TField extends { type: "collection"; collection: CollectionConfig<infer TChildFields>; relation?: "hasOne" }
  ? { [K in keyof TChildFields]: InferFieldValue<TChildFields[K]> }
  : TField extends { type: "collection"; collection: CollectionConfig<infer TChildFields> }
  ? Array<{ [K in keyof TChildFields]: InferFieldValue<TChildFields[K]> }>
  : TField extends { type: "computed"; compute: (...args: any[]) => infer TReturn }
  ? TReturn
  : unknown;
