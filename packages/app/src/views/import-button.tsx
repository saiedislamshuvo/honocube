import React, { useState } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@honocube/ui";
import type { Collection } from "@honocube/core";
import { ImportDialog } from "./import-dialog.js";

export interface ImportButtonProps<TCollection extends Collection<any>> {
  collection: TCollection;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  label?: string;
  onSuccess?: (results: { totalCreated: number; totalUpdated: number }) => void;
  maxRowsPerRequest?: number;
}

export function ImportButton<TCollection extends Collection<any>>({
  collection,
  variant = "outline",
  size = "sm",
  className = "",
  label = "Import",
  onSuccess,
  maxRowsPerRequest,
}: ImportButtonProps<TCollection>): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={`gap-1.5 h-9 ${className}`}
        onClick={() => setOpen(true)}
      >
        <UploadCloud className="h-4 w-4" />
        <span>{label}</span>
      </Button>
      <ImportDialog
        open={open}
        onOpenChange={setOpen}
        collection={collection}
        onSuccess={onSuccess}
        maxRowsPerRequest={maxRowsPerRequest}
      />
    </>
  );
}
