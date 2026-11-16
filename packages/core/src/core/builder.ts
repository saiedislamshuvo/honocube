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
