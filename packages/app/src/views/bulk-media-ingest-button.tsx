import * as React from "react";
import { useState } from "react";
import { FolderArchive } from "lucide-react";
import { Button } from "@honocube/ui";
import type { BulkMediaIngestButtonProps } from "@honocube/core";
import { BulkMediaIngestDialog } from "./bulk-media-ingest-dialog.js";

export function BulkMediaIngestButton({
  records = [],
  collectionName = "Records",
  identifierFields,
  mediaFields,
  defaultIdentifierField,
  defaultMediaField,
  onIngest,
  label = "Ingest Media ZIP",
  className = "",
  variant = "outline",
  size = "sm",
}: BulkMediaIngestButtonProps): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={`gap-1.5 h-9 ${className}`}
        onClick={() => setOpen(true)}
        data-testid="bulk-media-ingest-button"
      >
        <FolderArchive className="h-4 w-4" />
        <span>{label}</span>
      </Button>
      <BulkMediaIngestDialog
        open={open}
        onOpenChange={setOpen}
        records={records}
        collectionName={collectionName}
        identifierFields={identifierFields}
        mediaFields={mediaFields}
        defaultIdentifierField={defaultIdentifierField}
        defaultMediaField={defaultMediaField}
        onIngest={onIngest}
      />
    </>
  );
}
