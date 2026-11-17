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
  FieldConfig,
  DynamicRule,
} from "../types/fields.js";
import type { CollectionConfig } from "../types/collection.js";
import type {
  IFieldBuilder,
  ITextFieldBuilder,
  INumberFieldBuilder,
  ISelectFieldBuilder,
  IDateFieldBuilder,
  IBooleanFieldBuilder,
  IRelationFieldBuilder,
  IComputedFieldBuilder,
  IJsonFieldBuilder,
  ISeriesFieldBuilder,
  ISubCollectionFieldBuilder,
  IMediaFieldBuilder,
  IDateRangeFieldBuilder,
  IPhoneFieldBuilder,
  IColorFieldBuilder,
  IIconFieldBuilder,
  ITagsFieldBuilder,
  ISlugFieldBuilder,
  IBarcodeFieldBuilder,
  IQRCodeFieldBuilder,
  ISignatureFieldBuilder,
} from "../types/builder.js";

/**
 * Base field builder implementing fluent chaining for shared field properties.
 */
export class BaseFieldBuilder<
  TConfig extends BaseFieldConfig<TRecord> = BaseFieldConfig<any>,
  TValue = any,
  TRecord = Record<string, unknown>
> implements IFieldBuilder<TConfig, TValue, TRecord> {
  readonly _isFieldBuilder = true as const;
  protected _config: TConfig;

  get type(): TConfig extends { type: infer TType } ? TType : string {
    return (this._config as any).type;
  }

  get config(): TConfig {
    return { ...this._config };
  }

  constructor(initialConfig: TConfig) {
    this._config = { ...initialConfig };
  }

  protected _set<K extends keyof TConfig>(key: K, value: TConfig[K]): this {
    this._config[key] = value;
    return this;
  }

  label(label: string): this {
    return this._set("label" as any, label as any);
  }

  description(description: string): this {
    return this._set("description" as any, description as any);
  }

  required(required: boolean = true): this {
    return this._set("required" as any, required as any);
  }

  optional(): this {
    return this._set("required" as any, false as any);
  }

  readOnly(readOnly: boolean = true): this {
    return this._set("readOnly" as any, readOnly as any);
  }

  placeholder(placeholder: string): this {
    return this._set("placeholder" as any, placeholder as any);
  }

  default(defaultValue: TValue | (() => TValue)): this {
    return this._set("default" as any, defaultValue as any);
  }

  disabled(rule: DynamicRule<boolean, TRecord>): this {
    return this._set("disabled" as any, rule as any);
  }

  visible(rule: DynamicRule<boolean, TRecord>): this {
    return this._set("visible" as any, rule as any);
  }

  build(): TConfig {
    return { ...this._config };
  }

  toConfig(): TConfig {
    return { ...this._config };
  }

  toJSON(): TConfig {
    return { ...this._config };
  }

  clone(): this {
    const Cls = this.constructor as new (cfg: TConfig) => this;
    return new Cls({ ...this._config });
  }

  toString(): string {
    return `[HonoCube FieldBuilder: ${(this._config as any).type || "unknown"}]`;
  }
}

/**
 * Text and Textarea field builder.
 */
export class TextFieldBuilder<TRecord = Record<string, unknown>>
  extends BaseFieldBuilder<TextFieldConfig<TRecord>, string, TRecord>
  implements ITextFieldBuilder<TRecord> {
  pattern(pattern: string): this {
    return this._set("pattern" as any, pattern as any);
  }

  textarea(): this {
    return this._set("type" as any, "textarea" as any);
  }
}

/**
 * Number and Currency field builder.
 */
export class NumberFieldBuilder<TRecord = Record<string, unknown>>
  extends BaseFieldBuilder<NumberFieldConfig<TRecord>, number, TRecord>
  implements INumberFieldBuilder<TRecord> {
  min(min: number): this {
    return this._set("min" as any, min as any);
  }

  max(max: number): this {
    return this._set("max" as any, max as any);
  }

  step(step: number): this {
    return this._set("step" as any, step as any);
  }

  format(format: "currency" | "percent" | "number" | string): this {
    return this._set("format" as any, format as any);
  }

  currencyCode(currencyCode: string): this {
    return this._set("currencyCode" as any, currencyCode as any);
  }

  currency(currencyCode: string = "USD"): this {
    this._set("type" as any, "currency" as any);
    this._set("format" as any, "currency" as any);
    this._set("currencyCode" as any, currencyCode as any);
    return this;
  }

  percent(): this {
    this._set("format" as any, "percent" as any);
    if (!this._config.suffix) {
      this._set("suffix" as any, "%" as any);
    }
    return this;
  }

  precision(precision: number): this {
    return this._set("precision" as any, precision as any);
  }

  prefix(prefix: string): this {
    return this._set("prefix" as any, prefix as any);
  }

  suffix(suffix: string): this {
    return this._set("suffix" as any, suffix as any);
  }

  thousandSeparator(separator: boolean | string = true): this {
    return this._set("thousandSeparator" as any, separator as any);
  }

  allowNegative(allow: boolean = true): this {
    return this._set("allowNegative" as any, allow as any);
  }

  padDecimals(pad: boolean = true): this {
    return this._set("padDecimals" as any, pad as any);
  }
}

/**
 * Select enum and dropdown field builder.
 */
export class SelectFieldBuilder<TValue = string, TRecord = Record<string, unknown>>
  extends BaseFieldBuilder<SelectFieldConfig<TValue, TRecord>, TValue, TRecord>
  implements ISelectFieldBuilder<TValue, TRecord> {
  options(options: Array<TValue | SelectOption<TValue>>): this {
    this._set("options" as any, [...options] as any);
    return this;
  }

  addOption(option: TValue | SelectOption<TValue>): this {
    const current = this._config.options || [];
    this._set("options" as any, [...current, option] as any);
    return this;
  }

  getOptions(): Array<TValue | SelectOption<TValue>> {
    return [...(this._config.options || [])];
  }
}

/**
 * Date and Datetime field builder.
 */
export class DateFieldBuilder<TRecord = Record<string, unknown>>
  extends BaseFieldBuilder<DateFieldConfig<TRecord>, string | Date, TRecord>
  implements IDateFieldBuilder<TRecord> {
  format(format: string): this {
    return this._set("format" as any, format as any);
  }

  datetime(): this {
    return this._set("type" as any, "datetime" as any);
  }
}

/**
 * Boolean toggle field builder.
 */
export class BooleanFieldBuilder<TRecord = Record<string, unknown>>
  extends BaseFieldBuilder<BooleanFieldConfig<TRecord>, boolean, TRecord>
  implements IBooleanFieldBuilder<TRecord> {}

/**
 * Relational picker field builder.
 */
export class RelationFieldBuilder<TRecord = Record<string, unknown>>
  extends BaseFieldBuilder<RelationFieldConfig<TRecord>, string | number, TRecord>
  implements IRelationFieldBuilder<TRecord> {
  target(target: string): this {
    return this._set("target" as any, target as any);
  }

  valueKey(valueKey: string): this {
    return this._set("valueKey" as any, valueKey as any);
  }

  labelKey(labelKey: string): this {
    return this._set("labelKey" as any, labelKey as any);
  }

  searchable(searchable: boolean = true): this {
    return this._set("searchable" as any, searchable as any);
  }

  getTarget(): string {
    return this._config.target;
  }
}

/**
 * Computed / virtual field builder.
 */
export class ComputedFieldBuilder<TReturn = any, TRecord = Record<string, unknown>>
  extends BaseFieldBuilder<ComputedFieldConfig<TReturn, TRecord>, TReturn, TRecord>
  implements IComputedFieldBuilder<TReturn, TRecord> {
  compute(fn: (record: TRecord, parentRecord?: any) => TReturn): this {
    return this._set("compute" as any, fn as any);
  }
}

/**
 * JSON field builder.
 */
export class JsonFieldBuilder<TRecord = Record<string, unknown>>
  extends BaseFieldBuilder<JsonFieldConfig<TRecord>, unknown, TRecord>
  implements IJsonFieldBuilder<TRecord> {}

/**
 * Auto-numbering series field builder.
 */
export class SeriesFieldBuilder<TRecord = Record<string, unknown>>
  extends BaseFieldBuilder<SeriesFieldConfig<TRecord>, string, TRecord>
  implements ISeriesFieldBuilder<TRecord> {
  prefix(prefix: string): this {
    return this._set("prefix" as any, prefix as any);
  }
}

/**
 * Child collection / embedded table field builder.
 */
export class SubCollectionFieldBuilder<
  TChildCollection extends CollectionConfig<any> = CollectionConfig<any>,
  TRecord = Record<string, unknown>
> extends BaseFieldBuilder<SubCollectionFieldConfig<TChildCollection, TRecord>, any, TRecord>
  implements ISubCollectionFieldBuilder<TChildCollection, TRecord> {
  relation(rel: "hasMany" | "hasOne"): this {
    return this._set("relation" as any, rel as any);
  }

  inline(inline: boolean = true): this {
    return this._set("inline" as any, inline as any);
  }
}

/**
 * Media library and image picker field builder.
 */
export class MediaFieldBuilder<TRecord = Record<string, unknown>>
  extends BaseFieldBuilder<MediaFieldConfig<TRecord>, any, TRecord>
  implements IMediaFieldBuilder<TRecord> {
  multiple(multiple: boolean = true): this {
    return this._set("multiple" as any, multiple as any);
  }

  accept(acceptTypes: string): this {
    return this._set("accept" as any, acceptTypes as any);
  }

  maxSize(bytes: number): this {
    return this._set("maxSize" as any, bytes as any);
  }

  uploadEndpoint(endpoint: string): this {
    return this._set("uploadEndpoint" as any, endpoint as any);
  }
}

/**
 * Date range and datetime range field builder.
 */
export class DateRangeFieldBuilder<TRecord = Record<string, unknown>>
  extends BaseFieldBuilder<DateRangeFieldConfig<TRecord>, DateRangeValue, TRecord>
  implements IDateRangeFieldBuilder<TRecord> {
  includeTime(include: boolean = true): this {
    return this._set("includeTime" as any, include as any);
  }

  format(formatString: string): this {
    return this._set("format" as any, formatString as any);
  }

  presets(presetList: boolean | string[]): this {
    return this._set("presets" as any, presetList as any);
  }
}

/**
 * International telephone input field builder.
 */
export class PhoneFieldBuilder<TRecord = Record<string, unknown>>
  extends BaseFieldBuilder<PhoneFieldConfig<TRecord>, string, TRecord>
  implements IPhoneFieldBuilder<TRecord> {
  defaultCountry(isoCode: string): this {
    return this._set("defaultCountry" as any, isoCode as any);
  }

  allowedCountries(isoCodes: string[]): this {
    return this._set("allowedCountries" as any, [...isoCodes] as any);
  }

  preferredCountries(isoCodes: string[]): this {
    return this._set("preferredCountries" as any, [...isoCodes] as any);
  }
}

/**
 * Visual color picker field builder.
 */
export class ColorFieldBuilder<TRecord = Record<string, unknown>>
  extends BaseFieldBuilder<ColorFieldConfig<TRecord>, string, TRecord>
  implements IColorFieldBuilder<TRecord> {
  presets(swatches: string[]): this {
    return this._set("presets" as any, [...swatches] as any);
  }

  format(fmt: "hex" | "rgb" | "hsl"): this {
    return this._set("format" as any, fmt as any);
  }
}

/**
 * Icon picker field builder.
 */
export class IconFieldBuilder<TRecord = Record<string, unknown>>
  extends BaseFieldBuilder<IconFieldConfig<TRecord>, string, TRecord>
  implements IIconFieldBuilder<TRecord> {
  icons(iconList: string[]): this {
    return this._set("icons" as any, [...iconList] as any);
  }
}

/**
 * Tags and chip multi-select field builder.
 */
export class TagsFieldBuilder<TRecord = Record<string, unknown>>
  extends BaseFieldBuilder<TagsFieldConfig<TRecord>, string[], TRecord>
  implements ITagsFieldBuilder<TRecord> {
  maxTags(count: number): this {
    return this._set("maxTags" as any, count as any);
  }

  suggestions(items: string[]): this {
    return this._set("suggestions" as any, [...items] as any);
  }

  delimiters(delims: string[]): this {
    return this._set("delimiters" as any, [...delims] as any);
  }

  allowDuplicates(allow: boolean = true): this {
    return this._set("allowDuplicates" as any, allow as any);
  }
}

/**
 * URL-friendly slug field builder.
 */
export class SlugFieldBuilder<TRecord = Record<string, unknown>>
  extends BaseFieldBuilder<SlugFieldConfig<TRecord>, string, TRecord>
  implements ISlugFieldBuilder<TRecord> {
  from(sourceField: keyof TRecord | string): this {
    return this._set("from" as any, sourceField as any);
  }

  separator(sep: string): this {
    return this._set("separator" as any, sep as any);
  }

  lowercase(enable: boolean = true): this {
    return this._set("lowercase" as any, enable as any);
  }

  locked(isLocked: boolean = true): this {
    return this._set("locked" as any, isLocked as any);
  }

  slugify(fn: (text: string) => string): this {
    return this._set("slugify" as any, fn as any);
  }
}

/**
 * Scannable 1D barcode field builder.
 */
export class BarcodeFieldBuilder<TRecord = Record<string, unknown>>
  extends BaseFieldBuilder<BarcodeFieldConfig<TRecord>, string, TRecord>
  implements IBarcodeFieldBuilder<TRecord> {
  format(fmt: "code128" | "code39" | "ean13" | "upca"): this {
    return this._set("format" as any, fmt as any);
  }

  displayValue(display: boolean = true): this {
    return this._set("displayValue" as any, display as any);
  }

  width(w: number): this {
    return this._set("width" as any, w as any);
  }

  height(h: number): this {
    return this._set("height" as any, h as any);
  }
}

/**
 * 2D QR code field builder.
 */
export class QRCodeFieldBuilder<TRecord = Record<string, unknown>>
  extends BaseFieldBuilder<QRCodeFieldConfig<TRecord>, string, TRecord>
  implements IQRCodeFieldBuilder<TRecord> {
  size(pixelSize: number): this {
    return this._set("size" as any, pixelSize as any);
  }

  level(ecl: "L" | "M" | "Q" | "H"): this {
    return this._set("level" as any, ecl as any);
  }

  includeMargin(margin: boolean = true): this {
    return this._set("includeMargin" as any, margin as any);
  }
}

/**
 * Handwritten digital signature capture field builder.
 */
export class SignatureFieldBuilder<TRecord = Record<string, unknown>>
  extends BaseFieldBuilder<SignatureFieldConfig<TRecord>, string, TRecord>
  implements ISignatureFieldBuilder<TRecord> {
  penColor(color: string): this {
    return this._set("penColor" as any, color as any);
  }

  backgroundColor(color: string): this {
    return this._set("backgroundColor" as any, color as any);
  }

  penWidth(width: number): this {
    return this._set("penWidth" as any, width as any);
  }

  dimensions(width: number, height: number): this {
    this._set("width" as any, width as any);
    return this._set("height" as any, height as any);
  }

  format(fmt: "image/png" | "image/svg+xml" | "image/jpeg"): this {
    return this._set("format" as any, fmt as any);
  }

  signerNameField(fieldName: string): this {
    return this._set("signerNameField" as any, fieldName as any);
  }

  signedAtField(fieldName: string): this {
    return this._set("signedAtField" as any, fieldName as any);
  }
}

/**
 * Duck-type check if a value is an instance of a FieldBuilder.
 */
export function isFieldBuilder(value: unknown): value is IFieldBuilder<any, any, any> {
  return (
    typeof value === "object" &&
    value !== null &&
    (Boolean((value as any)._isFieldBuilder) ||
      typeof (value as any).build === "function" ||
      typeof (value as any).toConfig === "function")
  );
}

/**
 * Unwraps a FieldBuilder into its underlying FieldConfig object, or returns the config directly.
 */
export function unwrapFieldConfig(field: unknown): FieldConfig<any> {
  if (isFieldBuilder(field)) {
    return field.build();
  }
  return field as FieldConfig<any>;
}

/**
 * Generic field builder constructor helper.
 */
function createFieldBuilder<TConfig extends FieldConfig<any>>(
  config: TConfig
): BaseFieldBuilder<TConfig> {
  return new BaseFieldBuilder(config);
}

/**
 * Fluent field builder factory `f` (and alias `field`).
 */
export const f = Object.assign(createFieldBuilder, {
  /**
   * Fluent builder for text string fields.
   */
  text(labelOrConfig?: string | Partial<TextFieldConfig>): TextFieldBuilder {
    let cfg: TextFieldConfig = { type: "text" };
    if (typeof labelOrConfig === "string") {
      cfg.label = labelOrConfig;
    } else if (labelOrConfig && typeof labelOrConfig === "object") {
      cfg = { ...cfg, ...labelOrConfig };
    }
    return new TextFieldBuilder(cfg);
  },

  /**
   * Fluent builder for multi-line textarea fields.
   */
  textarea(labelOrConfig?: string | Partial<TextFieldConfig>): TextFieldBuilder {
    let cfg: TextFieldConfig = { type: "textarea" };
    if (typeof labelOrConfig === "string") {
      cfg.label = labelOrConfig;
    } else if (labelOrConfig && typeof labelOrConfig === "object") {
      cfg = { ...cfg, ...labelOrConfig, type: "textarea" };
    }
    return new TextFieldBuilder(cfg);
  },

  /**
   * Fluent builder for numeric fields.
   */
  number(labelOrConfig?: string | Partial<NumberFieldConfig>): NumberFieldBuilder {
    let cfg: NumberFieldConfig = { type: "number" };
    if (typeof labelOrConfig === "string") {
      cfg.label = labelOrConfig;
    } else if (labelOrConfig && typeof labelOrConfig === "object") {
      cfg = { ...cfg, ...labelOrConfig };
    }
    return new NumberFieldBuilder(cfg);
  },

  /**
   * Fluent builder for currency fields (with default format and USD currencyCode).
   */
  currency(
    labelOrConfig?: string | (Partial<NumberFieldConfig> & { min?: number; max?: number })
  ): NumberFieldBuilder {
    let cfg: NumberFieldConfig = {
      type: "currency",
      format: "currency",
      currencyCode: "USD",
    };
    if (typeof labelOrConfig === "string") {
      cfg.label = labelOrConfig;
    } else if (labelOrConfig && typeof labelOrConfig === "object") {
      cfg = { ...cfg, ...labelOrConfig };
    }
    return new NumberFieldBuilder(cfg);
  },

  /**
   * Fluent builder for percentage fields (with format="percent" and suffix="%").
   */
  percent(labelOrConfig?: string | Partial<NumberFieldConfig>): NumberFieldBuilder {
    let cfg: NumberFieldConfig = {
      type: "number",
      format: "percent",
      suffix: "%",
    };
    if (typeof labelOrConfig === "string") {
      cfg.label = labelOrConfig;
    } else if (labelOrConfig && typeof labelOrConfig === "object") {
      cfg = { ...cfg, ...labelOrConfig };
    }
    return new NumberFieldBuilder(cfg);
  },

  /**
   * Fluent builder for select dropdown and enum options.
   */
  select<const TOption extends string | number | SelectOption<any>>(
    labelOrOptionsOrConfig?:
      | readonly TOption[]
      | string
      | (Partial<SelectFieldConfig<TOption extends SelectOption<infer V> ? V : TOption>> & {
          options?: readonly TOption[];
        }),
    optionsOrLabel?: readonly TOption[] | string
  ): SelectFieldBuilder<TOption extends SelectOption<infer V> ? V : TOption> {
    type TVal = TOption extends SelectOption<infer V> ? V : TOption;
    let cfg: SelectFieldConfig<TVal> = {
      type: "select",
      options: [],
    };

    if (Array.isArray(labelOrOptionsOrConfig)) {
      cfg.options = [...labelOrOptionsOrConfig] as any;
      if (typeof optionsOrLabel === "string") {
        cfg.label = optionsOrLabel;
      }
    } else if (typeof labelOrOptionsOrConfig === "string") {
      cfg.label = labelOrOptionsOrConfig;
      if (Array.isArray(optionsOrLabel)) {
        cfg.options = [...optionsOrLabel] as any;
      }
    } else if (labelOrOptionsOrConfig && typeof labelOrOptionsOrConfig === "object") {
      cfg = { ...cfg, ...(labelOrOptionsOrConfig as any) };
    }

    return new SelectFieldBuilder(cfg as any);
  },

  /**
   * Fluent builder for date calendar fields.
   */
  date(labelOrConfig?: string | Partial<DateFieldConfig>): DateFieldBuilder {
    let cfg: DateFieldConfig = { type: "date" };
    if (typeof labelOrConfig === "string") {
      cfg.label = labelOrConfig;
    } else if (labelOrConfig && typeof labelOrConfig === "object") {
      cfg = { ...cfg, ...labelOrConfig };
    }
    return new DateFieldBuilder(cfg);
  },

  /**
   * Fluent builder for datetime calendar fields.
   */
  datetime(labelOrConfig?: string | Partial<DateFieldConfig>): DateFieldBuilder {
    let cfg: DateFieldConfig = { type: "datetime" };
    if (typeof labelOrConfig === "string") {
      cfg.label = labelOrConfig;
    } else if (labelOrConfig && typeof labelOrConfig === "object") {
      cfg = { ...cfg, ...labelOrConfig, type: "datetime" };
    }
    return new DateFieldBuilder(cfg);
  },

  /**
   * Fluent builder for boolean toggle fields.
   */
  boolean(labelOrConfig?: string | Partial<BooleanFieldConfig>): BooleanFieldBuilder {
    let cfg: BooleanFieldConfig = { type: "boolean" };
    if (typeof labelOrConfig === "string") {
      cfg.label = labelOrConfig;
    } else if (labelOrConfig && typeof labelOrConfig === "object") {
      cfg = { ...cfg, ...labelOrConfig };
    }
    return new BooleanFieldBuilder(cfg);
  },

  /**
   * Fluent builder for relational foreign key fields.
   */
  relation(
    targetOrConfig: string | Partial<RelationFieldConfig>,
    labelOrConfig?: string | Partial<RelationFieldConfig>
  ): RelationFieldBuilder {
    let cfg: RelationFieldConfig = {
      type: "relation",
      target: "",
    };
    if (typeof targetOrConfig === "string") {
      cfg.target = targetOrConfig;
      if (typeof labelOrConfig === "string") {
        cfg.label = labelOrConfig;
      } else if (labelOrConfig && typeof labelOrConfig === "object") {
        cfg = { ...cfg, ...labelOrConfig };
      }
    } else if (targetOrConfig && typeof targetOrConfig === "object") {
      cfg = { ...cfg, ...targetOrConfig };
    }
    return new RelationFieldBuilder(cfg);
  },

  /**
   * Fluent builder for computed / virtual fields.
   */
  computed<TReturn = any, TRecord = Record<string, unknown>>(
    computeOrLabelOrConfig:
      | ((record: TRecord, parentRecord?: any) => TReturn)
      | string
      | Partial<ComputedFieldConfig<TReturn, TRecord>>,
    computeOrLabel?: ((record: TRecord, parentRecord?: any) => TReturn) | string
  ): ComputedFieldBuilder<TReturn, TRecord> {
    let cfg: ComputedFieldConfig<TReturn, TRecord> = {
      type: "computed",
      compute: () => undefined as any,
    };
    if (typeof computeOrLabelOrConfig === "function") {
      cfg.compute = computeOrLabelOrConfig;
      if (typeof computeOrLabel === "string") {
        cfg.label = computeOrLabel;
      }
    } else if (typeof computeOrLabelOrConfig === "string") {
      cfg.label = computeOrLabelOrConfig;
      if (typeof computeOrLabel === "function") {
        cfg.compute = computeOrLabel;
      }
    } else if (computeOrLabelOrConfig && typeof computeOrLabelOrConfig === "object") {
      cfg = { ...cfg, ...computeOrLabelOrConfig };
    }
    return new ComputedFieldBuilder(cfg);
  },

  /**
   * Fluent builder for JSON data fields.
   */
  json(labelOrConfig?: string | Partial<JsonFieldConfig>): JsonFieldBuilder {
    let cfg: JsonFieldConfig = { type: "json" };
    if (typeof labelOrConfig === "string") {
      cfg.label = labelOrConfig;
    } else if (labelOrConfig && typeof labelOrConfig === "object") {
      cfg = { ...cfg, ...labelOrConfig };
    }
    return new JsonFieldBuilder(cfg);
  },

  /**
   * Fluent builder for auto-incrementing naming series fields.
   */
  series(prefixOrConfig: string | Partial<SeriesFieldConfig>, label?: string): SeriesFieldBuilder {
    let cfg: SeriesFieldConfig = {
      type: "series",
      prefix: "",
    };
    if (typeof prefixOrConfig === "string") {
      cfg.prefix = prefixOrConfig;
      if (label) cfg.label = label;
    } else if (prefixOrConfig && typeof prefixOrConfig === "object") {
      cfg = { ...cfg, ...prefixOrConfig };
    }
    return new SeriesFieldBuilder(cfg);
  },

  /**
   * Fluent builder for embedded child collections.
   */
  collection<TChild extends CollectionConfig<any>>(
    collectionOrConfig: TChild | Partial<SubCollectionFieldConfig<TChild>>,
    label?: string
  ): SubCollectionFieldBuilder<TChild> {
    let cfg: SubCollectionFieldConfig<TChild> = {
      type: "collection",
      collection: undefined as any,
      relation: "hasMany",
    };
    if (collectionOrConfig && typeof collectionOrConfig === "object") {
      if (
        "_isCollection" in collectionOrConfig ||
        ("name" in collectionOrConfig && "fields" in collectionOrConfig)
      ) {
        cfg.collection = collectionOrConfig as TChild;
        if (label) cfg.label = label;
      } else {
        cfg = { ...cfg, ...(collectionOrConfig as any) };
      }
    }
    return new SubCollectionFieldBuilder(cfg);
  },

  /**
   * Fluent builder for single or multiple image picker fields.
   */
  image(labelOrConfig?: string | Partial<MediaFieldConfig>, label?: string): MediaFieldBuilder {
    let cfg: MediaFieldConfig = {
      type: "image",
      accept: "image/*",
    };
    if (typeof labelOrConfig === "string") {
      cfg.label = labelOrConfig;
    } else if (labelOrConfig && typeof labelOrConfig === "object") {
      cfg = { ...cfg, ...labelOrConfig };
    }
    if (label) cfg.label = label;
    return new MediaFieldBuilder(cfg);
  },

  /**
   * Fluent builder for general media and file asset fields.
   */
  media(labelOrConfig?: string | Partial<MediaFieldConfig>, label?: string): MediaFieldBuilder {
    let cfg: MediaFieldConfig = {
      type: "media",
    };
    if (typeof labelOrConfig === "string") {
      cfg.label = labelOrConfig;
    } else if (labelOrConfig && typeof labelOrConfig === "object") {
      cfg = { ...cfg, ...labelOrConfig };
    }
    if (label) cfg.label = label;
    return new MediaFieldBuilder(cfg);
  },

  /**
   * Fluent builder for date range and datetime range fields.
   */
  dateRange(
    labelOrConfig?: string | Partial<DateRangeFieldConfig>,
    label?: string
  ): DateRangeFieldBuilder {
    let cfg: DateRangeFieldConfig = {
      type: "daterange",
      presets: true,
    };
    if (typeof labelOrConfig === "string") {
      cfg.label = labelOrConfig;
    } else if (labelOrConfig && typeof labelOrConfig === "object") {
      cfg = { ...cfg, ...labelOrConfig };
    }
    if (label) cfg.label = label;
    return new DateRangeFieldBuilder(cfg);
  },

  /**
   * Fluent builder for international phone input fields.
   */
  phone(labelOrConfig?: string | Partial<PhoneFieldConfig>, label?: string): PhoneFieldBuilder {
    let cfg: PhoneFieldConfig = {
      type: "phone",
      defaultCountry: "US",
    };
    if (typeof labelOrConfig === "string") {
      cfg.label = labelOrConfig;
    } else if (labelOrConfig && typeof labelOrConfig === "object") {
      cfg = { ...cfg, ...labelOrConfig };
    }
    if (label) cfg.label = label;
    return new PhoneFieldBuilder(cfg);
  },

  /**
   * Fluent builder for visual color picker fields.
   */
  color(labelOrConfig?: string | Partial<ColorFieldConfig>, label?: string): ColorFieldBuilder {
    let cfg: ColorFieldConfig = {
      type: "color",
      format: "hex",
    };
    if (typeof labelOrConfig === "string") {
      cfg.label = labelOrConfig;
    } else if (labelOrConfig && typeof labelOrConfig === "object") {
      cfg = { ...cfg, ...labelOrConfig };
    }
    if (label) cfg.label = label;
    return new ColorFieldBuilder(cfg);
  },

  /**
   * Fluent builder for icon picker fields.
   */
  icon(labelOrConfig?: string | Partial<IconFieldConfig>, label?: string): IconFieldBuilder {
    let cfg: IconFieldConfig = {
      type: "icon",
    };
    if (typeof labelOrConfig === "string") {
      cfg.label = labelOrConfig;
    } else if (labelOrConfig && typeof labelOrConfig === "object") {
      cfg = { ...cfg, ...labelOrConfig };
    }
    if (label) cfg.label = label;
    return new IconFieldBuilder(cfg);
  },

  /**
   * Fluent builder for tags and multi-chip input fields.
   */
  tags(labelOrConfig?: string | Partial<TagsFieldConfig>, label?: string): TagsFieldBuilder {
    let cfg: TagsFieldConfig = {
      type: "tags",
    };
    if (typeof labelOrConfig === "string") {
      cfg.label = labelOrConfig;
    } else if (labelOrConfig && typeof labelOrConfig === "object") {
      cfg = { ...cfg, ...labelOrConfig };
    }
    if (label) cfg.label = label;
    return new TagsFieldBuilder(cfg);
  },

  /**
   * Fluent builder for URL-friendly slug fields.
   */
  slug(labelOrConfig?: string | Partial<SlugFieldConfig>, label?: string): SlugFieldBuilder {
    let cfg: SlugFieldConfig = {
      type: "slug",
      separator: "-",
      lowercase: true,
    };
    if (typeof labelOrConfig === "string") {
      cfg.label = labelOrConfig;
    } else if (labelOrConfig && typeof labelOrConfig === "object") {
      cfg = { ...cfg, ...labelOrConfig };
    }
    if (label) cfg.label = label;
    return new SlugFieldBuilder(cfg);
  },

  /**
   * Fluent builder for 1D barcode fields.
   */
  barcode(
    labelOrConfig?: string | Partial<BarcodeFieldConfig>,
    label?: string
  ): BarcodeFieldBuilder {
    let cfg: BarcodeFieldConfig = {
      type: "barcode",
      format: "code128",
      displayValue: true,
      height: 70,
      width: 2,
    };
    if (typeof labelOrConfig === "string") {
      cfg.label = labelOrConfig;
    } else if (labelOrConfig && typeof labelOrConfig === "object") {
      cfg = { ...cfg, ...labelOrConfig };
    }
    if (label) cfg.label = label;
    return new BarcodeFieldBuilder(cfg);
  },

  /**
   * Fluent builder for 2D QR code fields.
   */
  qrCode(
    labelOrConfig?: string | Partial<QRCodeFieldConfig>,
    label?: string
  ): QRCodeFieldBuilder {
    let cfg: QRCodeFieldConfig = {
      type: "qrcode",
      size: 160,
      level: "M",
    };
    if (typeof labelOrConfig === "string") {
      cfg.label = labelOrConfig;
    } else if (labelOrConfig && typeof labelOrConfig === "object") {
      cfg = { ...cfg, ...labelOrConfig };
    }
    if (label) cfg.label = label;
    return new QRCodeFieldBuilder(cfg);
  },

  /**
   * Alias for `qrCode`.
   */
  qrcode(
    labelOrConfig?: string | Partial<QRCodeFieldConfig>,
    label?: string
  ): QRCodeFieldBuilder {
    return (this as any).qrCode(labelOrConfig, label);
  },

  /**
   * Fluent builder for handwritten digital signature capture fields.
   */
  signature(
    labelOrConfig?: string | Partial<SignatureFieldConfig>,
    label?: string
  ): SignatureFieldBuilder {
    let cfg: SignatureFieldConfig = {
      type: "signature",
      penColor: "#000000",
      backgroundColor: "transparent",
      penWidth: 2,
      width: 400,
      height: 160,
      format: "image/png",
    };
    if (typeof labelOrConfig === "string") {
      cfg.label = labelOrConfig;
    } else if (labelOrConfig && typeof labelOrConfig === "object") {
      cfg = { ...cfg, ...labelOrConfig };
    }
    if (label) cfg.label = label;
    return new SignatureFieldBuilder(cfg);
  },

  /**
   * Wraps an arbitrary field config in a fluent builder.
   */
  custom: createFieldBuilder,

  /**
   * Alias for custom field builder.
   */
  field: createFieldBuilder,
});

/**
 * Named alias for `f`.
 */
export const field = f;
