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
  | "series"
  | "image"
  | "media"
  | "daterange"
  | "phone"
  | "color"
  | "icon"
  | "tags"
  | "slug"
  | "barcode"
  | "qrcode"
  | "signature"
  | "richtext"
  | "repeater";

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
  format?: "currency" | "percent" | "number" | string;
  currencyCode?: string;
  prefix?: string;
  suffix?: string;
  precision?: number;
  thousandSeparator?: boolean | string;
  allowNegative?: boolean;
  padDecimals?: boolean;
}

export interface DateFieldConfig<TRecord = Record<string, unknown>> extends BaseFieldConfig<TRecord> {
  type: "date" | "datetime";
  default?: string | Date | (() => string | Date);
  format?: string;
}

export interface BooleanFieldConfig<TRecord = Record<string, unknown>> extends BaseFieldConfig<TRecord> {
  type: "boolean";
  default?: boolean | (() => boolean);
  inlineToggle?: boolean;
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
  subtitleKey?: string;
  searchable?: boolean;
  pageSize?: number;
  debounceMs?: number;
  endpoint?: string;
  filterParams?: Record<string, unknown>;
  clearable?: boolean;
  createInline?: boolean;
  createTitle?: string;
  createDescription?: string;
  createCollection?: any;
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

/**
 * Standard media asset representation across HonoCube media library and image pickers.
 */
export interface MediaAsset {
  id: string;
  url: string;
  name: string;
  size?: number;
  mimeType?: string;
  width?: number;
  height?: number;
  alt?: string;
  uploadedAt?: string;
  thumbnailUrl?: string;
}

export interface MediaFieldConfig<TRecord = Record<string, unknown>> extends BaseFieldConfig<TRecord> {
  type: "media" | "image";
  multiple?: boolean;
  accept?: string;
  maxSize?: number;
  uploadEndpoint?: string;
  default?: string | string[] | MediaAsset | MediaAsset[] | (() => any);
}

export interface DateRangeValue {
  from?: string | Date;
  to?: string | Date;
}

export interface DateRangeFieldConfig<TRecord = Record<string, unknown>> extends BaseFieldConfig<TRecord> {
  type: "daterange";
  default?: DateRangeValue | (() => DateRangeValue);
  includeTime?: boolean;
  format?: string;
  presets?: boolean | string[];
}

export interface PhoneFieldConfig<TRecord = Record<string, unknown>> extends BaseFieldConfig<TRecord> {
  type: "phone";
  default?: string | (() => string);
  defaultCountry?: string;
  allowedCountries?: string[];
  preferredCountries?: string[];
}

export interface ColorFieldConfig<TRecord = Record<string, unknown>> extends BaseFieldConfig<TRecord> {
  type: "color";
  default?: string | (() => string);
  presets?: string[];
  format?: "hex" | "rgb" | "hsl";
}

export interface IconFieldConfig<TRecord = Record<string, unknown>> extends BaseFieldConfig<TRecord> {
  type: "icon";
  default?: string | (() => string);
  icons?: string[];
}

export interface TagsFieldConfig<TRecord = Record<string, unknown>> extends BaseFieldConfig<TRecord> {
  type: "tags";
  default?: string[] | (() => string[]);
  maxTags?: number;
  suggestions?: string[];
  delimiters?: string[];
  allowDuplicates?: boolean;
}

export interface SlugFieldConfig<TRecord = Record<string, unknown>> extends BaseFieldConfig<TRecord> {
  type: "slug";
  default?: string | (() => string);
  /**
   * Source field name to automatically derive the slug from (e.g. 'title' or 'name').
   */
  from?: keyof TRecord | string;
  /**
   * Character used to delimit slug segments. Defaults to '-'.
   */
  separator?: string;
  /**
   * Whether to transform the slug to lowercase. Defaults to true.
   */
  lowercase?: boolean;
  /**
   * Whether the slug should start locked against auto-updates from the source field.
   */
  locked?: boolean;
  /**
   * Custom slug transformation function.
   */
  slugify?: (text: string) => string;
}

export interface BarcodeFieldConfig<TRecord = Record<string, unknown>> extends BaseFieldConfig<TRecord> {
  type: "barcode";
  default?: string | (() => string);
  format?: "code128" | "code39" | "ean13" | "upca";
  displayValue?: boolean;
  width?: number;
  height?: number;
}

export interface QRCodeFieldConfig<TRecord = Record<string, unknown>> extends BaseFieldConfig<TRecord> {
  type: "qrcode";
  default?: string | (() => string);
  size?: number;
  level?: "L" | "M" | "Q" | "H";
  includeMargin?: boolean;
}

export interface SignatureFieldConfig<TRecord = Record<string, unknown>> extends BaseFieldConfig<TRecord> {
  type: "signature";
  default?: string | (() => string);
  penColor?: string;
  backgroundColor?: string;
  penWidth?: number;
  width?: number;
  height?: number;
  format?: "image/png" | "image/svg+xml" | "image/jpeg";
  signerNameField?: string;
  signedAtField?: string;
}

export type RichTextToolbarTool =
  | "headings"
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "bulletList"
  | "orderedList"
  | "blockquote"
  | "codeBlock"
  | "link"
  | "clear";

export interface RichTextFieldConfig<TRecord = Record<string, unknown>> extends BaseFieldConfig<TRecord> {
  type: "richtext";
  default?: string | (() => string);
  toolbar?: RichTextToolbarTool[];
  minHeight?: number;
  maxHeight?: number;
  format?: "html" | "markdown" | "json";
}

export interface RepeaterFieldConfig<TRecord = Record<string, unknown>> extends BaseFieldConfig<TRecord> {
  type: "repeater";
  fields?: Record<string, any>;
  schema?: Record<string, any>;
  minItems?: number;
  maxItems?: number;
  layout?: "table" | "cards" | "stack";
  addButtonText?: string;
  itemLabel?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  allowReorder?: boolean;
  allowClone?: boolean;
  default?: any[] | (() => any[]);
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
  | ComputedFieldConfig<any, TRecord>
  | MediaFieldConfig<TRecord>
  | DateRangeFieldConfig<TRecord>
  | PhoneFieldConfig<TRecord>
  | ColorFieldConfig<TRecord>
  | IconFieldConfig<TRecord>
  | TagsFieldConfig<TRecord>
  | SlugFieldConfig<TRecord>
  | BarcodeFieldConfig<TRecord>
  | QRCodeFieldConfig<TRecord>
  | SignatureFieldConfig<TRecord>
  | RichTextFieldConfig<TRecord>
  | RepeaterFieldConfig<TRecord>;

export type InferFieldValue<TField> = TField extends { build(): infer TBuilt }
  ? InferFieldValue<TBuilt>
  : TField extends { type: "repeater" }
  ? Record<string, any>[]
  : TField extends { type: "daterange" }
  ? DateRangeValue
  : TField extends { type: "tags" }
  ? string[]
  : TField extends { type: "text" | "textarea" | "series" | "slug" | "color" | "icon" | "phone" | "barcode" | "qrcode" | "signature" | "richtext" }
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
  : TField extends { type: "media" | "image"; multiple: true }
  ? string[] | MediaAsset[]
  : TField extends { type: "media" | "image" }
  ? string | MediaAsset
  : unknown;
