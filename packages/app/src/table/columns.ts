import type { ColumnDef } from "@tanstack/react-table";
import type { Collection, InferRecord } from "../types/collection.js";
import { toHumanLabel, formatCellValue } from "../utils/format.js";

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
      : (collection.getFieldKeys() as string[]);

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
