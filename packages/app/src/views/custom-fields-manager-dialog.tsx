import * as React from "react";
import { useState } from "react";
import {
  Plus,
  Trash2,
  FolderKanban,
} from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Badge,
} from "@honocube/ui";
import type {
  CustomFieldDefinition,
  CustomFieldType,
  CustomFieldsManagerDialogProps,
} from "@honocube/core";

export function CustomFieldsManagerDialog({
  open,
  onOpenChange,
  collectionName,
  customFields = [],
  onSaveField,
  onDeleteField,
  isLoading = false,
}: CustomFieldsManagerDialogProps): React.JSX.Element | null {
  const [label, setLabel] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<CustomFieldType>("text");
  const [optionsStr, setOptionsStr] = useState("");
  const [placeholder, setPlaceholder] = useState("");
  const [required, setRequired] = useState(false);
  const [isNameManuallyEdited, setIsNameManuallyEdited] = useState(false);

  // Helper to slugify label into camelCase identifier
  const toCamelCase = (str: string) => {
    return str
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .trim()
      .split(/\s+/)
      .map((word, i) =>
        i === 0
          ? word.toLowerCase()
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join("");
  };

  const handleLabelChange = (newLabel: string) => {
    setLabel(newLabel);
    if (!isNameManuallyEdited) {
      setName(toCamelCase(newLabel));
    }
  };

  const handleAddField = async () => {
    if (!label.trim() || !name.trim() || !onSaveField) return;

    const options =
      type === "select"
        ? optionsStr
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    const newField: CustomFieldDefinition = {
      id: `cf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      collection: collectionName,
      name: name.trim(),
      label: label.trim(),
      type,
      options,
      placeholder: placeholder.trim() || undefined,
      required,
      position: customFields.length + 1,
    };

    await onSaveField(newField);

    // Reset form
    setLabel("");
    setName("");
    setType("text");
    setOptionsStr("");
    setPlaceholder("");
    setRequired(false);
    setIsNameManuallyEdited(false);
  };

  // SSR fallback
  if (typeof document === "undefined") {
    if (!open) return null;
    return (
      <div data-testid="custom-fields-manager-dialog" className="hidden">
        <span>{`Manage Custom Fields for ${collectionName}`}</span>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="custom-fields-manager-dialog" className="sm:max-w-[620px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FolderKanban className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Manage Custom Fields
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Define runtime business attributes for{" "}
                <span className="font-medium text-foreground">{collectionName}</span> without modifying database schemas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2 text-xs">
          {/* Existing Custom Fields */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-foreground">
                Active Custom Fields ({customFields.length})
              </span>
            </div>

            {customFields.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center text-muted-foreground">
                No custom fields defined yet for this collection.
              </div>
            ) : (
              <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
                {customFields.map((cf) => (
                  <div
                    key={cf.id}
                    className="flex items-center justify-between p-2.5 hover:bg-muted/30"
                    data-testid={`custom-field-row-${cf.name}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{cf.label}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          ({cf.name})
                        </span>
                        {cf.required && (
                          <Badge variant="destructive" className="text-[9px] h-4 px-1">
                            Required
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span className="capitalize">{cf.type}</span>
                        {cf.type === "select" && cf.options && (
                          <span>• Options: {cf.options.join(", ")}</span>
                        )}
                        {cf.placeholder && <span>• Hint: {cf.placeholder}</span>}
                      </div>
                    </div>
                    {onDeleteField && (
                      <button
                        type="button"
                        onClick={() => onDeleteField(cf.id)}
                        className="text-muted-foreground hover:text-destructive cursor-pointer p-1"
                        title="Delete custom field"
                        data-testid={`delete-field-${cf.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Custom Field Form */}
          <div className="rounded-md border p-3 bg-muted/15 flex flex-col gap-3">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5 text-primary" />
              <span>Add New Custom Field</span>
            </span>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-medium text-foreground block mb-1">
                  Field Label *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Serial Number"
                  value={label}
                  onChange={(e) => handleLabelChange(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                  data-testid="new-field-label"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-foreground block mb-1">
                  Identifier Name (API/Payload) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. serialNumber"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setIsNameManuallyEdited(true);
                  }}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs font-mono"
                  data-testid="new-field-name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-medium text-foreground block mb-1">
                  Field Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as CustomFieldType)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                  data-testid="new-field-type"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="boolean">Boolean (Checkbox/Switch)</option>
                  <option value="select">Dropdown Select</option>
                  <option value="textarea">Multi-line Text (Textarea)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-foreground block mb-1">
                  Placeholder / Hint
                </label>
                <input
                  type="text"
                  placeholder="e.g. SN-XXXXX"
                  value={placeholder}
                  onChange={(e) => setPlaceholder(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                />
              </div>
            </div>

            {type === "select" && (
              <div>
                <label className="text-[11px] font-medium text-foreground block mb-1">
                  Dropdown Options (comma-separated) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. High, Medium, Low"
                  value={optionsStr}
                  onChange={(e) => setOptionsStr(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                  data-testid="new-field-options"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={required}
                  onChange={(e) => setRequired(e.target.checked)}
                  className="rounded border-input text-primary"
                  data-testid="new-field-required"
                />
                <span className="font-medium">Mandatory / Required Field</span>
              </label>

              <Button
                type="button"
                size="sm"
                onClick={handleAddField}
                disabled={!label.trim() || !name.trim() || (type === "select" && !optionsStr.trim()) || isLoading}
                data-testid="add-custom-field-button"
                className="gap-1.5 h-8"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Field</span>
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
