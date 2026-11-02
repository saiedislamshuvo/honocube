import type { Collection, CollectionConfig } from "../types/collection.js";
import type { FieldConfig } from "../types/fields.js";
import { toHumanLabel } from "../utils/format.js";

export function defineCollection<
  TFields extends Record<string, FieldConfig<any>> = Record<string, FieldConfig<any>>
>(config: CollectionConfig<TFields>): Collection<TFields> {
  if (!config || typeof config !== "object") {
    throw new Error("defineCollection: Configuration object is required.");
  }
  if (!config.name || typeof config.name !== "string" || config.name.trim() === "") {
    throw new Error("defineCollection: Collection 'name' is required.");
  }
  if (!config.fields || typeof config.fields !== "object") {
    throw new Error(`defineCollection('${config.name}'): 'fields' object is required.`);
  }

  const endpoint = config.endpoint || `/api/${config.name}`;
  const label = config.label || toHumanLabel(config.name);
  const defaultView = config.defaultView || (config.table ? "table" : config.kanban ? "kanban" : "table");

  const fieldKeys = Object.keys(config.fields) as (keyof TFields)[];

  const collection: Collection<TFields> = {
    ...config,
    _isCollection: true,
    endpoint,
    label,
    defaultView,
    getField: (key: keyof TFields) => config.fields[key],
    getFieldKeys: () => fieldKeys,
  };

  return Object.freeze(collection);
}
