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
 * Supports recursive child collection evaluation and multi-pass chained dependencies (e.g. qty*rate -> subtotal -> tax -> grandTotal).
 */
export function evaluateComputedFields<TRecord extends Record<string, any>>(
  fields: Record<string, FieldConfig<any>>,
  record: TRecord,
  parentRecord?: Record<string, unknown>
): TRecord {
  // Collect all computed fields
  const computedEntries: Array<[string, (rec: any, parent?: any) => any]> = [];
  // Collect all child collection fields
  const childCollectionEntries: Array<[string, Record<string, FieldConfig<any>>]> = [];

  for (const [key, field] of Object.entries(fields)) {
    if (field.type === "computed" && typeof (field as any).compute === "function") {
      computedEntries.push([key, (field as any).compute]);
    } else if (field.type === "collection" && (field as any).collection?.fields) {
      childCollectionEntries.push([key, (field as any).collection.fields]);
    }
  }

  if (computedEntries.length === 0 && childCollectionEntries.length === 0) {
    return record;
  }

  const result: TRecord = { ...record };

  let pass = 0;
  let hasChanged = true;

  while (hasChanged && pass < MAX_COMPUTATION_PASSES) {
    hasChanged = false;
    pass++;

    // 1. Evaluate child collection rows
    for (const [childKey, childFields] of childCollectionEntries) {
      const rows = result[childKey];
      if (Array.isArray(rows) && rows.length > 0) {
        let childRowsChanged = false;
        const nextRows = rows.map((row) => {
          if (row && typeof row === "object") {
            const nextRow = evaluateComputedFields(childFields, row, result);
            if (!areEqual(row, nextRow)) {
              childRowsChanged = true;
              return nextRow;
            }
          }
          return row;
        });

        if (childRowsChanged) {
          result[childKey as keyof TRecord] = nextRows as any;
          hasChanged = true;
        }
      }
    }

    // 2. Evaluate parent computed fields
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
