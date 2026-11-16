import React from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from "@honocube/ui";
import type { UnsavedChangesDialogProps } from "@honocube/core";

export function UnsavedChangesDialog({
  open,
  onConfirm,
  onCancel,
  title = "Unsaved Changes",
  description = "You have unsaved changes. Are you sure you want to leave this page? Your unsaved edits will be discarded.",
  confirmLabel = "Discard changes",
  cancelLabel = "Keep editing",
}: UnsavedChangesDialogProps): React.JSX.Element {
  if (!open) return <></>;

  // In SSR / headless test environments without DOM portal mounting, render alertdialog container
  if (typeof document === "undefined") {
    return (
      <div
        data-testid="unsaved-changes-dialog"
        role="alertdialog"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      >
        <div className="grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg sm:rounded-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              data-testid="unsaved-changes-cancel"
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              data-testid="unsaved-changes-confirm"
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onCancel();
        }
      }}
    >
      <DialogContent
        data-testid="unsaved-changes-dialog"
        className="sm:max-w-md"
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-sm text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            data-testid="unsaved-changes-cancel"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            data-testid="unsaved-changes-confirm"
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
