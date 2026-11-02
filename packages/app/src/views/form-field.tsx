import React from "react";
import { Input, Textarea } from "@honocube/ui";
import { toHumanLabel } from "../utils/format.js";
import type { FormFieldProps } from "./types.js";

export function FormField({
  name,
  field,
  fieldState,
  onChange,
  disabled = false,
  className = "",
}: FormFieldProps): React.JSX.Element | null {
  if (fieldState.visible === false) {
    return null;
  }

  const isDisabled = Boolean(disabled || fieldState.disabled || fieldState.readOnly);
  const labelText = field.label || toHumanLabel(name);
  const isRequired = Boolean(fieldState.required || field.required);
  const errorMessage = fieldState.error || (fieldState.errors && fieldState.errors[0]);

  // Boolean has an inline label next to checkbox
  if (field.type === "boolean") {
    return (
      <div className={`space-y-1 ${className}`}>
        <div className="flex items-center space-x-2 pt-2">
          <input
            type="checkbox"
            id={name}
            checked={Boolean(fieldState.value)}
            onChange={(e) => onChange(e.target.checked)}
            disabled={isDisabled}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50 cursor-pointer"
          />
          <label htmlFor={name} className="text-sm font-medium leading-none cursor-pointer">
            {labelText}
            {isRequired && <span className="text-destructive ml-0.5">*</span>}
          </label>
        </div>
        {field.description && (
          <p className="text-xs text-muted-foreground pl-6">{field.description}</p>
        )}
        {errorMessage && (
          <p className="text-xs font-medium text-destructive pl-6">{errorMessage}</p>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={name} className="block text-sm font-medium leading-none">
        {labelText}
        {isRequired && <span className="text-destructive ml-0.5">*</span>}
      </label>

      {/* Field Input Control */}
      {(() => {
        switch (field.type) {
          case "textarea":
            return (
              <Textarea
                id={name}
                value={fieldState.value ?? ""}
                onChange={(e) => onChange(e.target.value)}
                disabled={isDisabled}
                placeholder={field.placeholder}
                className={errorMessage ? "border-destructive focus-visible:ring-destructive" : ""}
              />
            );

          case "number":
          case "currency":
            return (
              <Input
                id={name}
                type="number"
                step={field.step ?? (field.type === "currency" ? "0.01" : "any")}
                value={fieldState.value ?? ""}
                onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
                disabled={isDisabled}
                placeholder={field.placeholder}
                className={errorMessage ? "border-destructive focus-visible:ring-destructive" : ""}
              />
            );

          case "date":
          case "datetime":
            return (
              <Input
                id={name}
                type={field.type === "datetime" ? "datetime-local" : "date"}
                value={fieldState.value ?? ""}
                onChange={(e) => onChange(e.target.value)}
                disabled={isDisabled}
                className={errorMessage ? "border-destructive focus-visible:ring-destructive" : ""}
              />
            );

          case "select":
            return (
              <select
                id={name}
                value={String(fieldState.value ?? "")}
                onChange={(e) => onChange(e.target.value)}
                disabled={isDisabled}
                className={`flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50 ${
                  errorMessage
                    ? "border-destructive focus-visible:ring-destructive"
                    : "border-input focus-visible:ring-ring"
                }`}
              >
                <option value="">{field.placeholder || "Select an option..."}</option>
                {field.options.map((opt: any) => {
                  const val = typeof opt === "object" && opt !== null ? opt.value : opt;
                  const lbl = typeof opt === "object" && opt !== null ? opt.label : opt;
                  return (
                    <option key={String(val)} value={String(val)}>
                      {String(lbl)}
                    </option>
                  );
                })}
              </select>
            );

          case "computed":
            return (
              <Input
                id={name}
                value={String(fieldState.value ?? "")}
                disabled
                readOnly
                className="bg-muted cursor-not-allowed text-muted-foreground font-mono"
              />
            );

          case "relation":
            return (
              <Input
                id={name}
                value={String(fieldState.value ?? "")}
                onChange={(e) => onChange(e.target.value)}
                disabled={isDisabled}
                placeholder={field.placeholder || `Select ${field.target}...`}
                className={errorMessage ? "border-destructive focus-visible:ring-destructive" : ""}
              />
            );

          case "text":
          case "series":
          default:
            return (
              <Input
                id={name}
                value={fieldState.value ?? ""}
                onChange={(e) => onChange(e.target.value)}
                disabled={isDisabled}
                placeholder={field.placeholder}
                className={errorMessage ? "border-destructive focus-visible:ring-destructive" : ""}
              />
            );
        }
      })()}

      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}

      {errorMessage && (
        <p className="text-xs font-medium text-destructive">{errorMessage}</p>
      )}
    </div>
  );
}
