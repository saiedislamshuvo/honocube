import type { Collection } from "../types/collection.js";
import type { ChildCollectionHelper, CollectionFormReturn } from "./types.js";
import { getDefaultFormValues } from "./defaults.js";
import { evaluateComputedFields } from "./computed.js";
import { defineCollection } from "../core/collection.js";

/**
 * Creates a ChildCollectionHelper instance providing row-level operations (add, remove, update, reorder)
 * and index-based validation mapping for embedded line items.
 */
export function createChildCollectionHelper<
  TParentCollection extends Collection<any>,
  TChild = Record<string, unknown>
>(
  parentForm: Pick<CollectionFormReturn<TParentCollection>, "values" | "errors" | "setFieldValue">,
  parentCollection: TParentCollection,
  fieldName: Extract<keyof TParentCollection["fields"], string> | string
): ChildCollectionHelper<TChild> {
  const fieldConfig = parentCollection.getField(fieldName);
  if (!fieldConfig || fieldConfig.type !== "collection") {
    throw new Error(
      `Field '${String(fieldName)}' in collection '${parentCollection.name}' is not a child collection field.`
    );
  }

  const rawChild = (fieldConfig as any).collection;
  const childCollection: Collection<any> =
    rawChild && rawChild._isCollection
      ? rawChild
      : defineCollection(rawChild);

  const getRows = (): TChild[] => {
    const val = (parentForm.values as any)?.[fieldName];
    return Array.isArray(val) ? val : [];
  };

  const updateParentRows = (nextRows: TChild[]) => {
    parentForm.setFieldValue(fieldName as any, nextRows as any);
  };

  return {
    get rows() {
      return getRows();
    },
    get count() {
      return getRows().length;
    },
    get isEmpty() {
      return getRows().length === 0;
    },
    childCollection,

    addRow(initialData?: Partial<TChild>) {
      const currentRows = getRows();
      // Generate default values for the new child row with parent context
      const newRow = getDefaultFormValues(
        childCollection,
        initialData as any,
        parentForm.values
      ) as unknown as TChild;

      updateParentRows([...currentRows, newRow]);
    },

    removeRow(index: number) {
      const currentRows = getRows();
      if (index < 0 || index >= currentRows.length) return;
      const nextRows = currentRows.filter((_, i) => i !== index);
      updateParentRows(nextRows);
    },

    updateRow(index: number, patch: Partial<TChild>) {
      const currentRows = getRows();
      if (index < 0 || index >= currentRows.length) return;
      const existing = currentRows[index];
      const merged = { ...existing, ...patch };
      const evaluated = evaluateComputedFields(
        childCollection.fields,
        merged,
        parentForm.values
      );

      const nextRows = [...currentRows];
      nextRows[index] = evaluated as unknown as TChild;
      updateParentRows(nextRows);
    },

    reorderRows(fromIndex: number, toIndex: number) {
      const currentRows = getRows();
      if (
        fromIndex < 0 ||
        fromIndex >= currentRows.length ||
        toIndex < 0 ||
        toIndex >= currentRows.length ||
        fromIndex === toIndex
      ) {
        return;
      }
      const nextRows = [...currentRows];
      const [moved] = nextRows.splice(fromIndex, 1);
      if (moved !== undefined) {
        nextRows.splice(toIndex, 0, moved);
        updateParentRows(nextRows);
      }
    },

    clearRows() {
      updateParentRows([]);
    },

    getRowErrors(index: number): Record<string, string[]> {
      const prefix = `${String(fieldName)}[${index}].`;
      const rowErrors: Record<string, string[]> = {};
      const allErrors = parentForm.errors || {};

      for (const [key, errs] of Object.entries(allErrors)) {
        if (key.startsWith(prefix)) {
          const childKey = key.slice(prefix.length);
          rowErrors[childKey] = errs;
        }
      }

      return rowErrors;
    },
  };
}
