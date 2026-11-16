import React from "react";
import { Check, Loader2, Undo2, AlertCircle } from "lucide-react";
import { Button } from "@honocube/ui";
import { type FloatingSaveBarProps } from "@honocube/core";

export function FloatingSaveBar({
  isDirty = false,
  isSubmitting = false,
  onSave,
  onDiscard,
  saveLabel = "Save changes",
  discardLabel = "Discard",
  showDiscard = true,
  message = "You have unsaved changes",
  visible,
  actions,
  className = "",
}: FloatingSaveBarProps): React.JSX.Element | null {
  const isVisible = visible !== undefined ? visible : isDirty;

  if (!isVisible) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="floating-save-bar"
      className={`fixed bottom-6 inset-x-0 mx-auto w-fit max-w-[92vw] z-50 flex items-center justify-between gap-3 sm:gap-6 px-4 py-2.5 rounded-full border border-border/80 bg-background/95 backdrop-blur-md shadow-2xl text-foreground text-sm transition-all duration-200 animate-in fade-in slide-in-from-bottom-3 ${className}`}
    >
      {/* Message & Status Indicator */}
      <div className="flex items-center gap-2 select-none">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        </span>
        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 hidden sm:inline" />
        <span className="font-medium text-xs sm:text-sm text-foreground truncate max-w-[200px] sm:max-w-none">
          {message}
        </span>
        <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted/80 rounded border border-border">
          Ctrl+S
        </kbd>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-1.5 shrink-0">
        {actions}

        {showDiscard && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDiscard}
            disabled={isSubmitting}
            className="h-8 px-3 rounded-full text-xs text-muted-foreground hover:text-foreground gap-1.5"
            aria-label={discardLabel}
          >
            <Undo2 className="h-3.5 w-3.5" />
            <span>{discardLabel}</span>
          </Button>
        )}

        <Button
          type={onSave ? "button" : "submit"}
          size="sm"
          onClick={onSave}
          disabled={isSubmitting}
          className="h-8 px-4 rounded-full text-xs font-medium gap-1.5 shadow-xs"
          aria-label={saveLabel}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>{saveLabel}</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
