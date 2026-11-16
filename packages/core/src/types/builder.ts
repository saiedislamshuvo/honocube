import type {
  BaseFieldConfig,
  TextFieldConfig,
  NumberFieldConfig,
  DateFieldConfig,
  BooleanFieldConfig,
  SelectFieldConfig,
  SelectOption,
  JsonFieldConfig,
  SeriesFieldConfig,
  RelationFieldConfig,
  SubCollectionFieldConfig,
  ComputedFieldConfig,
  MediaFieldConfig,
  DateRangeFieldConfig,
  DateRangeValue,
  PhoneFieldConfig,
  ColorFieldConfig,
  IconFieldConfig,
  TagsFieldConfig,
  SlugFieldConfig,
  BarcodeFieldConfig,
  QRCodeFieldConfig,
  SignatureFieldConfig,
  RichTextFieldConfig,
  RichTextToolbarTool,
  DynamicRule,
} from "./fields.js";
import type { CollectionConfig } from "./collection.js";

/**
 * Common interface for all fluent field builders.
 */
export interface IFieldBuilder<
  TConfig extends BaseFieldConfig<TRecord> = BaseFieldConfig<any>,
  TValue = any,
  TRecord = Record<string, unknown>
> {
  readonly _isFieldBuilder: true;
  readonly type: TConfig extends { type: infer TType } ? TType : string;
  readonly config: TConfig;

  build(): TConfig;
  toConfig(): TConfig;
  toJSON(): TConfig;
  clone(): this;

  label(label: string): this;
  description(description: string): this;
  required(required?: boolean): this;
  optional(): this;
  readOnly(readOnly?: boolean): this;
  placeholder(placeholder: string): this;
  default(defaultValue: TValue | (() => TValue)): this;
  disabled(rule: DynamicRule<boolean, TRecord>): this;
  visible(rule: DynamicRule<boolean, TRecord>): this;
}

/**
 * Fluent builder for string and text area fields.
 */
export interface ITextFieldBuilder<TRecord = Record<string, unknown>>
  extends IFieldBuilder<TextFieldConfig<TRecord>, string, TRecord> {
  pattern(pattern: string): this;
  textarea(): this;
}

/**
 * Fluent builder for numeric and currency fields.
 */
export interface INumberFieldBuilder<TRecord = Record<string, unknown>>
  extends IFieldBuilder<NumberFieldConfig<TRecord>, number, TRecord> {
  min(min: number): this;
  max(max: number): this;
  step(step: number): this;
  format(format: "currency" | "percent" | "number" | string): this;
  currencyCode(currencyCode: string): this;
  currency(currencyCode?: string): this;
  percent(): this;
  precision(precision: number): this;
  prefix(prefix: string): this;
  suffix(suffix: string): this;
  thousandSeparator(separator?: boolean | string): this;
  allowNegative(allow?: boolean): this;
  padDecimals(pad?: boolean): this;
}

/**
 * Fluent builder for select enum and dropdown fields.
 */
export interface ISelectFieldBuilder<TValue = string, TRecord = Record<string, unknown>>
  extends IFieldBuilder<SelectFieldConfig<TValue, TRecord>, TValue, TRecord> {
  options(options: Array<TValue | SelectOption<TValue>>): this;
  addOption(option: TValue | SelectOption<TValue>): this;
  getOptions(): Array<TValue | SelectOption<TValue>>;
}

/**
 * Fluent builder for date and datetime fields.
 */
export interface IDateFieldBuilder<TRecord = Record<string, unknown>>
  extends IFieldBuilder<DateFieldConfig<TRecord>, string | Date, TRecord> {
  format(format: string): this;
  datetime(): this;
}

/**
 * Fluent builder for boolean toggle and checkbox fields.
 */
export type IBooleanFieldBuilder<TRecord = Record<string, unknown>> = IFieldBuilder<
  BooleanFieldConfig<TRecord>,
  boolean,
  TRecord
>;

/**
 * Fluent builder for relational foreign key fields.
 */
export interface IRelationFieldBuilder<TRecord = Record<string, unknown>>
  extends IFieldBuilder<RelationFieldConfig<TRecord>, string | number, TRecord> {
  target(target: string): this;
  valueKey(valueKey: string): this;
  labelKey(labelKey: string): this;
  searchable(searchable?: boolean): this;
  getTarget(): string;
}

/**
 * Fluent builder for computed / virtual fields.
 */
export interface IComputedFieldBuilder<TReturn = any, TRecord = Record<string, unknown>>
  extends IFieldBuilder<ComputedFieldConfig<TReturn, TRecord>, TReturn, TRecord> {
  compute(fn: (record: TRecord, parentRecord?: any) => TReturn): this;
}

/**
 * Fluent builder for raw JSON data fields.
 */
export type IJsonFieldBuilder<TRecord = Record<string, unknown>> = IFieldBuilder<
  JsonFieldConfig<TRecord>,
  unknown,
  TRecord
>;

/**
 * Fluent builder for auto-incrementing naming series fields.
 */
export interface ISeriesFieldBuilder<TRecord = Record<string, unknown>>
  extends IFieldBuilder<SeriesFieldConfig<TRecord>, string, TRecord> {
  prefix(prefix: string): this;
}

/**
 * Fluent builder for embedded child collections / tables.
 */
export interface ISubCollectionFieldBuilder<
  TChildCollection extends CollectionConfig<any> = CollectionConfig<any>,
  TRecord = Record<string, unknown>
> extends IFieldBuilder<SubCollectionFieldConfig<TChildCollection, TRecord>, any, TRecord> {
  relation(rel: "hasMany" | "hasOne"): this;
  inline(inline?: boolean): this;
}

/**
 * Fluent builder for media library and image picker fields.
 */
export interface IMediaFieldBuilder<TRecord = Record<string, unknown>>
  extends IFieldBuilder<MediaFieldConfig<TRecord>, any, TRecord> {
  multiple(multiple?: boolean): this;
  accept(acceptTypes: string): this;
  maxSize(bytes: number): this;
  uploadEndpoint(endpoint: string): this;
}

/**
 * Fluent builder for date range and datetime range fields.
 */
export interface IDateRangeFieldBuilder<TRecord = Record<string, unknown>>
  extends IFieldBuilder<DateRangeFieldConfig<TRecord>, DateRangeValue, TRecord> {
  includeTime(include?: boolean): this;
  format(formatString: string): this;
  presets(presetList: boolean | string[]): this;
}

/**
 * Fluent builder for international phone input fields.
 */
export interface IPhoneFieldBuilder<TRecord = Record<string, unknown>>
  extends IFieldBuilder<PhoneFieldConfig<TRecord>, string, TRecord> {
  defaultCountry(isoCode: string): this;
  allowedCountries(isoCodes: string[]): this;
  preferredCountries(isoCodes: string[]): this;
}

/**
 * Fluent builder for visual color picker fields.
 */
export interface IColorFieldBuilder<TRecord = Record<string, unknown>>
  extends IFieldBuilder<ColorFieldConfig<TRecord>, string, TRecord> {
  presets(swatches: string[]): this;
  format(fmt: "hex" | "rgb" | "hsl"): this;
}

/**
 * Fluent builder for icon picker fields.
 */
export interface IIconFieldBuilder<TRecord = Record<string, unknown>>
  extends IFieldBuilder<IconFieldConfig<TRecord>, string, TRecord> {
  icons(iconList: string[]): this;
}

/**
 * Fluent builder for tags and multi-chip input fields.
 */
export interface ITagsFieldBuilder<TRecord = Record<string, unknown>>
  extends IFieldBuilder<TagsFieldConfig<TRecord>, string[], TRecord> {
  maxTags(count: number): this;
  suggestions(suggestions: string[]): this;
  delimiters(delimiters: string[]): this;
  allowDuplicates(allow?: boolean): this;
}

/**
 * Fluent builder for URL-friendly slug fields.
 */
export interface ISlugFieldBuilder<TRecord = Record<string, unknown>>
  extends IFieldBuilder<SlugFieldConfig<TRecord>, string, TRecord> {
  from(sourceField: keyof TRecord | string): this;
  separator(sep: string): this;
  lowercase(enable?: boolean): this;
  locked(isLocked?: boolean): this;
  slugify(fn: (text: string) => string): this;
}

/**
 * Fluent builder for scannable 1D barcode fields.
 */
export interface IBarcodeFieldBuilder<TRecord = Record<string, unknown>>
  extends IFieldBuilder<BarcodeFieldConfig<TRecord>, string, TRecord> {
  format(fmt: "code128" | "code39" | "ean13" | "upca"): this;
  displayValue(display?: boolean): this;
  width(barWidth: number): this;
  height(barHeight: number): this;
}

/**
 * Fluent builder for 2D QR code fields.
 */
export interface IQRCodeFieldBuilder<TRecord = Record<string, unknown>>
  extends IFieldBuilder<QRCodeFieldConfig<TRecord>, string, TRecord> {
  size(pixelSize: number): this;
  level(ecl: "L" | "M" | "Q" | "H"): this;
  includeMargin(margin?: boolean): this;
}

/**
 * Fluent builder for handwritten digital signature capture fields.
 */
export interface ISignatureFieldBuilder<TRecord = Record<string, unknown>>
  extends IFieldBuilder<SignatureFieldConfig<TRecord>, string, TRecord> {
  penColor(color: string): this;
  backgroundColor(color: string): this;
  penWidth(width: number): this;
  dimensions(width: number, height: number): this;
  format(fmt: "image/png" | "image/svg+xml" | "image/jpeg"): this;
  signerNameField(fieldName: string): this;
  signedAtField(fieldName: string): this;
}

/**
 * Fluent builder for rich text WYSIWYG formatted content fields.
 */
export interface IRichTextFieldBuilder<TRecord = Record<string, unknown>>
  extends IFieldBuilder<RichTextFieldConfig<TRecord>, string, TRecord> {
  toolbar(tools: RichTextToolbarTool[]): this;
  minHeight(pixels: number): this;
  maxHeight(pixels: number): this;
  format(fmt: "html" | "markdown" | "json"): this;
}
