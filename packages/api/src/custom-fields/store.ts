export type CustomFieldType =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "select"
  | "textarea";

export interface CustomFieldDefinition {
  id: string;
  collection: string; // Target collection name, e.g. "orders", "customers"
  name: string; // Machine identifier, e.g. "warrantyMonths", "serialNumber"
  label: string; // Human label, e.g. "Warranty Months"
  type: CustomFieldType;
  options?: string[]; // Allowed options for "select" type
  defaultValue?: any;
  placeholder?: string;
  description?: string;
  required?: boolean;
  position?: number;
  tenantId?: string;
}

export interface CustomFieldsStore {
  list(collection?: string, tenantId?: string): CustomFieldDefinition[];
  get(id: string): CustomFieldDefinition | undefined;
  create(definition: CustomFieldDefinition): CustomFieldDefinition;
  update(
    id: string,
    updates: Partial<CustomFieldDefinition>
  ): CustomFieldDefinition | undefined;
  delete(id: string): boolean;
  clear(): void;
}

/**
 * Creates an in-memory storage manager for runtime custom field definitions.
 */
export function createCustomFieldsStore(
  initialDefinitions: CustomFieldDefinition[] = []
): CustomFieldsStore {
  const store = new Map<string, CustomFieldDefinition>();

  for (const def of initialDefinitions) {
    store.set(def.id, def);
  }

  return {
    list(collection, tenantId) {
      let items = Array.from(store.values());

      if (collection) {
        items = items.filter((d) => d.collection === collection);
      }

      if (tenantId) {
        items = items.filter((d) => !d.tenantId || d.tenantId === tenantId);
      }

      items.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      return items;
    },

    get(id) {
      return store.get(id);
    },

    create(definition) {
      if (!definition.id) {
        definition.id = `cf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      }
      store.set(definition.id, definition);
      return definition;
    },

    update(id, updates) {
      const existing = store.get(id);
      if (!existing) return undefined;
      const updated = { ...existing, ...updates };
      store.set(id, updated);
      return updated;
    },

    delete(id) {
      return store.delete(id);
    },

    clear() {
      store.clear();
    },
  };
}

/**
 * Validates a map of custom field values against custom field definitions.
 */
export function validateCustomFields(
  definitions: CustomFieldDefinition[],
  values: Record<string, any> = {}
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const def of definitions) {
    const val = values[def.name];

    // 1. Required check
    if (def.required) {
      if (val === undefined || val === null || val === "") {
        errors[def.name] = `${def.label} is required.`;
        continue;
      }
    }

    if (val === undefined || val === null || val === "") {
      continue;
    }

    // 2. Type checks
    switch (def.type) {
      case "number": {
        const num = Number(val);
        if (isNaN(num)) {
          errors[def.name] = `${def.label} must be a valid number.`;
        }
        break;
      }

      case "date": {
        const d = new Date(val);
        if (isNaN(d.getTime())) {
          errors[def.name] = `${def.label} must be a valid date.`;
        }
        break;
      }

      case "boolean": {
        if (typeof val !== "boolean" && val !== "true" && val !== "false" && val !== 0 && val !== 1) {
          errors[def.name] = `${def.label} must be a boolean.`;
        }
        break;
      }

      case "select": {
        if (def.options && def.options.length > 0) {
          const strVal = String(val);
          if (!def.options.includes(strVal)) {
            errors[def.name] = `${def.label} must be one of: ${def.options.join(", ")}.`;
          }
        }
        break;
      }

      default:
        break;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
