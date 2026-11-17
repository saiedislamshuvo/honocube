import React, { useState } from "react";
import { Button } from "@honocube/ui";
import { FileDown, Loader2 } from "lucide-react";
import type { ExportPdfButtonProps } from "@honocube/core";

export function ExportPdfButton({
  onExport,
  filename: _filename,
  label = "Export PDF",
  variant = "outline",
  size = "sm",
  className,
  disabled = false,
  iconOnly = false,
}: ExportPdfButtonProps): React.JSX.Element {
  const [isExporting, setIsExporting] = useState(false);

  const handleClick = async (): Promise<void> => {
    if (!onExport || isExporting || disabled) return;
    try {
      setIsExporting(true);
      await Promise.resolve(onExport());
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled || isExporting}
      onClick={handleClick}
      data-testid="export-pdf-button"
      className={className}
      title={label}
    >
      {isExporting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <FileDown className="h-3.5 w-3.5" />
      )}
      {!iconOnly && <span className="ml-1.5">{label}</span>}
    </Button>
  );
}
