import type { Collection, DefineCollectionInput } from "../types/collection.js";
import type { FieldConfig } from "../types/fields.js";
import { toHumanLabel } from "../utils/format.js";
import {
  deriveFieldsFromDrizzleTable,
  deriveFieldsFromResource,
  getDrizzleTableName,
  isDrizzleTable,
  unwrapResourceConfig,
} from "./derivation.js";

export function defineCollection<
  TFields extends Record<string, FieldConfig<any>> = Record<string, FieldConfig<any>>
>(config: DefineCollectionInput<TFields>): Collection<TFields> {
  if (!config || typeof config !== "object") {
    throw new Error("defineCollection: Configuration object is required.");
  }

  const anyConfig = config as any;
  let derivedFields: Record<string, FieldConfig<any>> | undefined = undefined;
  let defaultName: string | undefined = undefined;

  // 1. Derivation from API resource
  if (anyConfig.resource) {
    const resource = unwrapResourceConfig(anyConfig.resource);
    defaultName = resource.name || getDrizzleTableName(resource.table);
    derivedFields = deriveFieldsFromResource(resource, anyConfig.fields);
  }
  // 2. Derivation from Drizzle table (drizzleTable or table when isDrizzleTable is true)
  else if (anyConfig.drizzleTable || (anyConfig.table && isDrizzleTable(anyConfig.table))) {
    const table = anyConfig.drizzleTable || anyConfig.table;
    defaultName = getDrizzleTableName(table);
    derivedFields = deriveFieldsFromDrizzleTable(table, anyConfig.fields);
  }
  // 3. Explicit fields provided
  else if (anyConfig.fields && typeof anyConfig.fields === "object") {
    derivedFields = { ...anyConfig.fields };
  }

  const name = anyConfig.name || defaultName;
  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new Error(
      "defineCollection: Collection 'name' is required (or provide a 'resource' with a valid name)."
    );
  }

  if (!derivedFields || Object.keys(derivedFields).length === 0) {
    throw new Error(
      `defineCollection('${name}'): 'fields' object is required (or provide a valid 'resource' or 'table').`
    );
  }

  const endpoint = anyConfig.endpoint || `/api/${name}`;
  const label = anyConfig.label || toHumanLabel(name);

  // Distinguish TableViewConfig from Drizzle table instance
  const tableViewConfig =
    anyConfig.table && !isDrizzleTable(anyConfig.table) ? anyConfig.table : undefined;

  const defaultView =
    anyConfig.defaultView || (tableViewConfig ? "table" : anyConfig.kanban ? "kanban" : "table");

  // Auto-detect identifier if not explicitly provided
  let identifier = anyConfig.identifier;
  if (!identifier && derivedFields.id) {
    const titleField = derivedFields.title
      ? "title"
      : derivedFields.name
      ? "name"
      : undefined;
    identifier = { field: "id", ...(titleField ? { titleField } : {}) };
  }

  const fieldKeys = Object.keys(derivedFields) as (keyof TFields)[];

  const collection: Collection<TFields> = {
    ...anyConfig,
    name,
    endpoint,
    label,
    fields: derivedFields as TFields,
    table: tableViewConfig,
    defaultView,
    identifier,
    _isCollection: true,
    getField: (key: keyof TFields) => (derivedFields as TFields)[key],
    getFieldKeys: () => fieldKeys,
  };

  return Object.freeze(collection);
}
