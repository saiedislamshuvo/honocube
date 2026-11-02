import type { Collection, InferRecord } from "../types/collection.js";
import type { FieldConfig } from "../types/fields.js";
import { evaluateComputedFields } from "./computed.js";

/**
 * Computes initial form values from field defaults, merged with optional initial overrides
 * and initial computed formula evaluations.
 */
export function getDefaultFormValues<TCollection extends Collection<any>>(
  collection: TCollection,
  initialValues?: Partial<InferRecord<TCollection>>,
  parentRecord?: Record<string, unknown>
): InferRecord<TCollection> {
  const result: Record<string, any> = {};

  const fields = collection.fields;
  for (const [key, fieldUnknown] of Object.entries(fields)) {
    const field = fieldUnknown as FieldConfig<any>;
    if ("default" in field && (field as any).default !== undefined) {
      const def = (field as any).default;
      result[key] = typeof def === "function" ? def() : def;
    } else if (field.type === "boolean") {
      result[key] = false;
    } else if (field.type === "collection") {
      result[key] = [];
    } else {
      result[key] = undefined;
    }
  }

  // Merge initial value overrides
  if (initialValues) {
    for (const [key, val] of Object.entries(initialValues)) {
      if (val !== undefined) {
        result[key] = val;
      }
    }
  }

  // Run initial computed pass
  return evaluateComputedFields(fields, result, parentRecord) as InferRecord<TCollection>;
}
