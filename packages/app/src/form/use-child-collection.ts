import type { Collection, InferRecord } from "../types/collection.js";
import type { ChildCollectionHelper, CollectionFormReturn } from "./types.js";
import { createChildCollectionHelper } from "./child.js";

/**
 * Headless hook to manage a child collection (embedded line items) within a parent collection form.
 */
export function useChildCollection<
  TParentCollection extends Collection<any>,
  K extends Extract<keyof InferRecord<TParentCollection>, string>,
  TChild = Record<string, unknown>
>(
  parentForm: CollectionFormReturn<TParentCollection>,
  parentCollection: TParentCollection,
  fieldName: K
): ChildCollectionHelper<TChild> {
  return createChildCollectionHelper<TParentCollection, TChild>(
    parentForm,
    parentCollection,
    fieldName
  );
}
