import * as React from "react";
import { Input, Textarea, Switch } from "@honocube/ui";
import type { CustomFieldsFormSectionProps } from "@honocube/core";

export function CustomFieldsFormSection({
  customFields = [],
  values = {},
  onChange,
  errors = {},
  disabled = false,
  className = "",
}: CustomFieldsFormSectionProps): React.JSX.Element | null {
  if (customFields.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="custom-fields-form-section"
      className={`rounded-lg border bg-card p-4 flex flex-col gap-3 ${className}`}
    >
      <div className="border-b pb-2">
        <h4 className="text-xs font-semibold text-foreground tracking-wide uppercase">
          Custom Attributes
        </h4>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          User-defined custom fields for this record.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {customFields.map((cf) => {
          const val = values[cf.name] !== undefined ? values[cf.name] : (cf.defaultValue ?? "");
          const error = errors[cf.name];

          return (
            <div
              key={cf.id}
              className={`flex flex-col gap-1.5 ${
                cf.type === "textarea" ? "sm:col-span-2" : ""
              }`}
              data-testid={`custom-field-container-${cf.name}`}
            >
              <label className="text-xs font-medium text-foreground flex items-center gap-1">
                <span>{cf.label}</span>
                {cf.required && <span className="text-destructive">*</span>}
              </label>

              {/* Text Input */}
              {cf.type === "text" && (
                <Input
                  type="text"
                  placeholder={cf.placeholder}
                  value={val}
                  disabled={disabled}
                  onChange={(e) => onChange(cf.name, e.target.value)}
                  className="h-8 text-xs"
                  data-testid={`custom-field-input-${cf.name}`}
                />
              )}

              {/* Number Input */}
              {cf.type === "number" && (
                <Input
                  type="number"
                  placeholder={cf.placeholder}
                  value={val}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange(cf.name, e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="h-8 text-xs"
                  data-testid={`custom-field-input-${cf.name}`}
                />
              )}

              {/* Date Input */}
              {cf.type === "date" && (
                <Input
                  type="date"
                  value={val ? String(val).split("T")[0] : ""}
                  disabled={disabled}
                  onChange={(e) => onChange(cf.name, e.target.value)}
                  className="h-8 text-xs"
                  data-testid={`custom-field-input-${cf.name}`}
                />
              )}

              {/* Boolean Input */}
              {cf.type === "boolean" && (
                <div className="flex items-center gap-2 pt-1">
                  <Switch
                    checked={Boolean(val)}
                    disabled={disabled}
                    onCheckedChange={(checked) => onChange(cf.name, checked)}
                    data-testid={`custom-field-input-${cf.name}`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {val ? "Enabled" : "Disabled"}
                  </span>
                </div>
              )}

              {/* Select Input */}
              {cf.type === "select" && (
                <select
                  value={val}
                  disabled={disabled}
                  onChange={(e) => onChange(cf.name, e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                  data-testid={`custom-field-input-${cf.name}`}
                >
                  <option value="">Select an option...</option>
                  {(cf.options || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}

              {/* Textarea Input */}
              {cf.type === "textarea" && (
                <Textarea
                  placeholder={cf.placeholder}
                  value={val}
                  disabled={disabled}
                  rows={2}
                  onChange={(e) => onChange(cf.name, e.target.value)}
                  className="text-xs font-sans"
                  data-testid={`custom-field-input-${cf.name}`}
                />
              )}

              {/* Validation Error Message */}
              {error && (
                <span
                  className="text-[11px] text-destructive font-medium"
                  data-testid={`custom-field-error-${cf.name}`}
                >
                  {error}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
