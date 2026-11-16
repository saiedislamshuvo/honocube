import type { Collection } from "../types/collection.js";
import type { FieldConfig } from "../types/fields.js";
import {
  type CustomFieldType,
  type CustomFieldDefinition,
  type CustomFieldsStore,
  createCustomFieldsStore,
  validateCustomFields,
} from "@honocube/api";

export {
  createCustomFieldsStore,
  validateCustomFields,
  type CustomFieldType,
  type CustomFieldDefinition,
  type CustomFieldsStore,
};

/**
 * Injects user-defined runtime custom fields into a static collection definition.
 * Enables dynamic discovery by forms, tables, grid views, and export routines.
 */
export function injectCustomFieldsIntoCollection<T extends Collection<any>>(
  collection: T,
  customFields: CustomFieldDefinition[] = []
): T {
  if (!customFields || customFields.length === 0) {
    return collection;
  }

  const customFieldMap = new Map<string, CustomFieldDefinition>();
  for (const cf of customFields) {
    customFieldMap.set(cf.name, cf);
  }

  const baseGetFieldKeys = collection.getFieldKeys.bind(collection);

  const customKeys = customFields.map((cf) => cf.name);
  const baseKeys = baseGetFieldKeys();
  const allKeys = Array.from(new Set([...baseKeys, ...customKeys]));

  // Create synthesized FieldConfig for custom fields
  const getSynthesizedField = (name: string): FieldConfig<any> | undefined => {
    const cf = customFieldMap.get(name);
    if (!cf) return undefined;

    let fieldType: string = cf.type;
    if (cf.type === "textarea") {
      fieldType = "text";
    }

    const fieldConfig: any = {
      type: fieldType,
      label: cf.label,
      placeholder: cf.placeholder,
      description: cf.description,
      required: cf.required,
      ...(cf.options && cf.options.length > 0
        ? { options: cf.options.map((opt) => ({ label: opt, value: opt })) }
        : {}),
      metadata: {
        isCustomField: true,
        customFieldDefinition: cf,
      },
    };

    return fieldConfig as FieldConfig<any>;
  };

  const customFieldsConfig: Record<string, FieldConfig<any>> = {};
  for (const cf of customFields) {
    const synthesized = getSynthesizedField(cf.name);
    if (synthesized) {
      customFieldsConfig[cf.name] = synthesized;
    }
  }

  const allFields = {
    ...collection.fields,
    ...customFieldsConfig,
  };

  const augmentedCollection: Collection<any> = {
    ...collection,
    fields: allFields,
    getFieldKeys: () => allKeys,
    getField: (key: string) => {
      if (customFieldMap.has(key)) {
        return getSynthesizedField(key);
      }
      return collection.getField(key);
    },
    table: collection.table
      ? {
          ...collection.table,
          columns: Array.from(new Set([...(collection.table.columns || baseKeys), ...customKeys])),
        }
      : undefined,
  };

  return Object.freeze(augmentedCollection) as unknown as T;
}

/**
 * Extracts custom field values from a record, resolving from either record.customFields[key] or record[key].
 */
export function extractCustomFields(
  record: any,
  definitions: CustomFieldDefinition[] = []
): Record<string, any> {
  const result: Record<string, any> = {};
  if (!record || typeof record !== "object") return result;

  const nested = record.customFields && typeof record.customFields === "object" ? record.customFields : {};

  for (const def of definitions) {
    if (def.name in nested && nested[def.name] !== undefined) {
      result[def.name] = nested[def.name];
    } else if (def.name in record && record[def.name] !== undefined) {
      result[def.name] = record[def.name];
    } else if (def.defaultValue !== undefined) {
      result[def.name] = def.defaultValue;
    }
  }

  return result;
}

/**
 * Merges custom field values into a record.
 * Supports "nested" (record.customFields) and "flat" (record[name]) modes.
 */
export function mergeCustomFieldsWithRecord<T extends Record<string, any>>(
  record: T,
  customFieldValues: Record<string, any>,
  mode: "nested" | "flat" = "nested"
): T {
  if (mode === "flat") {
    return {
      ...record,
      ...customFieldValues,
    };
  }

  const existingNested = record.customFields && typeof record.customFields === "object" ? record.customFields : {};
  return {
    ...record,
    customFields: {
      ...existingNested,
      ...customFieldValues,
    },
  };
}
