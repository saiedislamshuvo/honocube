import * as React from "react";
import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@honocube/ui";
import {
  AppContext,
  type InlineEntityCreationDialogProps,
} from "@honocube/core";
import { FormDialog } from "./form-dialog.js";

/**
 * Reusable modal dialog for creating relational foreign key entities inline
 * without forcing the user to abandon their current form draft.
 */
export function InlineEntityCreationDialog({
  open,
  onOpenChange,
  target,
  collection: explicitCollection,
  title,
  description,
  initialName = "",
  onSuccess,
  onCancel,
  className = "",
}: InlineEntityCreationDialogProps): React.JSX.Element | null {
  const appContext = React.useContext(AppContext);
  const [quickName, setQuickName] = useState(initialName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync initialName when dialog opens
  React.useEffect(() => {
    if (open) {
      setQuickName(initialName);
      setError(null);
    }
  }, [open, initialName]);

  // Resolve target collection if registered in app or passed explicitly
  const resolvedCollection = React.useMemo(() => {
    if (explicitCollection) return explicitCollection;
    if (target && appContext?.app?.getCollection) {
      return appContext.app.getCollection(target);
    }
    if (target && appContext?.app?.collections) {
      return appContext.app.collections.find((c) => c.name === target);
    }
    return undefined;
  }, [explicitCollection, target, appContext?.app]);

  if (!open) return null;

  // SSR Fallback
  if (typeof document === "undefined") {
    return (
      <div data-testid="inline-entity-creation-dialog" className="hidden">
        <h2>{title || `Create ${target || "Record"}`}</h2>
        <button data-testid="inline-create-submit-btn">Create & Select</button>
      </div>
    );
  }

  // 1. Full schema FormDialog when collection definition is available
  if (resolvedCollection) {
    return (
      <FormDialog
        collection={resolvedCollection}
        open={open}
        onOpenChange={onOpenChange}
        title={
          title ||
          `New ${
            resolvedCollection.singular ||
            resolvedCollection.label ||
            target ||
            "Record"
          }`
        }
        description={description}
        initialValues={{
          name: quickName,
          title: quickName,
        }}
        onSuccess={(record) => {
          onSuccess(record);
          onOpenChange(false);
        }}
        onCancel={() => {
          onCancel?.();
          onOpenChange(false);
        }}
        dialogClassName={className}
      />
    );
  }

  // 2. Lightweight Quick-Create modal when no full collection schema is available
  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickName.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      if (target) {
        const basePath = `/api/${target}`;
        let newRecord: any;

        if (appContext?.client) {
          const res = await appContext.client.post<any>(basePath, { name: trimmed });
          newRecord = res?.data ?? res;
        } else if (typeof fetch !== "undefined") {
          const res = await fetch(basePath, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: trimmed }),
          });
          if (res.ok) {
            const json = await res.json();
            newRecord = json?.data ?? json;
          }
        }

        if (newRecord) {
          onSuccess(newRecord);
          onOpenChange(false);
          return;
        }
      }

      // Synthetic fallback record
      const synthetic = {
        id: trimmed.toLowerCase().replace(/\s+/g, "_"),
        name: trimmed,
      };
      onSuccess(synthetic);
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message || "Failed to create entity. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="inline-entity-creation-dialog"
        className={`sm:max-w-md ${className}`}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Plus className="size-4" />
            </div>
            <DialogTitle>{title || `New ${target || "Record"}`}</DialogTitle>
          </div>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={handleQuickSubmit} className="space-y-4 py-1">
          <div className="space-y-1.5">
            <label
              htmlFor="inline-create-name-input"
              className="text-xs font-medium text-foreground"
            >
              Name / Title
            </label>
            <Input
              id="inline-create-name-input"
              data-testid="inline-create-name-input"
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              placeholder={`Enter ${target || "record"} name...`}
              autoFocus
              required
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onCancel?.();
                onOpenChange(false);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              data-testid="inline-create-submit-btn"
              disabled={!quickName.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create & Select"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
