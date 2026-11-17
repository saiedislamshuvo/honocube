import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Button,
  Checkbox,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@honocube/ui";
import {
  toHumanLabel,
  unwrapFieldConfig,
  type RepeaterFieldProps,
} from "@honocube/core";

/**
 * Dynamic form repeater for arbitrary nested field groups, embedded document arrays,
 * and variable-length enterprise entities (such as invoice line items, pricing tiers,
 * or custom attribute specifications).
 */
export function RepeaterField({
  id,
  name,
  value,
  onChange,
  fields: inputFields,
  schema: inputSchema,
  label,
  description,
  minItems = 0,
  maxItems,
  layout = "cards",
  addButtonText = "Add item",
  itemLabel = "Item",
  collapsible = true,
  defaultCollapsed = false,
  allowReorder = true,
  allowClone = true,
  disabled = false,
  readOnly = false,
  hasError = false,
  className = "",
}: RepeaterFieldProps): React.JSX.Element {
  const items: any[] = Array.isArray(value) ? value : [];
  const isDisabled = disabled || readOnly;

  // Normalized child fields configuration
  const childFields: Record<string, any> = inputFields || inputSchema || {};
  const childKeys = Object.keys(childFields);
  const isPrimitive = childKeys.length === 0;

  // Collapsed items state (by index)
  const [collapsedIndices, setCollapsedIndices] = React.useState<Set<number>>(() => {
    if (defaultCollapsed) {
      return new Set(items.map((_, i) => i));
    }
    return new Set();
  });

  const toggleCollapse = (idx: number) => {
    if (!collapsible) return;
    setCollapsedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  // Add new empty item
  const handleAddItem = () => {
    if (isDisabled) return;
    if (maxItems !== undefined && items.length >= maxItems) return;

    let newItem: any;
    if (isPrimitive) {
      newItem = "";
    } else {
      newItem = {};
      childKeys.forEach((key) => {
        const fieldConfig: any = unwrapFieldConfig(childFields[key]);
        const defaultVal =
          typeof fieldConfig?.default === "function"
            ? (fieldConfig.default as () => any)()
            : fieldConfig?.default;

        if (defaultVal !== undefined) {
          newItem[key] = defaultVal;
        } else if (fieldConfig?.type === "number" || fieldConfig?.type === "currency") {
          newItem[key] = 0;
        } else if (fieldConfig?.type === "boolean") {
          newItem[key] = false;
        } else {
          newItem[key] = "";
        }
      });
    }

    onChange([...items, newItem]);
  };

  // Remove item
  const handleRemoveItem = (idx: number) => {
    if (isDisabled) return;
    if (minItems !== undefined && items.length <= minItems) return;

    const next = items.filter((_, i) => i !== idx);
    onChange(next);

    setCollapsedIndices((prev) => {
      const nextSet = new Set<number>();
      prev.forEach((i) => {
        if (i < idx) nextSet.add(i);
        else if (i > idx) nextSet.add(i - 1);
      });
      return nextSet;
    });
  };

  // Duplicate / Clone item
  const handleCloneItem = (idx: number) => {
    if (isDisabled || !allowClone) return;
    if (maxItems !== undefined && items.length >= maxItems) return;

    try {
      const cloned = JSON.parse(JSON.stringify(items[idx]));
      const next = [...items];
      next.splice(idx + 1, 0, cloned);
      onChange(next);
    } catch {
      const cloned = { ...items[idx] };
      const next = [...items];
      next.splice(idx + 1, 0, cloned);
      onChange(next);
    }
  };

  // Reorder item up
  const handleMoveUp = (idx: number) => {
    if (isDisabled || !allowReorder || idx <= 0) return;
    const next = [...items];
    const target = next[idx];
    const prev = next[idx - 1];
    next[idx - 1] = target;
    next[idx] = prev;
    onChange(next);
  };

  // Reorder item down
  const handleMoveDown = (idx: number) => {
    if (isDisabled || !allowReorder || idx >= items.length - 1) return;
    const next = [...items];
    const target = next[idx];
    const subsequent = next[idx + 1];
    next[idx + 1] = target;
    next[idx] = subsequent;
    onChange(next);
  };

  // Change field in item
  const handleItemFieldChange = (itemIdx: number, fieldKey: string, fieldVal: any) => {
    if (isDisabled) return;
    const next = [...items];
    const currentObj =
      typeof next[itemIdx] === "object" && next[itemIdx] !== null ? next[itemIdx] : {};
    next[itemIdx] = {
      ...currentObj,
      [fieldKey]: fieldVal,
    };
    onChange(next);
  };

  // Change primitive item
  const handlePrimitiveItemChange = (itemIdx: number, val: any) => {
    if (isDisabled) return;
    const next = [...items];
    next[itemIdx] = val;
    onChange(next);
  };

  const canAdd = !isDisabled && (maxItems === undefined || items.length < maxItems);
  const canRemove = (_idx: number) => !isDisabled && (minItems === undefined || items.length > minItems);

  // Render individual child field input
  const renderFieldInput = (
    item: any,
    itemIdx: number,
    fieldKey: string,
    fieldDef: any
  ) => {
    const fieldConfig: any = unwrapFieldConfig(fieldDef);
    const fieldType = fieldConfig?.type || "text";
    const fieldVal = item?.[fieldKey];
    const fieldId = `${name}-${itemIdx}-${fieldKey}`;

    if (fieldType === "boolean") {
      return (
        <div className="flex items-center gap-2 pt-2">
          <Checkbox
            id={fieldId}
            checked={Boolean(fieldVal)}
            disabled={isDisabled}
            onCheckedChange={(checked) =>
              handleItemFieldChange(itemIdx, fieldKey, Boolean(checked))
            }
          />
          <label
            htmlFor={fieldId}
            className="text-xs font-medium cursor-pointer text-foreground"
          >
            {fieldConfig?.label || toHumanLabel(fieldKey)}
          </label>
        </div>
      );
    }

    if (fieldType === "select" && fieldConfig?.options) {
      return (
        <div className="space-y-1">
          <label
            htmlFor={fieldId}
            className="text-xs font-medium text-foreground block"
          >
            {fieldConfig?.label || toHumanLabel(fieldKey)}
            {fieldConfig?.required && <span className="text-destructive ml-0.5">*</span>}
          </label>
          <Select
            value={fieldVal !== undefined && fieldVal !== null ? String(fieldVal) : ""}
            onValueChange={(val) => handleItemFieldChange(itemIdx, fieldKey, val)}
            disabled={isDisabled}
          >
            <SelectTrigger id={fieldId} className="h-9 text-xs">
              <SelectValue placeholder={fieldConfig.placeholder || "Select..."} />
            </SelectTrigger>
            <SelectContent>
              {fieldConfig.options.map((opt: any) => {
                const optVal = typeof opt === "object" && opt !== null ? opt.value : opt;
                const optLabel = typeof opt === "object" && opt !== null ? opt.label : opt;
                return (
                  <SelectItem key={String(optVal)} value={String(optVal)}>
                    {String(optLabel)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <label
          htmlFor={fieldId}
          className="text-xs font-medium text-foreground block"
        >
          {fieldConfig?.label || toHumanLabel(fieldKey)}
          {fieldConfig?.required && <span className="text-destructive ml-0.5">*</span>}
        </label>
        <Input
          id={fieldId}
          type={fieldType === "number" || fieldType === "currency" ? "number" : fieldType === "date" ? "date" : "text"}
          value={fieldVal !== undefined && fieldVal !== null ? String(fieldVal) : ""}
          placeholder={fieldConfig?.placeholder}
          disabled={isDisabled}
          onChange={(e) => {
            const raw = e.target.value;
            const parsed =
              fieldType === "number" || fieldType === "currency"
                ? raw === ""
                  ? ""
                  : Number(raw)
                : raw;
            handleItemFieldChange(itemIdx, fieldKey, parsed);
          }}
          className="h-9 text-xs"
        />
      </div>
    );
  };

  return (
    <div
      id={id}
      data-testid="repeater-field-container"
      className={cn(
        "space-y-3 rounded-lg border bg-background p-4",
        hasError && "border-destructive",
        className
      )}
    >
      {/* 1. Header with title, counter, and Add Item button */}
      <div className="flex items-center justify-between gap-2 border-b pb-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <span>{label || toHumanLabel(name)}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {`(${items.length} ${items.length === 1 ? "item" : "items"}${
                maxItems !== undefined ? ` / max ${maxItems}` : ""
              })`}
            </span>
          </h4>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>

        {canAdd && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="repeater-add-btn"
            onClick={handleAddItem}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{addButtonText}</span>
          </Button>
        )}
      </div>

      {/* 2. Empty State */}
      {items.length === 0 ? (
        <div
          data-testid="repeater-empty-state"
          className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground"
        >
          <p>No items added yet.</p>
          {canAdd && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={handleAddItem}
              className="mt-1 h-auto text-xs text-primary p-0"
            >
              {addButtonText}
            </Button>
          )}
        </div>
      ) : layout === "table" && !isPrimitive ? (
        /* 3A. Table Layout Mode */
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {allowReorder && !isDisabled && (
                  <TableHead className="w-12 text-center text-xs">#</TableHead>
                )}
                {childKeys.map((k) => (
                  <TableHead key={k} className="text-xs whitespace-nowrap">
                    {childFields[k]?.label || toHumanLabel(k)}
                  </TableHead>
                ))}
                {!isDisabled && <TableHead className="w-24 text-right text-xs">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow
                  key={idx}
                  data-testid="repeater-item"
                  data-index={idx}
                >
                  {allowReorder && !isDisabled && (
                    <TableCell className="text-center text-xs text-muted-foreground p-2">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          aria-label="Move item up"
                          data-testid="repeater-item-move-up"
                          disabled={idx === 0}
                          onClick={() => handleMoveUp(idx)}
                          className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Move item down"
                          data-testid="repeater-item-move-down"
                          disabled={idx === items.length - 1}
                          onClick={() => handleMoveDown(idx)}
                          className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  )}

                  {childKeys.map((k) => (
                    <TableCell key={k} className="p-2">
                      {renderFieldInput(item, idx, k, childFields[k])}
                    </TableCell>
                  ))}

                  {!isDisabled && (
                    <TableCell className="text-right p-2 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {allowClone && (
                          <button
                            type="button"
                            aria-label="Duplicate item"
                            title="Duplicate item"
                            data-testid="repeater-item-clone"
                            onClick={() => handleCloneItem(idx)}
                            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canRemove(idx) && (
                          <button
                            type="button"
                            aria-label="Delete item"
                            title="Delete item"
                            data-testid="repeater-item-delete"
                            onClick={() => handleRemoveItem(idx)}
                            className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* 3B. Cards / Stack Layout Mode */
        <div className="space-y-3">
          {items.map((item, idx) => {
            const isCollapsed = collapsedIndices.has(idx);
            const titleValue =
              typeof item === "object" && item !== null
                ? item.title || item.name || item.label || `${itemLabel} #${idx + 1}`
                : `${itemLabel} #${idx + 1}`;

            return (
              <div
                key={idx}
                data-testid="repeater-item"
                data-index={idx}
                className={cn(
                  "rounded-md border bg-card text-card-foreground shadow-sm transition-all",
                  layout === "stack" ? "p-3" : "overflow-hidden"
                )}
              >
                {/* Item Card Header */}
                <div
                  className={cn(
                    "flex items-center justify-between px-3 py-2 bg-muted/40 border-b",
                    collapsible && "cursor-pointer select-none"
                  )}
                  onClick={() => toggleCollapse(idx)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {allowReorder && !isDisabled && (
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-60" />
                    )}

                    <span className="text-xs font-semibold truncate text-foreground">
                      {String(titleValue)}
                    </span>
                  </div>

                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {allowReorder && !isDisabled && (
                      <>
                        <button
                          type="button"
                          aria-label="Move item up"
                          title="Move up"
                          data-testid="repeater-item-move-up"
                          disabled={idx === 0}
                          onClick={() => handleMoveUp(idx)}
                          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Move item down"
                          title="Move down"
                          data-testid="repeater-item-move-down"
                          disabled={idx === items.length - 1}
                          onClick={() => handleMoveDown(idx)}
                          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}

                    {allowClone && !isDisabled && (
                      <button
                        type="button"
                        aria-label="Duplicate item"
                        title="Duplicate item"
                        data-testid="repeater-item-clone"
                        onClick={() => handleCloneItem(idx)}
                        className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {canRemove(idx) && (
                      <button
                        type="button"
                        aria-label="Delete item"
                        title="Delete item"
                        data-testid="repeater-item-delete"
                        onClick={() => handleRemoveItem(idx)}
                        className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {collapsible && (
                      <button
                        type="button"
                        aria-label={isCollapsed ? "Expand item" : "Collapse item"}
                        title={isCollapsed ? "Expand" : "Collapse"}
                        data-testid="repeater-item-collapse-toggle"
                        onClick={() => toggleCollapse(idx)}
                        className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted ml-0.5"
                      >
                        {isCollapsed ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronUp className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Item Card Body */}
                {!isCollapsed && (
                  <div className="p-3">
                    {isPrimitive ? (
                      <div className="space-y-1">
                        <Input
                          value={item !== undefined && item !== null ? String(item) : ""}
                          placeholder={`Enter ${itemLabel.toLowerCase()}...`}
                          disabled={isDisabled}
                          onChange={(e) =>
                            handlePrimitiveItemChange(idx, e.target.value)
                          }
                          className="h-9 text-xs"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {childKeys.map((k) => (
                          <div key={k}>
                            {renderFieldInput(item, idx, k, childFields[k])}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
