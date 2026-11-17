import * as React from "react";
import { useState } from "react";
import {
  Database,
  HardDrive,
  FolderArchive,
  Layers,
  Loader2,
} from "lucide-react";
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
import type { BackupType, CreateBackupDialogProps } from "@honocube/core";

export function CreateBackupDialog({
  open,
  onOpenChange,
  onCreate,
  isCreating = false,
  className = "",
}: CreateBackupDialogProps): React.JSX.Element | null {
  const [name, setName] = useState<string>("");
  const [type, setType] = useState<BackupType>("full");
  const [description, setDescription] = useState<string>("");

  React.useEffect(() => {
    if (open) {
      const dateStr = new Date().toISOString().split("T")[0];
      setName(`snapshot-${dateStr}-${type}`);
      setDescription("");
    }
  }, [open, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;

    if (onCreate) {
      await onCreate({
        name: name.trim() || `snapshot-${new Date().toISOString().split("T")[0]}-${type}`,
        type,
        description: description.trim() || undefined,
      });
    }
    onOpenChange(false);
  };

  if (!open) return null;

  // SSR Fallback for fast server-rendering & headless testing
  if (typeof document === "undefined") {
    return (
      <div data-testid="create-backup-dialog" className="hidden">
        <h2>Create Backup Snapshot</h2>
        <form onSubmit={handleSubmit}>
          <input
            data-testid="backup-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div data-testid="backup-type-selector">
            <button
              type="button"
              data-testid="backup-type-full"
              data-active={type === "full"}
              onClick={() => setType("full")}
            >
              Full Snapshot
            </button>
            <button
              type="button"
              data-testid="backup-type-database"
              data-active={type === "database"}
              onClick={() => setType("database")}
            >
              Database Only
            </button>
            <button
              type="button"
              data-testid="backup-type-assets"
              data-active={type === "assets"}
              onClick={() => setType("assets")}
            >
              Media Assets Only
            </button>
          </div>
          <input
            data-testid="backup-desc-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button type="submit" data-testid="submit-backup-btn" disabled={isCreating}>
            Create Snapshot
          </button>
        </form>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="create-backup-dialog"
        className={`sm:max-w-[540px] ${className}`}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Create Backup Snapshot
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                Generate an immediate point-in-time snapshot of your database and media files.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Backup Type Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Backup Scope
            </label>
            <div className="grid grid-cols-3 gap-2" data-testid="backup-type-selector">
              <button
                type="button"
                data-testid="backup-type-full"
                onClick={() => setType("full")}
                className={`flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-colors ${
                  type === "full"
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60"
                }`}
              >
                <Layers className="h-5 w-5 mb-1 text-current" />
                <span className="text-xs font-semibold">Full System</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  DB &amp; Assets
                </span>
              </button>

              <button
                type="button"
                data-testid="backup-type-database"
                onClick={() => setType("database")}
                className={`flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-colors ${
                  type === "database"
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60"
                }`}
              >
                <Database className="h-5 w-5 mb-1 text-current" />
                <span className="text-xs font-semibold">Database Only</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Tables &amp; Data
                </span>
              </button>

              <button
                type="button"
                data-testid="backup-type-assets"
                onClick={() => setType("assets")}
                className={`flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-colors ${
                  type === "assets"
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60"
                }`}
              >
                <FolderArchive className="h-5 w-5 mb-1 text-current" />
                <span className="text-xs font-semibold">Assets Only</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Uploaded Media
                </span>
              </button>
            </div>
          </div>

          {/* Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Snapshot Name
            </label>
            <Input
              data-testid="backup-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. pre-upgrade-snapshot"
              required
              className="text-xs"
            />
          </div>

          {/* Description Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Description / Notes (Optional)
            </label>
            <Input
              data-testid="backup-desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Routine backup before v2.1 database migration"
              className="text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              data-testid="submit-backup-btn"
              disabled={isCreating}
              className="text-xs flex items-center gap-1.5"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating Snapshot...
                </>
              ) : (
                <>
                  <HardDrive className="h-3.5 w-3.5" />
                  Create Snapshot
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
