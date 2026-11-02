import React from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@honocube/ui";
import { toHumanLabel } from "../utils/format.js";
import type { ChildTableProps } from "./types.js";

export function ChildTable({
  name,
  field,
  childHelper,
  disabled = false,
  className = "",
}: ChildTableProps): React.JSX.Element {
  const childFields: Record<string, any> =
    childHelper.childCollection?.fields || field.collection?.fields || {};
  const childKeys = Object.keys(childFields);

  const totalCols = childKeys.length + (disabled ? 0 : 1);

  return (
    <div className={`space-y-2 rounded-md border p-3 bg-background ${className}`}>
      {/* 1. Header with Title and Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold">
            {field.label || toHumanLabel(name)}
            <span className="text-xs font-normal text-muted-foreground ml-1.5">
              {`(${childHelper.count} ${childHelper.count === 1 ? "item" : "items"})`}
            </span>
          </h4>
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
        </div>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => childHelper.addRow()}
            className="h-8 gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add row</span>
          </Button>
        )}
      </div>

      {/* 2. Embedded Line Items Table */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {childKeys.map((key) => (
                <TableHead key={key} className="text-xs whitespace-nowrap">
                  {childFields[key]?.label || toHumanLabel(key)}
                  {childFields[key]?.required && (
                    <span className="text-destructive ml-0.5">*</span>
                  )}
                </TableHead>
              ))}
              {!disabled && (
                <TableHead className="w-[50px] text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {childHelper.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={totalCols}
                  className="h-20 text-center text-sm text-muted-foreground"
                >
                  No items added yet.
                  {!disabled && ' Click "Add row" to insert a line item.'}
                </TableCell>
              </TableRow>
            ) : (
              childHelper.rows.map((row, index) => {
                const rowErrors = childHelper.getRowErrors(index) || {};

                return (
                  <TableRow key={index}>
                    {childKeys.map((key) => {
                      const colField = childFields[key];
                      const isComputed = colField?.type === "computed";
                      const isColDisabled = Boolean(disabled || isComputed || colField?.readOnly);
                      const colError = rowErrors[key]?.[0];
                      const val = row[key];

                      return (
                        <TableCell key={key} className="align-top py-2">
                          {colField?.type === "number" || colField?.type === "currency" ? (
                            <Input
                              type="number"
                              step={colField?.step ?? (colField?.type === "currency" ? "0.01" : "any")}
                              value={val ?? ""}
                              onChange={(e) =>
                                childHelper.updateRow(index, {
                                  [key]: e.target.value === "" ? 0 : Number(e.target.value),
                                })
                              }
                              disabled={isColDisabled}
                              className={`h-8 text-xs ${colError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                            />
                          ) : colField?.type === "select" ? (
                            <select
                              value={String(val ?? "")}
                              onChange={(e) =>
                                childHelper.updateRow(index, {
                                  [key]: e.target.value,
                                })
                              }
                              disabled={isColDisabled}
                              className={`flex h-8 w-full rounded-md border bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50 ${
                                colError
                                  ? "border-destructive focus-visible:ring-destructive"
                                  : "border-input focus-visible:ring-ring"
                              }`}
                            >
                              <option value="">Select...</option>
                              {colField.options?.map((opt: any) => {
                                const optVal = typeof opt === "object" && opt !== null ? opt.value : opt;
                                const optLbl = typeof opt === "object" && opt !== null ? opt.label : opt;
                                return (
                                  <option key={String(optVal)} value={String(optVal)}>
                                    {String(optLbl)}
                                  </option>
                                );
                              })}
                            </select>
                          ) : (
                            <Input
                              value={val ?? ""}
                              onChange={(e) =>
                                childHelper.updateRow(index, {
                                  [key]: e.target.value,
                                })
                              }
                              disabled={isColDisabled}
                              className={`h-8 text-xs ${
                                isComputed ? "bg-muted cursor-not-allowed font-mono text-muted-foreground" : ""
                              } ${colError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                            />
                          )}

                          {colError && (
                            <p className="text-[10px] font-medium text-destructive mt-0.5">
                              {colError}
                            </p>
                          )}
                        </TableCell>
                      );
                    })}

                    {!disabled && (
                      <TableCell className="align-top py-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => childHelper.removeRow(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove row</span>
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
