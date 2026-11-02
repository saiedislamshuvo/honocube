import type { FieldConfig } from "../types/fields.js";

const MAX_COMPUTATION_PASSES = 10;

/**
 * Checks if two values are equal (primitive or shallow object comparison).
 */
function areEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!areEqual(a[i], b[i])) return false;
    }
    return true;
  }
  return false;
}

/**
 * Evaluates all computed fields defined on a collection reactively against the active record.
 * Supports multi-pass chained dependencies (e.g. subtotal -> tax -> grandTotal).
 */
export function evaluateComputedFields<TRecord extends Record<string, any>>(
  fields: Record<string, FieldConfig<any>>,
  record: TRecord,
  parentRecord?: Record<string, unknown>
): TRecord {
  // Collect all computed fields
  const computedEntries: Array<[string, (rec: any, parent?: any) => any]> = [];
  for (const [key, field] of Object.entries(fields)) {
    if (field.type === "computed" && typeof (field as any).compute === "function") {
      computedEntries.push([key, (field as any).compute]);
    }
  }

  if (computedEntries.length === 0) {
    return record;
  }

  const result: TRecord = { ...record };

  let pass = 0;
  let hasChanged = true;

  while (hasChanged && pass < MAX_COMPUTATION_PASSES) {
    hasChanged = false;
    pass++;

    for (const [key, computeFn] of computedEntries) {
      try {
        const nextVal = computeFn(result, parentRecord);
        const prevVal = result[key];

        if (!areEqual(prevVal, nextVal)) {
          result[key as keyof TRecord] = nextVal;
          hasChanged = true;
        }
      } catch {
        // If user computation fails due to intermediate null/undefined input during typing,
        // preserve existing value without throwing.
      }
    }
  }

  return result;
}
