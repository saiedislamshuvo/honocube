import type { FieldConfig } from "../types/fields.js";
import type { FieldCapabilityState } from "./types.js";

/**
 * Evaluates dynamic visibility, disabled, read-only, and required rules
 * for a field against the current record and user context.
 */
export function evaluateFieldCapability<TRecord extends Record<string, any>>(
  field: FieldConfig<any> | undefined,
  record: TRecord,
  user?: Record<string, unknown>
): FieldCapabilityState {
  if (!field) {
    return {
      visible: true,
      disabled: false,
      readOnly: false,
      required: false,
    };
  }

  const ctx = { record, user };

  // 1. Evaluate visibility
  let visible = true;
  if (typeof field.visible === "function") {
    try {
      visible = Boolean(field.visible(ctx));
    } catch {
      visible = true;
    }
  } else if (typeof field.visible === "boolean") {
    visible = field.visible;
  }

  // 2. Computed fields are inherently read-only
  const isComputed = field.type === "computed";
  const readOnly = isComputed || Boolean(field.readOnly);

  // 3. Evaluate disabled rule (readOnly automatically disables direct input)
  let disabled = readOnly;
  if (!disabled) {
    if (typeof field.disabled === "function") {
      try {
        disabled = Boolean(field.disabled(ctx));
      } catch {
        disabled = false;
      }
    } else if (typeof field.disabled === "boolean") {
      disabled = field.disabled;
    }
  }

  // 4. Required flag
  const required = Boolean(field.required);

  return {
    visible,
    disabled,
    readOnly,
    required,
  };
}
