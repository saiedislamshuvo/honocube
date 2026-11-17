import * as React from "react";
import { AsyncCombobox } from "./async-combobox.js";
import type { ForeignKeySelectorProps } from "@honocube/core";

/**
 * Enterprise foreign key selector component.
 * Encapsulates asynchronous searchable relation selection with built-in
 * inline creation support so users can create missing records without losing
 * their current form draft.
 */
export function ForeignKeySelector({
  id,
  name,
  label,
  description,
  required = false,
  createInline = true,
  className = "",
  hasError = false,
  placeholder,
  target,
  ...comboboxProps
}: ForeignKeySelectorProps): React.JSX.Element {
  const inputId = id || name;

  return (
    <div className={`space-y-1.5 ${className}`} data-testid="foreign-key-selector">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium leading-none text-foreground"
        >
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </label>
      )}

      <AsyncCombobox
        id={inputId}
        name={name}
        target={target}
        placeholder={placeholder || (target ? `Select ${target}...` : "Select an option...")}
        createInline={createInline}
        hasError={hasError}
        {...comboboxProps}
      />

      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
