import type { ColumnDef } from "@tanstack/react-table";
import type { Collection, InferRecord } from "../types/collection.js";
import type { FieldConfig } from "../types/fields.js";

function toHumanLabel(str: string): string {
  return str
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function formatCellValue(value: unknown, field?: FieldConfig<any>): string {
  if (value === null || value === undefined) return "—";

  if (!field) {
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  switch (field.type) {
    case "currency": {
      const num = typeof value === "number" ? value : parseFloat(String(value));
      if (Number.isNaN(num)) return String(value);
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: field.currencyCode || "USD",
      }).format(num);
    }
    case "number": {
      const num = typeof value === "number" ? value : parseFloat(String(value));
      if (Number.isNaN(num)) return String(value);
      return new Intl.NumberFormat().format(num);
    }
    case "boolean":
      return value ? "Yes" : "No";
    case "date": {
      const d = value instanceof Date ? value : new Date(String(value));
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleDateString();
    }
    case "datetime": {
      const d = value instanceof Date ? value : new Date(String(value));
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleString();
    }
    case "select": {
      const option = field.options?.find((opt) =>
        typeof opt === "object" && opt !== null ? opt.value === value : opt === value
      );
      if (option && typeof option === "object") {
        return option.label;
      }
      return String(value);
    }
    default:
      if (typeof value === "object") {
        if (Array.isArray(value)) return `[${value.length} items]`;
        return JSON.stringify(value);
      }
      return String(value);
  }
}

export function generateColumnsFromCollection<TCollection extends Collection<any>>(
  collection: TCollection,
  customColumns?: ColumnDef<InferRecord<TCollection>, any>[]
): ColumnDef<InferRecord<TCollection>, any>[] {
  if (customColumns && customColumns.length > 0) {
    return customColumns;
  }

  const columnKeys: string[] =
    collection.table?.columns && collection.table.columns.length > 0
      ? collection.table.columns
      : collection.getFieldKeys() as string[];

  return columnKeys.map((key) => {
    const field = collection.getField(key);
    const label = field?.label || toHumanLabel(key);

    const colDef: ColumnDef<InferRecord<TCollection>, any> = {
      id: key,
      accessorKey: key,
      header: label,
      cell: ({ getValue }) => {
        const val = getValue();
        return formatCellValue(val, field);
      },
    };

    return colDef;
  });
}
