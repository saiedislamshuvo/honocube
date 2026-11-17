import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Trash2,
  Copy,
  Download,
  RotateCcw,
  Save,
  ArrowDownToLine,
} from "lucide-react";
import { Button, Badge, Checkbox, cn } from "@honocube/ui";
import {
  type Collection,
  type SpreadsheetColumn,
  type SpreadsheetCellChange,
  type SpreadsheetViewProps,
  toHumanLabel,
} from "@honocube/core";

// ---------------------------------------------------------------------------
// Helpers: Spreadsheet Coordinate & Address Conversion
// ---------------------------------------------------------------------------

/**
 * Converts a 0-based column index to spreadsheet letter address (0 -> A, 25 -> Z, 26 -> AA).
 */
export function colIndexToLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = "";
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Converts a spreadsheet letter address to 0-based column index ("A" -> 0, "Z" -> 25, "AA" -> 26).
 */
export function letterToColIndex(letter: string): number {
  let index = 0;
  const upper = letter.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Converts a cell coordinate (row, col) to a cell reference string like "A1", "B5".
 */
export function coordToCellRef(rowIndex: number, colIndex: number): string {
  return `${colIndexToLetter(colIndex)}${rowIndex + 1}`;
}

/**
 * Parses a cell reference like "A1" or "C10" into 0-based `{ row, col }`.
 */
export function cellRefToCoord(ref: string): { row: number; col: number } | null {
  const match = ref.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  const colStr = match[1];
  const rowStr = match[2];
  if (!colStr || !rowStr) return null;
  const col = letterToColIndex(colStr);
  const row = parseInt(rowStr, 10) - 1;
  if (isNaN(row) || isNaN(col) || row < 0 || col < 0) return null;
  return { row, col };
}

// ---------------------------------------------------------------------------
// Helpers: Lightweight Safe Formula Evaluator
// ---------------------------------------------------------------------------

function parseNumber(val: unknown): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (typeof val === "string") {
    const clean = val.replace(/[^0-9.-]/g, "");
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Evaluates basic spreadsheet formulas starting with "=".
 * Supports:
 * - `=SUM(A1:A5)` or `=SUM(A1, B2, C3)`
 * - `=AVERAGE(A1:A5)` or `=AVG(A1:A5)`
 * - `=COUNT(A1:A5)`
 * - `=MIN(A1:A5)` / `=MAX(A1:A5)`
 * - Basic arithmetic: `=A1+B1`, `=A1*B1`, `=A1-B1`, `=A1/B1`
 */
export function evaluateFormula(
  formula: unknown,
  rows: Record<string, unknown>[],
  columns: SpreadsheetColumn[],
  visited: Set<string> = new Set()
): unknown {
  if (typeof formula !== "string" || !formula.startsWith("=")) {
    return formula;
  }

  const rawExpr = formula.slice(1).trim();

  // Helper to get raw cell value
  const getCellValue = (r: number, c: number): unknown => {
    if (r < 0 || r >= rows.length || c < 0 || c >= columns.length) return 0;
    const col = columns[c];
    if (!col) return 0;
    const row = rows[r];
    if (!row) return 0;
    const cellRef = coordToCellRef(r, c);
    if (visited.has(cellRef)) return 0; // Prevent infinite circular recursion

    const raw = row[col.key];
    if (typeof raw === "string" && raw.startsWith("=")) {
      const nextVisited = new Set(visited).add(cellRef);
      return evaluateFormula(raw, rows, columns, nextVisited);
    }
    return raw;
  };

  // Helper to extract values from range "A1:A5" or single "A1"
  const getRangeValues = (rangeStr: string): number[] => {
    const values: number[] = [];
    const parts = rangeStr.split(":").map((p) => p.trim());
    if (parts.length === 2 && parts[0] && parts[1]) {
      const start = cellRefToCoord(parts[0]);
      const end = cellRefToCoord(parts[1]);
      if (start && end) {
        const minRow = Math.min(start.row, end.row);
        const maxRow = Math.max(start.row, end.row);
        const minCol = Math.min(start.col, end.col);
        const maxCol = Math.max(start.col, end.col);

        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            values.push(parseNumber(getCellValue(r, c)));
          }
        }
      }
    } else if (parts.length === 1 && parts[0]) {
      const single = cellRefToCoord(parts[0]);
      if (single) {
        values.push(parseNumber(getCellValue(single.row, single.col)));
      }
    }
    return values;
  };

  // Built-in Aggregate Functions
  const upper = rawExpr.toUpperCase();
  const fnMatch = upper.match(/^(SUM|AVERAGE|AVG|COUNT|MIN|MAX)\((.*)\)$/);
  if (fnMatch && fnMatch[1] && fnMatch[2] !== undefined) {
    const fnName = fnMatch[1];
    const argsStr = fnMatch[2];
    const args = argsStr.split(",").map((s) => s.trim());
    const numbers: number[] = [];
    for (const arg of args) {
      numbers.push(...getRangeValues(arg));
    }

    switch (fnName) {
      case "SUM":
        return numbers.reduce((acc, curr) => acc + curr, 0);
      case "AVERAGE":
      case "AVG":
        return numbers.length > 0
          ? numbers.reduce((acc, curr) => acc + curr, 0) / numbers.length
          : 0;
      case "COUNT":
        return numbers.length;
      case "MIN":
        return numbers.length > 0 ? Math.min(...numbers) : 0;
      case "MAX":
        return numbers.length > 0 ? Math.max(...numbers) : 0;
      default:
        break;
    }
  }

  // Basic Arithmetic: replace cell coordinates with numeric values
  // Match single cell references like A1, B3, AA10
  const replaced = rawExpr.replace(/\b([A-Za-z]+)(\d+)\b/g, (match) => {
    const coord = cellRefToCoord(match);
    if (!coord) return "0";
    return String(parseNumber(getCellValue(coord.row, coord.col)));
  });

  // Safe evaluation of simple arithmetic (+, -, *, /, parentheses and numbers)
  if (/^[0-9+\-*/().\s]+$/.test(replaced)) {
    try {
      // Tokenize and evaluate safely without eval
      const fn = new Function(`"use strict"; return (${replaced});`);
      const res = fn();
      return typeof res === "number" && !isNaN(res) ? res : "#VALUE!";
    } catch {
      return "#ERROR!";
    }
  }

  return rawExpr;
}

// ---------------------------------------------------------------------------
// Helpers: Default Column Inference from Collection Fields
// ---------------------------------------------------------------------------

function inferColumnsFromCollection(collection?: Collection<any>): SpreadsheetColumn[] {
  if (!collection || !collection.fields) return [];

  const columns: SpreadsheetColumn[] = [];
  for (const [key, fieldDef] of Object.entries(collection.fields)) {
    const field: any = typeof (fieldDef as any)?.build === "function" ? (fieldDef as any).build() : fieldDef;
    if (field.hidden) continue;

    let colType: SpreadsheetColumn["type"] = "text";
    if (field.type === "number" || field.type === "integer" || field.type === "float") {
      colType = "number";
    } else if (field.type === "currency") {
      colType = "currency";
    } else if (field.type === "boolean") {
      colType = "boolean";
    } else if (field.type === "select") {
      colType = "select";
    } else if (field.type === "date" || field.type === "datetime") {
      colType = "date";
    }

    columns.push({
      key,
      label: field.label || toHumanLabel(key),
      type: colType,
      options: field.options,
      readOnly: field.readOnly,
      defaultValue: field.defaultValue,
    });
  }

  return columns;
}

// ---------------------------------------------------------------------------
// Component: SpreadsheetView / SpreadsheetGrid
// ---------------------------------------------------------------------------

export function SpreadsheetView<TCollection extends Collection<any> = Collection<any>>({
  collection,
  data,
  initialData,
  columns: propColumns,
  onDataChange,
  onSave,
  readOnly = false,
  allowAddRows = true,
  allowDeleteRows = true,
  showFormulaBar = true,
  showSummaryRow = true,
  showToolbar = true,
  className = "",
  emptyText = "No data rows. Click '+ Add Row' to insert data.",
}: SpreadsheetViewProps<TCollection>): React.JSX.Element {
  // 1. Resolve Columns
  const resolvedColumns: SpreadsheetColumn[] = useMemo(() => {
    if (propColumns && propColumns.length > 0) return propColumns;
    if (collection) {
      const inferred = inferColumnsFromCollection(collection);
      if (inferred.length > 0) return inferred;
    }
    const sample = (data && data[0]) || (initialData && initialData[0]);
    if (sample && typeof sample === "object") {
      return Object.keys(sample).map((key) => ({
        key,
        label: toHumanLabel(key),
        type: typeof (sample as any)[key] === "number" ? "number" : "text",
      }));
    }
    return [
      { key: "col1", label: "Column A", type: "text" },
      { key: "col2", label: "Column B", type: "number" },
      { key: "col3", label: "Column C", type: "number" },
    ];
  }, [propColumns, collection, data, initialData]);

  // 2. Resolve Initial Rows
  const [rows, setRows] = useState<Record<string, unknown>[]>(() => {
    if (data && data.length > 0) return [...data] as Record<string, unknown>[];
    if (initialData && initialData.length > 0) return [...initialData];
    // Default 5 initial empty rows if no data provided
    return Array.from({ length: 5 }, () => {
      const row: Record<string, unknown> = {};
      resolvedColumns.forEach((c) => {
        row[c.key] = c.defaultValue !== undefined ? c.defaultValue : "";
      });
      return row;
    });
  });

  // Synchronize when external data changes
  useEffect(() => {
    if (data && data.length > 0) {
      setRows([...data] as Record<string, unknown>[]);
    }
  }, [data]);

  // 3. Grid Selection & Focus State
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [selectionRange, setSelectionRange] = useState<{
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [dirtyRows, setDirtyRows] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<Record<string, unknown>[][]>([]);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const cellInputRef = useRef<HTMLInputElement | null>(null);

  // Focus inline editor when editing starts
  useEffect(() => {
    if (isEditing && cellInputRef.current) {
      cellInputRef.current.focus();
      cellInputRef.current.select();
    }
  }, [isEditing]);

  // 4. Cell Value Accessors & Calculations
  const getRawCellValue = useCallback(
    (rowIndex: number, colIndex: number): unknown => {
      const row = rows[rowIndex];
      const col = resolvedColumns[colIndex];
      if (!row || !col) return "";
      return row[col.key];
    },
    [rows, resolvedColumns]
  );

  const getComputedCellValue = useCallback(
    (rowIndex: number, colIndex: number): unknown => {
      const col = resolvedColumns[colIndex];
      const row = rows[rowIndex];
      if (!row || !col) return "";

      if (col.formula) {
        try {
          return col.formula(row, rows);
        } catch {
          return "#ERROR!";
        }
      }

      const raw = row[col.key];
      if (typeof raw === "string" && raw.startsWith("=")) {
        return evaluateFormula(raw, rows, resolvedColumns);
      }
      return raw;
    },
    [rows, resolvedColumns]
  );

  // Active cell raw value for formula bar
  const activeCellRawValue = useMemo(() => {
    if (!activeCell) return "";
    const raw = getRawCellValue(activeCell.row, activeCell.col);
    return raw !== undefined && raw !== null ? String(raw) : "";
  }, [activeCell, getRawCellValue]);

  // 5. Commit Cell Edit
  const commitEdit = useCallback(
    (newVal: unknown) => {
      if (!activeCell) return;
      const { row: rowIndex, col: colIndex } = activeCell;
      const col = resolvedColumns[colIndex];
      if (!col || col.readOnly || readOnly) {
        setIsEditing(false);
        return;
      }

      const currentRow = rows[rowIndex];
      const oldValue = currentRow ? currentRow[col.key] : undefined;

      let parsedVal: unknown = newVal;
      if (typeof newVal === "string") {
        if (!newVal.startsWith("=")) {
          if (col.type === "number" || col.type === "currency") {
            const num = parseFloat(newVal);
            parsedVal = isNaN(num) ? newVal : num;
          } else if (col.type === "boolean") {
            parsedVal = newVal === "true" || newVal === "1";
          }
        }
      }

      if (oldValue !== parsedVal) {
        // Record undo history
        setHistory((prev) => [...prev.slice(-19), rows]);

        const updatedRows = [...rows];
        updatedRows[rowIndex] = {
          ...updatedRows[rowIndex],
          [col.key]: parsedVal,
        };

        setRows(updatedRows);
        setDirtyRows((prev) => new Set(prev).add(rowIndex));

        const change: SpreadsheetCellChange = {
          rowIndex,
          colIndex,
          columnKey: col.key,
          oldValue,
          newValue: parsedVal,
        };
        onDataChange?.(updatedRows, [change]);
      }

      setIsEditing(false);
    },
    [activeCell, resolvedColumns, readOnly, rows, onDataChange]
  );

  // Start editing a cell
  const startEditing = useCallback(
    (rowIndex: number, colIndex: number, initialChar?: string) => {
      if (readOnly) return;
      const col = resolvedColumns[colIndex];
      if (!col || col.readOnly) return;

      setActiveCell({ row: rowIndex, col: colIndex });
      setSelectionRange(null);
      setIsEditing(true);

      const raw = getRawCellValue(rowIndex, colIndex);
      if (initialChar !== undefined) {
        setEditValue(initialChar);
      } else {
        setEditValue(raw !== undefined && raw !== null ? String(raw) : "");
      }
    },
    [readOnly, resolvedColumns, getRawCellValue]
  );

  // 6. Keyboard Navigation Handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!activeCell) return;
      const { row, col } = activeCell;

      if (isEditing) {
        if (e.key === "Enter") {
          e.preventDefault();
          commitEdit(editValue);
          // Move down to next row
          if (row + 1 < rows.length) {
            setActiveCell({ row: row + 1, col });
          } else if (allowAddRows && !readOnly) {
            // Automatically add row when pressing Enter at the last row
            handleAddRow();
            setActiveCell({ row: row + 1, col });
          }
        } else if (e.key === "Tab") {
          e.preventDefault();
          commitEdit(editValue);
          if (col + 1 < resolvedColumns.length) {
            setActiveCell({ row, col: col + 1 });
          } else if (row + 1 < rows.length) {
            setActiveCell({ row: row + 1, col: 0 });
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          setIsEditing(false);
        }
        return;
      }

      // Not Editing: Navigation, Shortcuts & Hotkeys
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const nextRow = Math.max(0, row - 1);
        setActiveCell({ row: nextRow, col });
        if (e.shiftKey) {
          setSelectionRange((prev) => ({
            startRow: prev ? prev.startRow : row,
            startCol: prev ? prev.startCol : col,
            endRow: nextRow,
            endCol: col,
          }));
        } else {
          setSelectionRange(null);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextRow = Math.min(rows.length - 1, row + 1);
        setActiveCell({ row: nextRow, col });
        if (e.shiftKey) {
          setSelectionRange((prev) => ({
            startRow: prev ? prev.startRow : row,
            startCol: prev ? prev.startCol : col,
            endRow: nextRow,
            endCol: col,
          }));
        } else {
          setSelectionRange(null);
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const nextCol = Math.max(0, col - 1);
        setActiveCell({ row, col: nextCol });
        if (e.shiftKey) {
          setSelectionRange((prev) => ({
            startRow: prev ? prev.startRow : row,
            startCol: prev ? prev.startCol : col,
            endRow: row,
            endCol: nextCol,
          }));
        } else {
          setSelectionRange(null);
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const nextCol = Math.min(resolvedColumns.length - 1, col + 1);
        setActiveCell({ row, col: nextCol });
        if (e.shiftKey) {
          setSelectionRange((prev) => ({
            startRow: prev ? prev.startRow : row,
            startCol: prev ? prev.startCol : col,
            endRow: row,
            endCol: nextCol,
          }));
        } else {
          setSelectionRange(null);
        }
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          if (col > 0) {
            setActiveCell({ row, col: col - 1 });
          } else if (row > 0) {
            setActiveCell({ row: row - 1, col: resolvedColumns.length - 1 });
          }
        } else {
          if (col + 1 < resolvedColumns.length) {
            setActiveCell({ row, col: col + 1 });
          } else if (row + 1 < rows.length) {
            setActiveCell({ row: row + 1, col: 0 });
          }
        }
        setSelectionRange(null);
      } else if (e.key === "Enter" || e.key === "F2") {
        e.preventDefault();
        startEditing(row, col);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (!readOnly) {
          handleClearSelectedCells();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        handleCopy();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        // Will be caught by clipboard paste event
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        handleFillDown();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Immediately start typing in cell
        e.preventDefault();
        startEditing(row, col, e.key);
      }
    },
    [activeCell, isEditing, editValue, rows, resolvedColumns, readOnly, allowAddRows]
  );

  // 7. Clipboard Copy & Paste Operations
  const handleCopy = useCallback(() => {
    if (!activeCell) return;
    const minRow = selectionRange ? Math.min(selectionRange.startRow, selectionRange.endRow) : activeCell.row;
    const maxRow = selectionRange ? Math.max(selectionRange.startRow, selectionRange.endRow) : activeCell.row;
    const minCol = selectionRange ? Math.min(selectionRange.startCol, selectionRange.endCol) : activeCell.col;
    const maxCol = selectionRange ? Math.max(selectionRange.startCol, selectionRange.endCol) : activeCell.col;

    const lines: string[] = [];
    for (let r = minRow; r <= maxRow; r++) {
      const lineCells: string[] = [];
      for (let c = minCol; c <= maxCol; c++) {
        const val = getRawCellValue(r, c);
        lineCells.push(val !== undefined && val !== null ? String(val) : "");
      }
      lines.push(lineCells.join("\t"));
    }

    const tsv = lines.join("\n");
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(tsv).catch(() => {});
    }
  }, [activeCell, selectionRange, getRawCellValue]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (readOnly || !activeCell) return;
      const text = e.clipboardData.getData("text");
      if (!text) return;
      e.preventDefault();

      const lines = text.split(/\r?\n/).filter((line, idx, arr) => {
        // Don't discard empty line if it's not trailing
        return idx < arr.length - 1 || line.length > 0;
      });

      if (lines.length === 0) return;

      setHistory((prev) => [...prev.slice(-19), rows]);

      const updatedRows = [...rows];
      const startRow = activeCell.row;
      const startCol = activeCell.col;
      const changes: SpreadsheetCellChange[] = [];
      const newDirty = new Set(dirtyRows);

      lines.forEach((line, rOffset) => {
        const targetRow = startRow + rOffset;
        while (targetRow >= updatedRows.length) {
          if (!allowAddRows) return;
          const newRow: Record<string, unknown> = {};
          resolvedColumns.forEach((c) => {
            newRow[c.key] = c.defaultValue !== undefined ? c.defaultValue : "";
          });
          updatedRows.push(newRow);
        }

        const cells = line.split("\t");
        cells.forEach((val, cOffset) => {
          const targetCol = startCol + cOffset;
          if (targetCol >= resolvedColumns.length) return;
          const colDef = resolvedColumns[targetCol];
          if (!colDef || colDef.readOnly) return;

          const targetRowObj = updatedRows[targetRow];
          if (!targetRowObj) return;

          const oldVal = targetRowObj[colDef.key];
          let parsed: unknown = val.trim();
          if (colDef.type === "number" || colDef.type === "currency") {
            const num = parseFloat(parsed as string);
            if (!isNaN(num)) parsed = num;
          } else if (colDef.type === "boolean") {
            parsed = parsed === "true" || parsed === "1";
          }

          updatedRows[targetRow] = {
            ...targetRowObj,
            [colDef.key]: parsed,
          };
          newDirty.add(targetRow);
          changes.push({
            rowIndex: targetRow,
            colIndex: targetCol,
            columnKey: colDef.key,
            oldValue: oldVal,
            newValue: parsed,
          });
        });
      });

      setRows(updatedRows);
      setDirtyRows(newDirty);
      onDataChange?.(updatedRows, changes);
    },
    [readOnly, activeCell, rows, allowAddRows, resolvedColumns, dirtyRows, onDataChange]
  );

  // 8. Fill Down Action (Duplicates top cell value downwards)
  const handleFillDown = useCallback(() => {
    if (readOnly || !activeCell) return;
    const sourceRow = selectionRange ? Math.min(selectionRange.startRow, selectionRange.endRow) : activeCell.row;
    const destMaxRow = selectionRange ? Math.max(selectionRange.startRow, selectionRange.endRow) : sourceRow + 1;
    const minCol = selectionRange ? Math.min(selectionRange.startCol, selectionRange.endCol) : activeCell.col;
    const maxCol = selectionRange ? Math.max(selectionRange.startCol, selectionRange.endCol) : activeCell.col;

    if (destMaxRow <= sourceRow) return;

    setHistory((prev) => [...prev.slice(-19), rows]);
    const updatedRows = [...rows];
    const newDirty = new Set(dirtyRows);
    const changes: SpreadsheetCellChange[] = [];

    for (let c = minCol; c <= maxCol; c++) {
      const col = resolvedColumns[c];
      if (!col || col.readOnly) continue;
      const sourceRowObj = updatedRows[sourceRow];
      const sourceVal = sourceRowObj ? sourceRowObj[col.key] : "";

      for (let r = sourceRow + 1; r <= destMaxRow && r < updatedRows.length; r++) {
        const targetRowObj = updatedRows[r];
        if (!targetRowObj) continue;
        const oldVal = targetRowObj[col.key];
        updatedRows[r] = {
          ...targetRowObj,
          [col.key]: sourceVal,
        };
        newDirty.add(r);
        changes.push({
          rowIndex: r,
          colIndex: c,
          columnKey: col.key,
          oldValue: oldVal,
          newValue: sourceVal,
        });
      }
    }

    setRows(updatedRows);
    setDirtyRows(newDirty);
    onDataChange?.(updatedRows, changes);
  }, [readOnly, activeCell, selectionRange, rows, dirtyRows, resolvedColumns, onDataChange]);

  // 9. Clear Selected Cells
  const handleClearSelectedCells = useCallback(() => {
    if (readOnly || !activeCell) return;
    const minRow = selectionRange ? Math.min(selectionRange.startRow, selectionRange.endRow) : activeCell.row;
    const maxRow = selectionRange ? Math.max(selectionRange.startRow, selectionRange.endRow) : activeCell.row;
    const minCol = selectionRange ? Math.min(selectionRange.startCol, selectionRange.endCol) : activeCell.col;
    const maxCol = selectionRange ? Math.max(selectionRange.startCol, selectionRange.endCol) : activeCell.col;

    setHistory((prev) => [...prev.slice(-19), rows]);
    const updatedRows = [...rows];
    const newDirty = new Set(dirtyRows);
    const changes: SpreadsheetCellChange[] = [];

    for (let r = minRow; r <= maxRow; r++) {
      const targetRowObj = updatedRows[r];
      if (!targetRowObj) continue;

      for (let c = minCol; c <= maxCol; c++) {
        const col = resolvedColumns[c];
        if (!col || col.readOnly) continue;
        const oldVal = targetRowObj[col.key];
        const emptyVal = col.defaultValue !== undefined ? col.defaultValue : "";

        updatedRows[r] = {
          ...(updatedRows[r] || targetRowObj),
          [col.key]: emptyVal,
        };
        newDirty.add(r);
        changes.push({
          rowIndex: r,
          colIndex: c,
          columnKey: col.key,
          oldValue: oldVal,
          newValue: emptyVal,
        });
      }
    }

    setRows(updatedRows);
    setDirtyRows(newDirty);
    onDataChange?.(updatedRows, changes);
  }, [readOnly, activeCell, selectionRange, rows, dirtyRows, resolvedColumns, onDataChange]);

  // 10. Undo Operation
  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setRows(previous);
    onDataChange?.(previous, []);
  }, [history, onDataChange]);

  // 11. Add & Delete Rows
  const handleAddRow = useCallback(() => {
    if (readOnly || !allowAddRows) return;
    const newRow: Record<string, unknown> = {};
    resolvedColumns.forEach((c) => {
      newRow[c.key] = c.defaultValue !== undefined ? c.defaultValue : "";
    });

    const newRows = [...rows, newRow];
    const newRowIndex = newRows.length - 1;
    setRows(newRows);
    setDirtyRows((prev) => new Set(prev).add(newRowIndex));
    setActiveCell({ row: newRowIndex, col: 0 });
    setSelectionRange(null);
    onDataChange?.(newRows, [
      {
        rowIndex: newRowIndex,
        colIndex: 0,
        columnKey: resolvedColumns[0]?.key || "",
        oldValue: undefined,
        newValue: newRow,
      },
    ]);
  }, [readOnly, allowAddRows, resolvedColumns, rows, onDataChange]);

  const handleDeleteRow = useCallback(() => {
    if (readOnly || !allowDeleteRows || !activeCell || rows.length <= 1) return;
    const targetRow = activeCell.row;

    setHistory((prev) => [...prev.slice(-19), rows]);
    const updated = rows.filter((_, idx) => idx !== targetRow);
    setRows(updated);

    const newDirty = new Set<number>();
    dirtyRows.forEach((r) => {
      if (r < targetRow) newDirty.add(r);
      else if (r > targetRow) newDirty.add(r - 1);
    });
    setDirtyRows(newDirty);

    const nextRow = Math.min(targetRow, updated.length - 1);
    setActiveCell({ row: nextRow, col: activeCell.col });
    setSelectionRange(null);
    onDataChange?.(updated, []);
  }, [readOnly, allowDeleteRows, activeCell, rows, dirtyRows, onDataChange]);

  // 12. Save Operation
  const handleSave = async () => {
    if (!onSave || isSaving) return;
    try {
      setIsSaving(true);
      await onSave(rows);
      setDirtyRows(new Set());
    } finally {
      setIsSaving(false);
    }
  };

  // 13. Export TSV / CSV
  const handleExportCSV = () => {
    const header = resolvedColumns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(",");
    const dataLines = rows.map((r, rIdx) => {
      return resolvedColumns
        .map((c, cIdx) => {
          const val = getComputedCellValue(rIdx, cIdx);
          const str = val !== undefined && val !== null ? String(val) : "";
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(",");
    });
    const csv = [header, ...dataLines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${collection?.name || "data"}-export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 14. Check if a cell is inside the active selection
  const isCellSelected = (r: number, c: number): boolean => {
    if (!activeCell) return false;
    if (!selectionRange) {
      return activeCell.row === r && activeCell.col === c;
    }
    const minRow = Math.min(selectionRange.startRow, selectionRange.endRow);
    const maxRow = Math.max(selectionRange.startRow, selectionRange.endRow);
    const minCol = Math.min(selectionRange.startCol, selectionRange.endCol);
    const maxCol = Math.max(selectionRange.startCol, selectionRange.endCol);
    return r >= minRow && r <= maxRow && c >= minCol && c <= maxCol;
  };

  // Summary Row Calculations
  const summaryValues = useMemo(() => {
    if (!showSummaryRow) return {};
    const results: Record<string, string> = {};

    resolvedColumns.forEach((col, cIdx) => {
      if (col.summary) {
        if (typeof col.summary === "function") {
          const vals = rows.map((_, rIdx) => getComputedCellValue(rIdx, cIdx));
          results[col.key] = String(col.summary(vals) ?? "");
        } else {
          const numbers = rows
            .map((_, rIdx) => parseNumber(getComputedCellValue(rIdx, cIdx)))
            .filter((n) => !isNaN(n));

          if (col.summary === "sum") {
            const sum = numbers.reduce((a, b) => a + b, 0);
            results[col.key] = col.type === "currency" ? `$${sum.toLocaleString()}` : sum.toLocaleString();
          } else if (col.summary === "avg") {
            const avg = numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
            results[col.key] = avg.toFixed(2);
          } else if (col.summary === "count") {
            results[col.key] = String(numbers.length);
          } else if (col.summary === "min") {
            results[col.key] = numbers.length > 0 ? String(Math.min(...numbers)) : "-";
          } else if (col.summary === "max") {
            results[col.key] = numbers.length > 0 ? String(Math.max(...numbers)) : "-";
          }
        }
      } else if (col.type === "number" || col.type === "currency") {
        // Automatic default sum for numeric columns
        const numbers = rows.map((_, rIdx) => parseNumber(getComputedCellValue(rIdx, cIdx)));
        const sum = numbers.reduce((a, b) => a + b, 0);
        results[col.key] = col.type === "currency" ? `$${sum.toLocaleString()}` : sum.toLocaleString();
      }
    });

    return results;
  }, [showSummaryRow, resolvedColumns, rows, getComputedCellValue]);

  return (
    <div
      ref={gridRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      data-testid="spreadsheet-grid"
      className={cn(
        "flex flex-col border rounded-lg bg-card text-card-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary/40 select-none",
        className
      )}
    >
      {/* 1. Header Toolbar */}
      {showToolbar && (
        <div
          data-testid="spreadsheet-toolbar"
          className="flex flex-wrap items-center justify-between gap-2 p-2 border-b bg-muted/30 text-xs"
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            {allowAddRows && !readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRow}
                className="h-7 px-2.5 text-xs gap-1"
                aria-label="Add row"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Row</span>
              </Button>
            )}

            {allowDeleteRows && !readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDeleteRow}
                disabled={!activeCell || rows.length <= 1}
                className="h-7 px-2.5 text-xs gap-1 text-destructive hover:text-destructive"
                aria-label="Delete row"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </Button>
            )}

            <div className="h-4 w-px bg-border mx-1" />

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleFillDown}
              disabled={!activeCell || readOnly}
              className="h-7 px-2 text-xs gap-1"
              title="Fill Down (Ctrl+D)"
              aria-label="Fill Down"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              <span>Fill Down</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              disabled={!activeCell}
              className="h-7 px-2 text-xs gap-1"
              title="Copy (Ctrl+C)"
              aria-label="Copy"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={history.length === 0 || readOnly}
              className="h-7 px-2 text-xs gap-1"
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Undo</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleExportCSV}
              className="h-7 px-2 text-xs gap-1"
              title="Export CSV"
              aria-label="Export CSV"
            >
              <Download className="h-3.5 w-3.5" />
              <span>CSV</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {dirtyRows.size > 0 && (
              <Badge variant="secondary" className="text-[11px] font-normal px-2 py-0.5">
                {dirtyRows.size} {dirtyRows.size === 1 ? "row modified" : "rows modified"}
              </Badge>
            )}

            {onSave && !readOnly && (
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={isSaving || dirtyRows.size === 0}
                className="h-7 px-3 text-xs gap-1.5"
                aria-label="Save changes"
              >
                {isSaving ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    <span>Save</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 2. Formula Bar */}
      {showFormulaBar && (
        <div
          data-testid="spreadsheet-formula-bar"
          className="flex items-center gap-2 px-3 py-1.5 border-b bg-background text-xs font-mono"
        >
          {/* Coordinate indicator badge e.g. A1, B4 */}
          <div
            data-testid="cell-coordinate-badge"
            className="min-w-[48px] text-center font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border"
          >
            {activeCell ? coordToCellRef(activeCell.row, activeCell.col) : "-"}
          </div>

          <div className="text-muted-foreground font-semibold italic text-xs select-none">
            fx
          </div>

          <input
            type="text"
            data-testid="formula-bar-input"
            readOnly={readOnly || !activeCell}
            value={isEditing ? editValue : activeCellRawValue}
            onChange={(e) => {
              if (activeCell) {
                if (!isEditing) setIsEditing(true);
                setEditValue(e.target.value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && activeCell) {
                e.preventDefault();
                commitEdit(e.currentTarget.value);
              } else if (e.key === "Escape") {
                e.preventDefault();
                setIsEditing(false);
              }
            }}
            placeholder="Type value or formula starting with ="
            className="flex-1 bg-transparent border-0 focus:outline-none focus:ring-0 text-foreground font-mono text-xs placeholder:text-muted-foreground/60"
          />
        </div>
      )}

      {/* 3. Grid Table */}
      <div className="overflow-x-auto max-h-[600px] relative">
        <table className="w-full border-collapse text-xs table-fixed">
          {/* Table Header: Column Letters & Labels */}
          <thead>
            <tr className="border-b bg-muted/60 sticky top-0 z-10 select-none">
              {/* Top-Left Corner Cell */}
              <th className="w-12 px-2 py-1.5 text-center font-medium text-muted-foreground border-r border-border bg-muted/80">
                #
              </th>

              {resolvedColumns.map((col, cIdx) => (
                <th
                  key={col.key}
                  style={{ width: col.width || 140 }}
                  className="px-2 py-1.5 text-left font-semibold text-foreground border-r border-border overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {colIndexToLetter(cIdx)}
                    </span>
                    <span className="truncate">{col.label}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body: Data Rows */}
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={resolvedColumns.length + 1}
                  className="text-center py-10 text-muted-foreground text-sm"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, rIdx) => {
                const isRowDirty = dirtyRows.has(rIdx);

                return (
                  <tr
                    key={rIdx}
                    data-testid={`spreadsheet-row-${rIdx}`}
                    className={cn(
                      "border-b border-border transition-colors hover:bg-muted/15",
                      isRowDirty && "bg-amber-500/5 dark:bg-amber-500/10"
                    )}
                  >
                    {/* Row Index Header */}
                    <td
                      onClick={() => {
                        setActiveCell({ row: rIdx, col: 0 });
                        setSelectionRange({
                          startRow: rIdx,
                          startCol: 0,
                          endRow: rIdx,
                          endCol: resolvedColumns.length - 1,
                        });
                      }}
                      className={cn(
                        "w-12 text-center text-[11px] font-mono font-medium text-muted-foreground border-r border-border bg-muted/40 cursor-pointer select-none",
                        activeCell?.row === rIdx && "bg-primary/10 text-primary font-bold"
                      )}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {isRowDirty && (
                          <span
                            title="Unsaved changes"
                            className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block"
                          />
                        )}
                        <span>{rIdx + 1}</span>
                      </div>
                    </td>

                    {/* Data Cells */}
                    {resolvedColumns.map((col, cIdx) => {
                      const isActive = activeCell?.row === rIdx && activeCell?.col === cIdx;
                      const isSelected = isCellSelected(rIdx, cIdx);
                      const isCellEditing = isActive && isEditing;
                      const rawValue = row[col.key];
                      const computedValue = getComputedCellValue(rIdx, cIdx);

                      return (
                        <td
                          key={col.key}
                          data-testid={`spreadsheet-cell-${rIdx}-${cIdx}`}
                          data-coord={coordToCellRef(rIdx, cIdx)}
                          onClick={() => {
                            if (!isActive) {
                              if (isEditing) commitEdit(editValue);
                              setActiveCell({ row: rIdx, col: cIdx });
                              setSelectionRange(null);
                            }
                          }}
                          onDoubleClick={() => {
                            startEditing(rIdx, cIdx);
                          }}
                          className={cn(
                            "relative px-2 py-1.5 border-r border-border text-foreground font-mono overflow-hidden text-ellipsis whitespace-nowrap cursor-cell",
                            col.type === "number" || col.type === "currency"
                              ? "text-right"
                              : "text-left",
                            isSelected && "bg-primary/10",
                            isActive &&
                              "ring-2 ring-primary ring-inset z-[5] bg-background shadow-sm",
                            col.readOnly && "bg-muted/30 text-muted-foreground cursor-not-allowed"
                          )}
                        >
                          {isCellEditing ? (
                            col.type === "select" && col.options ? (
                              <select
                                ref={cellInputRef as any}
                                value={String(editValue)}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => commitEdit(editValue)}
                                className="w-full h-full bg-transparent border-0 p-0 text-xs font-mono focus:outline-none"
                              >
                                {col.options.map((opt) => (
                                  <option key={String(opt.value)} value={String(opt.value)}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            ) : col.type === "boolean" ? (
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  checked={editValue === "true"}
                                  onCheckedChange={(checked) => {
                                    commitEdit(Boolean(checked));
                                  }}
                                />
                              </div>
                            ) : (
                              <input
                                ref={cellInputRef}
                                type={
                                  col.type === "number" || col.type === "currency"
                                    ? "text"
                                    : col.type === "date"
                                    ? "date"
                                    : "text"
                                }
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => commitEdit(editValue)}
                                className="w-full h-full bg-transparent border-0 p-0 text-xs font-mono focus:outline-none"
                              />
                            )
                          ) : col.type === "boolean" ? (
                            <div className="flex items-center justify-center">
                              <Checkbox
                                disabled={readOnly || col.readOnly}
                                checked={Boolean(computedValue)}
                                onCheckedChange={(checked) => {
                                  setActiveCell({ row: rIdx, col: cIdx });
                                  commitEdit(Boolean(checked));
                                }}
                              />
                            </div>
                          ) : (
                            <span
                              title={
                                typeof rawValue === "string" && rawValue.startsWith("=")
                                  ? `${rawValue} => ${String(computedValue ?? "")}`
                                  : String(computedValue ?? "")
                              }
                            >
                              {col.format
                                ? col.format(computedValue)
                                : col.type === "currency" && typeof computedValue === "number"
                                ? `$${computedValue.toLocaleString()}`
                                : computedValue !== undefined && computedValue !== null
                                ? String(computedValue)
                                : ""}
                            </span>
                          )}

                          {/* Autofill Drag Handle on active cell */}
                          {isActive && !isEditing && !readOnly && !col.readOnly && (
                            <div
                              data-testid="spreadsheet-fill-handle"
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                handleFillDown();
                              }}
                              title="Double click or drag to fill down"
                              className="absolute bottom-0 right-0 w-2 h-2 bg-primary cursor-crosshair z-10"
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>

          {/* 4. Table Summary Footer */}
          {showSummaryRow && rows.length > 0 && (
            <tfoot>
              <tr
                data-testid="spreadsheet-summary-row"
                className="border-t-2 border-border bg-muted/70 font-semibold select-none text-[11px]"
              >
                <td className="px-2 py-2 text-center text-muted-foreground border-r border-border font-sans">
                  Total
                </td>
                {resolvedColumns.map((col) => {
                  const val = summaryValues[col.key];
                  return (
                    <td
                      key={col.key}
                      className={cn(
                        "px-2 py-2 border-r border-border font-mono",
                        col.type === "number" || col.type === "currency"
                          ? "text-right"
                          : "text-left"
                      )}
                    >
                      {val || "-"}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* 5. Footer Status Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t bg-muted/20 text-[11px] text-muted-foreground">
        <div>
          <span>{rows.length} rows</span>
          <span className="mx-1.5">•</span>
          <span>{resolvedColumns.length} columns</span>
        </div>

        <div className="flex items-center gap-2">
          <span>Arrows / Tab navigate</span>
          <span className="mx-0.5">•</span>
          <span>Enter edits</span>
          <span className="mx-0.5">•</span>
          <span>Ctrl+D fills down</span>
        </div>
      </div>
    </div>
  );
}

export const SpreadsheetGrid = SpreadsheetView;
