import React from "react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@honocube/ui";
import type { Collection } from "../types/collection.js";
import { FormView } from "./form-view.js";
import type { FormSheetProps } from "./types.js";

export function FormSheet<TCollection extends Collection<any>>({
  collection,
  open,
  onOpenChange,
  trigger,
  side = "right",
  title,
  description,
  onSuccess,
  onCancel,
  sheetClassName = "",
  mode = "create",
  ...formProps
}: FormSheetProps<TCollection>): React.JSX.Element {
  const resolvedTitle =
    title ||
    (mode === "create"
      ? `New ${collection.singular || collection.label || "Record"}`
      : `Edit ${collection.singular || collection.label || "Record"}`);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent
        side={side}
        className={`w-full sm:max-w-xl overflow-y-auto ${sheetClassName}`}
      >
        <SheetHeader className="mb-4">
          <SheetTitle>{resolvedTitle}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        <FormView
          collection={collection}
          mode={mode}
          showHeader={false}
          onSuccess={(record) => {
            onSuccess?.(record);
            onOpenChange?.(false);
          }}
          onCancel={() => {
            onCancel?.();
            onOpenChange?.(false);
          }}
          {...formProps}
        />
      </SheetContent>
    </Sheet>
  );
}
