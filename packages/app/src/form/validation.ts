import type { FieldConfig } from "../types/fields.js";
import { evaluateFieldCapability } from "./capabilities.js";

/**
 * Validates a single field's value against its configuration constraints (required, min, max, pattern).
 */
export function validateField(
  field: FieldConfig<any> | undefined,
  value: unknown,
  record?: Record<string, any>,
  user?: Record<string, unknown>
): string[] {
  if (!field) return [];

  const capability = evaluateFieldCapability(field, record || {}, user);
  // Hidden or disabled fields do not block submission with validation errors
  if (!capability.visible || capability.disabled) {
    return [];
  }

  const errors: string[] = [];
  const isEmpty =
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);

  if (capability.required && isEmpty) {
    if (field.type === "collection") {
      errors.push(`${field.label || "This field"} must contain at least one item`);
    } else {
      errors.push(`${field.label || "This field"} is required`);
    }
    return errors;
  }

  if (isEmpty) {
    return errors;
  }

  // Type-specific validation
  if (field.type === "number" || field.type === "currency") {
    const num = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(num)) {
      errors.push("Must be a valid number");
    } else {
      if (field.min !== undefined && num < field.min) {
        errors.push(`Must be at least ${field.min}`);
      }
      if (field.max !== undefined && num > field.max) {
        errors.push(`Must be at most ${field.max}`);
      }
    }
  } else if (field.type === "text" || field.type === "textarea") {
    if (field.pattern) {
      try {
        const regex = new RegExp(field.pattern);
        if (!regex.test(String(value))) {
          errors.push("Invalid format");
        }
      } catch {
        // Safe regex fallback
      }
    }
  }

  return errors;
}

/**
 * Validates an entire record against collection field configs and an optional custom or Standard Schema validator.
 */
export async function validateRecord(
  fields: Record<string, FieldConfig<any>>,
  record: Record<string, any>,
  user?: Record<string, unknown>,
  customValidator?:
    | ((values: any) => Record<string, string[]> | Promise<Record<string, string[]>>)
    | { "~standard": { validate: (values: unknown) => Promise<any> | any } }
): Promise<Record<string, string[]>> {
  const errors: Record<string, string[]> = {};

  // 1. Built-in field level validations
  for (const [key, field] of Object.entries(fields)) {
    const fieldErrors = validateField(field, record[key], record, user);
    if (fieldErrors.length > 0) {
      errors[key] = fieldErrors;
    }

    // Child collection row-level validations
    if (field.type === "collection" && Array.isArray(record[key])) {
      const childFields = (field as any).collection?.fields || {};
      const rows = record[key] as any[];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row && typeof row === "object") {
          const rowErrors = await validateRecord(childFields, row, user);
          for (const [childKey, errs] of Object.entries(rowErrors)) {
            errors[`${key}[${i}].${childKey}`] = errs;
          }
        }
      }
    }
  }

  // 2. Custom or Standard Schema validation
  if (customValidator) {
    if (
      typeof customValidator === "object" &&
      customValidator !== null &&
      "~standard" in customValidator &&
      typeof (customValidator as any)["~standard"]?.validate === "function"
    ) {
      const result = await (customValidator as any)["~standard"].validate(record);
      if (result && result.issues && Array.isArray(result.issues)) {
        for (const issue of result.issues) {
          const path = Array.isArray(issue.path)
            ? issue.path.join(".")
            : String(issue.path || "_root");
          if (!errors[path]) errors[path] = [];
          errors[path].push(issue.message || "Invalid value");
        }
      }
    } else if (typeof customValidator === "function") {
      const customErrors = await customValidator(record);
      if (customErrors && typeof customErrors === "object") {
        for (const [key, errs] of Object.entries(customErrors)) {
          if (Array.isArray(errs)) {
            errors[key] = [...(errors[key] || []), ...errs];
          } else if (typeof errs === "string") {
            errors[key] = [...(errors[key] || []), errs];
          }
        }
      }
    }
  }

  return errors;
}
