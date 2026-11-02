import React from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@honocube/ui";
import type { Collection } from "../types/collection.js";
import { FormView } from "./form-view.js";
import type { FormDialogProps } from "./types.js";

export function FormDialog<TCollection extends Collection<any>>({
  collection,
  open,
  onOpenChange,
  trigger,
  title,
  description,
  onSuccess,
  onCancel,
  dialogClassName = "",
  mode = "create",
  ...formProps
}: FormDialogProps<TCollection>): React.JSX.Element {
  const resolvedTitle =
    title ||
    (mode === "create"
      ? `New ${collection.singular || collection.label || "Record"}`
      : `Edit ${collection.singular || collection.label || "Record"}`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className={`max-w-2xl max-h-[90vh] overflow-y-auto ${dialogClassName}`}
      >
        <DialogHeader>
          <DialogTitle>{resolvedTitle}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
}
