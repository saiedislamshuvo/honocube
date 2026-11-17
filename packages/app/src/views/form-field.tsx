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
import { toHumanLabel, type FormFieldProps } from "@honocube/core";
import { ImagePickerField } from "../media/image-picker-field.js";
import { MaskedNumericInput } from "./masked-numeric-input.js";
import { DateRangePicker } from "./date-range-picker.js";
import { PhoneInputField } from "./phone-input-field.js";
import { ColorPickerField } from "./color-picker-field.js";
import { IconPickerField } from "./icon-picker-field.js";
import { TagsInputField } from "./tags-input-field.js";
import { SlugInputField } from "./slug-input-field.js";
import { BarcodeField } from "./barcode-field.js";
import { QRCodeField } from "./qr-code-field.js";
import { SignaturePad } from "./signature-pad.js";
import { RichTextEditor } from "./rich-text-editor.js";
import { AsyncCombobox } from "./async-combobox.js";
import { RepeaterField } from "./repeater-field.js";

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
  values,
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
              <MaskedNumericInput
                id={name}
                name={name}
                value={fieldState.value}
                onChange={onChange}
                disabled={isDisabled}
                placeholder={field.placeholder}
                min={field.min}
                max={field.max}
                step={field.step}
                precision={(field as any).precision}
                prefix={(field as any).prefix}
                suffix={(field as any).suffix}
                format={(field as any).format || (field.type === "currency" ? "currency" : undefined)}
                currencyCode={(field as any).currencyCode}
                thousandSeparator={(field as any).thousandSeparator}
                allowNegative={(field as any).allowNegative}
                padDecimals={(field as any).padDecimals}
                hasError={Boolean(errorMessage)}
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

          case "daterange":
            return (
              <DateRangePicker
                id={name}
                name={name}
                value={fieldState.value}
                onChange={onChange}
                disabled={isDisabled}
                placeholder={field.placeholder || "Select date range"}
                includeTime={(field as any).includeTime}
                presets={(field as any).presets}
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

          case "relation": {
            const relConfig = field as any;
            return (
              <AsyncCombobox
                id={name}
                name={name}
                value={fieldState.value}
                onChange={(val) => onChange(val)}
                target={relConfig.target}
                endpoint={relConfig.endpoint}
                valueKey={relConfig.valueKey}
                labelKey={relConfig.labelKey}
                subtitleKey={relConfig.subtitleKey}
                pageSize={relConfig.pageSize}
                debounceMs={relConfig.debounceMs}
                filterParams={relConfig.filterParams}
                clearable={relConfig.clearable ?? true}
                searchable={relConfig.searchable ?? true}
                createInline={relConfig.createInline}
                createTitle={relConfig.createTitle}
                createDescription={relConfig.createDescription}
                createCollection={relConfig.createCollection}
                disabled={isDisabled}
                placeholder={field.placeholder || `Select ${relConfig.target || "option"}...`}
                hasError={Boolean(errorMessage)}
              />
            );
          }

          case "image":
          case "media":
            return (
              <ImagePickerField
                id={name}
                value={fieldState.value}
                onChange={onChange}
                multiple={Boolean((field as any).multiple)}
                accept={(field as any).accept || (field.type === "image" ? "image/*" : undefined)}
                maxSize={(field as any).maxSize}
                disabled={isDisabled}
                placeholder={field.placeholder}
                hasError={Boolean(errorMessage)}
              />
            );

          case "phone": {
            const phoneConfig = field as any;
            return (
              <PhoneInputField
                id={name}
                name={name}
                value={fieldState.value}
                onChange={onChange}
                disabled={isDisabled}
                placeholder={field.placeholder}
                defaultCountry={phoneConfig.defaultCountry}
                allowedCountries={phoneConfig.allowedCountries}
                preferredCountries={phoneConfig.preferredCountries}
                hasError={Boolean(errorMessage)}
              />
            );
          }

          case "color": {
            const colorConfig = field as any;
            return (
              <ColorPickerField
                id={name}
                name={name}
                value={fieldState.value}
                onChange={onChange}
                disabled={isDisabled}
                placeholder={field.placeholder}
                presets={colorConfig.presets}
                hasError={Boolean(errorMessage)}
              />
            );
          }

          case "icon": {
            const iconConfig = field as any;
            return (
              <IconPickerField
                id={name}
                name={name}
                value={fieldState.value}
                onChange={onChange}
                disabled={isDisabled}
                placeholder={field.placeholder}
                icons={iconConfig.icons}
                hasError={Boolean(errorMessage)}
              />
            );
          }

          case "tags": {
            const tagsConfig = field as any;
            return (
              <TagsInputField
                id={name}
                name={name}
                value={fieldState.value}
                onChange={onChange}
                disabled={isDisabled}
                placeholder={field.placeholder}
                maxTags={tagsConfig.maxTags}
                suggestions={tagsConfig.suggestions}
                delimiters={tagsConfig.delimiters}
                allowDuplicates={tagsConfig.allowDuplicates}
                hasError={Boolean(errorMessage)}
              />
            );
          }

          case "slug": {
            const slugConfig = field as any;
            const sourceFieldName = slugConfig.from || "title";
            const sourceVal = values ? values[sourceFieldName] : undefined;
            return (
              <SlugInputField
                id={name}
                name={name}
                value={fieldState.value}
                onChange={onChange}
                sourceValue={sourceVal !== undefined ? String(sourceVal) : undefined}
                disabled={isDisabled}
                placeholder={field.placeholder}
                separator={slugConfig.separator}
                lowercase={slugConfig.lowercase}
                locked={slugConfig.locked}
                slugify={slugConfig.slugify}
                hasError={Boolean(errorMessage)}
              />
            );
          }

          case "barcode": {
            const barcodeConfig = field as any;
            return (
              <BarcodeField
                id={name}
                name={name}
                value={fieldState.value}
                onChange={onChange}
                disabled={isDisabled}
                placeholder={field.placeholder}
                format={barcodeConfig.format}
                displayValue={barcodeConfig.displayValue}
                width={barcodeConfig.width}
                height={barcodeConfig.height}
                hasError={Boolean(errorMessage)}
              />
            );
          }

          case "qrcode": {
            const qrConfig = field as any;
            return (
              <QRCodeField
                id={name}
                name={name}
                value={fieldState.value}
                onChange={onChange}
                disabled={isDisabled}
                placeholder={field.placeholder}
                size={qrConfig.size}
                level={qrConfig.level}
                includeMargin={qrConfig.includeMargin}
                hasError={Boolean(errorMessage)}
              />
            );
          }

          case "signature": {
            const sigConfig = field as any;
            const signerName = sigConfig.signerNameField && values ? values[sigConfig.signerNameField] : undefined;
            const signedAt = sigConfig.signedAtField && values ? values[sigConfig.signedAtField] : undefined;
            return (
              <SignaturePad
                id={name}
                name={name}
                value={fieldState.value}
                onChange={onChange}
                disabled={isDisabled}
                penColor={sigConfig.penColor}
                backgroundColor={sigConfig.backgroundColor}
                penWidth={sigConfig.penWidth}
                width={sigConfig.width}
                height={sigConfig.height}
                format={sigConfig.format}
                signerName={signerName !== undefined ? String(signerName) : undefined}
                signedAt={signedAt !== undefined ? String(signedAt) : undefined}
                hasError={Boolean(errorMessage)}
              />
            );
          }

          case "richtext": {
            const rtConfig = field as any;
            return (
              <RichTextEditor
                id={name}
                name={name}
                value={fieldState.value}
                onChange={onChange}
                disabled={isDisabled}
                placeholder={field.placeholder}
                toolbar={rtConfig.toolbar}
                minHeight={rtConfig.minHeight}
                maxHeight={rtConfig.maxHeight}
                format={rtConfig.format}
                hasError={Boolean(errorMessage)}
              />
            );
          }

          case "repeater": {
            const repConfig = field as any;
            return (
              <RepeaterField
                id={name}
                name={name}
                value={Array.isArray(fieldState.value) ? fieldState.value : []}
                onChange={onChange}
                fields={repConfig.fields}
                schema={repConfig.schema}
                label={field.label}
                description={field.description}
                minItems={repConfig.minItems}
                maxItems={repConfig.maxItems}
                layout={repConfig.layout}
                addButtonText={repConfig.addButtonText}
                itemLabel={repConfig.itemLabel}
                collapsible={repConfig.collapsible}
                defaultCollapsed={repConfig.defaultCollapsed}
                allowReorder={repConfig.allowReorder}
                allowClone={repConfig.allowClone}
                disabled={isDisabled}
                hasError={Boolean(errorMessage)}
              />
            );
          }

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
