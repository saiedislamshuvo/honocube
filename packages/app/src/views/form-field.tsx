import React from "react";
import { CalendarIcon, Clock } from "lucide-react";
import {
  Button,
  Calendar,
  Checkbox,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@honocube/ui";
import { toHumanLabel } from "../utils/format.js";
import type { FormFieldProps } from "./types.js";

interface DatePickerFieldProps {
  id: string;
  type: "date" | "datetime";
  value?: string | number | null;
  onChange: (val: string) => void;
  disabled?: boolean;
  placeholder?: string;
  hasError?: boolean;
}

function DatePickerField({
  id,
  type,
  value,
  onChange,
  disabled,
  placeholder = "Pick a date",
  hasError,
}: DatePickerFieldProps) {
  const [open, setOpen] = React.useState(false);

  // Parse value
  const dateValue: Date | undefined = React.useMemo(() => {
    if (!value) return undefined;
    const d = new Date(String(value));
    return isNaN(d.getTime()) ? undefined : d;
  }, [value]);

  const timeValue = React.useMemo(() => {
    if (!value || typeof value !== "string" || !value.includes("T")) return "12:00";
    const parts = value.split("T");
    return parts[1]?.slice(0, 5) || "12:00";
  }, [value]);

  const handleSelectDate = (selected: Date | undefined) => {
    if (!selected) {
      onChange("");
      return;
    }
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${selected.getFullYear()}-${pad(selected.getMonth() + 1)}-${pad(selected.getDate())}`;
    if (type === "datetime") {
      onChange(`${dateStr}T${timeValue}`);
    } else {
      onChange(dateStr);
      setOpen(false);
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    const pad = (n: number) => String(n).padStart(2, "0");
    const baseDate = dateValue || new Date();
    const dateStr = `${baseDate.getFullYear()}-${pad(baseDate.getMonth() + 1)}-${pad(baseDate.getDate())}`;
    onChange(`${dateStr}T${newTime}`);
  };

  const displayText = React.useMemo(() => {
    if (!dateValue) return placeholder;
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${dateValue.getFullYear()}-${pad(dateValue.getMonth() + 1)}-${pad(dateValue.getDate())}`;
    if (type === "datetime") {
      return `${dateStr} ${timeValue}`;
    }
    return dateStr;
  }, [dateValue, type, timeValue, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={`w-full justify-start text-left font-normal h-9 px-3 ${
            !dateValue ? "text-muted-foreground" : ""
          } ${hasError ? "border-destructive text-destructive focus:ring-destructive" : ""}`}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{displayText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleSelectDate}
          autoFocus
        />
        {type === "datetime" && (
          <div className="p-3 border-t border-border flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Time:</span>
            <Input
              type="time"
              value={timeValue}
              onChange={handleTimeChange}
              className="h-8 text-xs flex-1"
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

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

  // Boolean has an inline label next to canonical shadcn Checkbox
  if (field.type === "boolean") {
    return (
      <div className={`space-y-1 ${className}`}>
        <div className="flex items-center space-x-2 pt-2">
          <Checkbox
            id={name}
            checked={Boolean(fieldState.value)}
            onCheckedChange={(checked) => onChange(checked === true)}
            disabled={isDisabled}
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

      {/* Canonical shadcn Field Input Control */}
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
              <DatePickerField
                id={name}
                type={field.type}
                value={fieldState.value}
                onChange={onChange}
                disabled={isDisabled}
                placeholder={field.placeholder || (field.type === "datetime" ? "Pick date & time" : "Pick a date")}
                hasError={Boolean(errorMessage)}
              />
            );

          case "select": {
            const currentValue =
              fieldState.value !== undefined && fieldState.value !== null && fieldState.value !== ""
                ? String(fieldState.value)
                : undefined;
            return (
              <Select
                value={currentValue}
                onValueChange={(val) => onChange(val)}
                disabled={isDisabled}
              >
                <SelectTrigger
                  id={name}
                  className={`w-full ${
                    errorMessage ? "border-destructive focus:ring-destructive" : ""
                  }`}
                >
                  <SelectValue placeholder={field.placeholder || "Select an option..."} />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map((opt: any) => {
                    const val = typeof opt === "object" && opt !== null ? opt.value : opt;
                    const lbl = typeof opt === "object" && opt !== null ? opt.label : opt;
                    return (
                      <SelectItem key={String(val)} value={String(val)}>
                        {String(lbl)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            );
          }

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
