import type { BaseFieldType, FieldConfig } from "../types/fields.js";
import { toHumanLabel } from "../utils/format.js";

/**
 * Checks whether an object is a Drizzle Table instance.
 */
export function isDrizzleTable(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return false;

  // Drizzle tables use symbols for metadata
  const symbols = Object.getOwnPropertySymbols(obj);
  if (symbols.some((s) => s.description?.startsWith("drizzle:"))) {
    return true;
  }

  // Fallback for custom or mocked table instances
  const record = obj as Record<string, any>;
  if (record._ && typeof record._ === "object" && ("name" in record._ || "columns" in record._)) {
    return true;
  }

  // Check if any property looks like a Drizzle column
  for (const val of Object.values(record)) {
    if (val && typeof val === "object" && ("columnType" in val || "dataType" in val)) {
      return true;
    }
  }

  return false;
}

/**
 * Extracts table name from a Drizzle table instance.
 */
export function getDrizzleTableName(table: unknown): string | undefined {
  if (!table || typeof table !== "object") return undefined;

  const symbols = Object.getOwnPropertySymbols(table);
  const nameSymbol = symbols.find(
    (s) =>
      s.description === "drizzle:Name" ||
      s.description === "drizzle:BaseName" ||
      s.description === "drizzle:OriginalName" ||
      String(s).includes("Name")
  );

  const record = table as Record<string | symbol, any>;
  if (nameSymbol && typeof record[nameSymbol] === "string") {
    return record[nameSymbol];
  }

  if (typeof record._?.name === "string") {
    return record._.name;
  }

  return undefined;
}

/**
 * Extracts the columns dictionary from a Drizzle table instance.
 */
export function getDrizzleColumns(table: unknown): Record<string, any> {
  if (!table || typeof table !== "object") return {};

  const record = table as Record<string | symbol, any>;

  // 1. Symbol lookup: Symbol(drizzle:Columns)
  const symbols = Object.getOwnPropertySymbols(table);
  const colSymbol = symbols.find(
    (s) => s.description === "drizzle:Columns" || String(s).includes("Columns")
  );
  if (colSymbol && record[colSymbol] && typeof record[colSymbol] === "object") {
    return record[colSymbol];
  }

  // 2. Direct property: table._.columns
  if (record._?.columns && typeof record._.columns === "object") {
    return record._.columns;
  }

  // 3. Fallback: inspect keys of table directly
  const cols: Record<string, any> = {};
  for (const [key, val] of Object.entries(record)) {
    if (
      val &&
      typeof val === "object" &&
      ("dataType" in val || "columnType" in val || (val as any)._?.name)
    ) {
      cols[key] = val;
    }
  }

  return cols;
}

/**
 * Infers a HonoCube field type from a Drizzle Column instance.
 */
export function inferFieldTypeFromDrizzleColumn(col: any): BaseFieldType {
  // 1. Enum values defined directly on column
  if (Array.isArray(col.enumValues) && col.enumValues.length > 0) {
    return "select";
  }

  const dataType = typeof col.dataType === "string" ? col.dataType.toLowerCase() : "";
  const columnType = typeof col.columnType === "string" ? col.columnType.toLowerCase() : "";

  // 2. Primary dataType checks
  if (dataType === "string") return "text";
  if (dataType === "number" || dataType === "bigint") return "number";
  if (dataType === "boolean") return "boolean";
  if (dataType === "date") return "date";
  if (dataType === "json") return "json";

  // 3. Fallback columnType name checks across dialects (SQLite, PG, MySQL)
  if (columnType.includes("bool")) return "boolean";
  if (
    columnType.includes("int") ||
    columnType.includes("serial") ||
    columnType.includes("real") ||
    columnType.includes("numeric") ||
    columnType.includes("bigint") ||
    columnType.includes("smallint") ||
    columnType.includes("tinyint") ||
    columnType.includes("decimal") ||
    columnType.includes("double") ||
    columnType.includes("float")
  ) {
    return "number";
  }
  if (
    columnType.includes("timestamp") ||
    columnType.includes("date") ||
    columnType.includes("time")
  ) {
    return "date";
  }
  if (columnType.includes("json")) return "json";
  if (
    columnType.includes("text") ||
    columnType.includes("varchar") ||
    columnType.includes("char") ||
    columnType.includes("uuid") ||
    columnType.includes("string")
  ) {
    return "text";
  }

  return "text";
}

/**
 * Derives a single HonoCube field configuration from a Drizzle column.
 */
export function deriveFieldFromDrizzleColumn(key: string, col: any): FieldConfig<any> {
  const type = inferFieldTypeFromDrizzleColumn(col);
  const label = toHumanLabel(key);
  const isPrimary = Boolean(col.primary || col.isPrimaryKey);
  const isAutoIncrement = Boolean(col.autoIncrement);
  const notNull = Boolean(col.notNull);
  const hasDefault = Boolean(
    col.hasDefault || col.default !== undefined || isPrimary || isAutoIncrement
  );

  const base: any = {
    type,
    label,
  };

  if (isPrimary || isAutoIncrement) {
    base.readOnly = true;
  }

  if (notNull && !hasDefault && !isPrimary && !isAutoIncrement) {
    base.required = true;
  } else if (!notNull) {
    base.required = false;
  }

  if (col.default !== undefined) {
    base.default = col.default;
  }

  if (type === "select" && Array.isArray(col.enumValues) && col.enumValues.length > 0) {
    base.options = [...col.enumValues];
  }

  return base;
}

/**
 * Derives collection fields map from a Drizzle Table.
 */
export function deriveFieldsFromDrizzleTable(
  table: unknown,
  overrides?: Record<string, Partial<FieldConfig<any>>>
): Record<string, FieldConfig<any>> {
  const cols = getDrizzleColumns(table);
  const fields: Record<string, FieldConfig<any>> = {};

  for (const [key, col] of Object.entries(cols)) {
    fields[key] = deriveFieldFromDrizzleColumn(key, col);
  }

  if (overrides && typeof overrides === "object") {
    for (const [key, userOverride] of Object.entries(overrides)) {
      if (userOverride && typeof userOverride === "object") {
        const unwrapped =
          typeof (userOverride as any).build === "function"
            ? (userOverride as any).build()
            : typeof (userOverride as any).toConfig === "function"
            ? (userOverride as any).toConfig()
            : userOverride;
        if (fields[key]) {
          fields[key] = { ...fields[key], ...unwrapped } as FieldConfig<any>;
        } else {
          fields[key] = { ...unwrapped } as FieldConfig<any>;
        }
      }
    }
  }

  return fields;
}

/**
 * Unwraps Zod type wrappers (optional, nullable, default, effects, pipeline).
 */
export function unwrapZodType(fieldDef: any): {
  inner: any;
  isOptional: boolean;
  isNullable: boolean;
  defaultValue: any;
} {
  let isOptional = false;
  let isNullable = false;
  let defaultValue: any = undefined;
  let current = fieldDef;

  while (current && typeof current === "object") {
    const typeName = current._def?.typeName || current.type || current.def?.type;
    if (typeName === "ZodOptional" || typeName === "optional") {
      isOptional = true;
      current = current.def?.innerType || current._def?.innerType;
    } else if (typeName === "ZodNullable" || typeName === "nullable") {
      isNullable = true;
      current = current.def?.innerType || current._def?.innerType;
    } else if (typeName === "ZodDefault" || typeName === "default") {
      const rawVal = current.def?.defaultValue ?? current._def?.defaultValue;
      defaultValue = typeof rawVal === "function" ? rawVal() : rawVal;
      current = current.def?.innerType || current._def?.innerType;
    } else if (typeName === "ZodEffects" || typeName === "effects") {
      current = current._def?.schema || current.def?.schema;
    } else if (typeName === "ZodPipeline" || typeName === "piped") {
      current = current.def?.in || current._def?.in;
    } else {
      break;
    }
  }

  return { inner: current, isOptional, isNullable, defaultValue };
}

/**
 * Derives field properties from a Zod schema property.
 */
export function deriveFieldFromZodType(key: string, fieldDef: any): Partial<FieldConfig<any>> {
  const { inner, isOptional, isNullable, defaultValue } = unwrapZodType(fieldDef);
  if (!inner || typeof inner !== "object") return {};

  const typeName = String(
    inner._def?.typeName || inner.type || inner.def?.type || ""
  ).toLowerCase();
  const label = toHumanLabel(key);
  const derived: any = { label };

  if (isOptional || isNullable) {
    derived.required = false;
  } else {
    derived.required = true;
  }

  if (defaultValue !== undefined) {
    derived.default = defaultValue;
  }

  // 1. Enum
  if (
    typeName.includes("enum") ||
    inner.options !== undefined ||
    inner.enum !== undefined ||
    inner.def?.entries !== undefined
  ) {
    derived.type = "select";
    let rawOptions: any[] = [];
    if (Array.isArray(inner.options)) {
      rawOptions = inner.options;
    } else if (inner._def?.values && typeof inner._def.values[Symbol.iterator] === "function") {
      rawOptions = Array.from(inner._def.values);
    } else if (inner.def?.entries && typeof inner.def.entries === "object") {
      rawOptions = Object.values(inner.def.entries);
    } else if (inner.enum && typeof inner.enum === "object") {
      rawOptions = Object.values(inner.enum);
    }
    // Filter numeric reverse mappings
    derived.options = rawOptions.filter(
      (opt) => typeof opt !== "number" || !rawOptions.includes(String(opt))
    );
  }
  // 2. String
  else if (typeName.includes("string")) {
    derived.type = "text";

    // Pattern / regex check
    const checks = inner.def?.checks || inner._def?.checks || [];
    for (const check of checks) {
      const pattern = check._zod?.def?.pattern || check.pattern || check.regex;
      if (pattern instanceof RegExp) {
        derived.pattern = pattern.source;
      } else if (typeof pattern === "string") {
        derived.pattern = pattern;
      }
    }
  }
  // 3. Number
  else if (typeName.includes("number")) {
    derived.type = "number";

    if (inner.minValue !== undefined && inner.minValue !== -Infinity) {
      derived.min = inner.minValue;
    }
    if (inner.maxValue !== undefined && inner.maxValue !== Infinity) {
      derived.max = inner.maxValue;
    }

    const checks = inner.def?.checks || inner._def?.checks || [];
    for (const check of checks) {
      const checkDef = check._zod?.def || check;
      const checkKind = checkDef.check || checkDef.kind;
      if (checkKind === "greater_than" || checkKind === "min") {
        if (checkDef.value !== undefined) derived.min = checkDef.value;
      } else if (checkKind === "less_than" || checkKind === "max") {
        if (checkDef.value !== undefined) derived.max = checkDef.value;
      }
    }
  }
  // 4. Boolean
  else if (typeName.includes("bool")) {
    derived.type = "boolean";
  }
  // 5. Date
  else if (typeName.includes("date")) {
    derived.type = "date";
  }
  // 6. Array / Object / Record
  else if (
    typeName.includes("array") ||
    typeName.includes("object") ||
    typeName.includes("record")
  ) {
    derived.type = "json";
  }

  return derived;
}

/**
 * Extracts the shape dictionary from a Zod validator (single schema, tuple, or object).
 */
export function getZodShape(rawValidator: any): Record<string, any> | undefined {
  if (!rawValidator || typeof rawValidator !== "object") return undefined;

  // If array [createSchema, updateSchema], take createSchema
  let schema = Array.isArray(rawValidator) ? rawValidator[0] : rawValidator;

  // If { create: ..., update: ... }, take create
  if (schema.create && typeof schema.create === "object") {
    schema = schema.create;
  }

  // Unwrap effects, transforms, or pipelines
  while (schema && typeof schema === "object") {
    if (schema._def?.schema) {
      schema = schema._def.schema;
    } else if (schema.def?.schema) {
      schema = schema.def.schema;
    } else if (
      schema._def?.innerType &&
      (schema._def.typeName === "ZodEffects" || schema.def?.type === "effects")
    ) {
      schema = schema._def.innerType;
    } else {
      break;
    }
  }

  if (schema.shape) {
    return typeof schema.shape === "function" ? schema.shape() : schema.shape;
  }

  if (schema._def?.shape) {
    return typeof schema._def.shape === "function" ? schema._def.shape() : schema._def.shape;
  }

  return undefined;
}

/**
 * Derives fields map from a Zod validator schema.
 */
export function deriveFieldsFromZod(
  validator: any,
  overrides?: Record<string, Partial<FieldConfig<any>>>
): Record<string, FieldConfig<any>> {
  const shape = getZodShape(validator);
  const fields: Record<string, FieldConfig<any>> = {};
  if (!shape) return fields;

  for (const [key, fieldDef] of Object.entries(shape)) {
    const derived = deriveFieldFromZodType(key, fieldDef);
    fields[key] = derived as FieldConfig<any>;
  }

  if (overrides && typeof overrides === "object") {
    for (const [key, userOverride] of Object.entries(overrides)) {
      if (userOverride && typeof userOverride === "object") {
        const unwrapped =
          typeof (userOverride as any).build === "function"
            ? (userOverride as any).build()
            : typeof (userOverride as any).toConfig === "function"
            ? (userOverride as any).toConfig()
            : userOverride;
        if (fields[key]) {
          fields[key] = { ...fields[key], ...unwrapped } as FieldConfig<any>;
        } else {
          fields[key] = { ...unwrapped } as FieldConfig<any>;
        }
      }
    }
  }

  return fields;
}

/**
 * Unwraps an API resource or ResourceApp to extract its underlying ResourceConfig.
 */
export function unwrapResourceConfig(rawResource: any): any {
  if (!rawResource || typeof rawResource !== "object") return rawResource;

  const sym = Symbol.for("honocube.resource_config");
  if (rawResource[sym] && typeof rawResource[sym] === "object") {
    return rawResource[sym];
  }

  if (rawResource._honocube_config && typeof rawResource._honocube_config === "object") {
    return rawResource._honocube_config;
  }

  if (rawResource.config && typeof rawResource.config === "object" && rawResource.config.table) {
    return rawResource.config;
  }

  return rawResource;
}

/**
 * Derives collection fields map from an API ResourceConfig (table + validator + overrides).
 */
export function deriveFieldsFromResource(
  rawResource: any,
  overrides?: Record<string, Partial<FieldConfig<any>>>
): Record<string, FieldConfig<any>> {
  const resource = unwrapResourceConfig(rawResource);
  const result: Record<string, any> = {};

  // 1. Derive from Drizzle table
  if (resource?.table) {
    const tableFields = deriveFieldsFromDrizzleTable(resource.table);
    for (const [k, v] of Object.entries(tableFields)) {
      result[k] = { ...v };
    }
  }

  // 2. Refine with Zod validator
  if (resource?.validator) {
    const validatorFields = deriveFieldsFromZod(resource.validator);
    for (const [k, v] of Object.entries(validatorFields)) {
      if (result[k]) {
        result[k] = {
          ...result[k],
          ...v,
          label: result[k].label || v.label,
          type: v.type || result[k].type,
        };
      } else {
        result[k] = { ...v };
      }
    }
  }

  // 3. Apply manual UI overrides
  if (overrides && typeof overrides === "object") {
    for (const [k, userOverride] of Object.entries(overrides)) {
      if (userOverride && typeof userOverride === "object") {
        if (result[k]) {
          result[k] = { ...result[k], ...userOverride };
        } else {
          result[k] = { ...userOverride };
        }
      }
    }
  }

  return result;
}

export interface DerivedCollectionDefinition<
  TFields extends Record<string, FieldConfig<any>> = Record<string, FieldConfig<any>>
> {
  name: string;
  endpoint: string;
  label: string;
  fields: TFields;
}

/**
 * Derives a collection definition from an API ResourceConfig.
 */
export function fromResource<
  TFields extends Record<string, FieldConfig<any>> = Record<string, FieldConfig<any>>
>(
  rawResource: any,
  overrides?: Record<string, Partial<FieldConfig<any>>>
): DerivedCollectionDefinition<TFields> {
  if (!rawResource || typeof rawResource !== "object") {
    throw new Error("fromResource: Resource object is required.");
  }

  const resource = unwrapResourceConfig(rawResource);
  const name = resource.name || getDrizzleTableName(resource.table) || "resource";
  const endpoint = `/api/${name}`;
  const label = toHumanLabel(name);
  const fields = deriveFieldsFromResource(resource, overrides) as TFields;

  return {
    name,
    endpoint,
    label,
    fields,
  };
}

/**
 * Derives a collection definition from a Drizzle table.
 */
export function fromDrizzleTable<
  TFields extends Record<string, FieldConfig<any>> = Record<string, FieldConfig<any>>
>(
  table: any,
  overrides?: Record<string, Partial<FieldConfig<any>>>
): DerivedCollectionDefinition<TFields> {
  if (!table || typeof table !== "object") {
    throw new Error("fromDrizzleTable: Drizzle table object is required.");
  }

  const name = getDrizzleTableName(table) || "table";
  const endpoint = `/api/${name}`;
  const label = toHumanLabel(name);
  const fields = deriveFieldsFromDrizzleTable(table, overrides) as TFields;

  return {
    name,
    endpoint,
    label,
    fields,
  };
}
