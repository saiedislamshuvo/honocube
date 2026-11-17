import * as React from "react";
import { useState } from "react";
import {
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
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
  Badge,
} from "@honocube/ui";
import {
  validateRestoreConfirmation,
  type RestoreBackupDialogProps,
} from "@honocube/core";

export function RestoreBackupDialog({
  open,
  onOpenChange,
  snapshot,
  onRestore,
  isRestoring = false,
  className = "",
}: RestoreBackupDialogProps): React.JSX.Element | null {
  const [confirmInput, setConfirmInput] = useState<string>("");
  const [createSafetySnapshot, setCreateSafetySnapshot] = useState<boolean>(true);

  React.useEffect(() => {
    if (open) {
      setConfirmInput("");
      setCreateSafetySnapshot(true);
    }
  }, [open, snapshot]);

  const isConfirmed = validateRestoreConfirmation(confirmInput);

  const handleRestoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshot || !isConfirmed || isRestoring) return;

    if (onRestore) {
      await onRestore({
        snapshotId: snapshot.id,
        confirmation: confirmInput.trim(),
        createPreRestoreSnapshot: createSafetySnapshot,
      });
    }
    onOpenChange(false);
  };

  if (!open) return null;

  // SSR Fallback for fast server-rendering & headless testing
  if (typeof document === "undefined") {
    return (
      <div data-testid="restore-backup-dialog" className="hidden">
        <h2>Restore Backup Snapshot: {snapshot?.name || ""}</h2>
        <div data-testid="restore-warning-banner">
          Warning: Restoring will overwrite existing data.
        </div>
        <div data-testid="snapshot-details-card">
          <span data-testid="restore-snapshot-name">{snapshot?.name}</span>
          <span data-testid="restore-snapshot-type">{snapshot?.type}</span>
          <span data-testid="restore-snapshot-size">{snapshot?.formattedSize}</span>
        </div>
        <input
          type="checkbox"
          data-testid="safety-snapshot-checkbox"
          defaultChecked={createSafetySnapshot}
          onChange={(e) => setCreateSafetySnapshot(e.target.checked)}
        />
        <input
          data-testid="restore-confirm-input"
          value={confirmInput}
          onChange={(e) => setConfirmInput(e.target.value)}
        />
        <button
          data-testid="confirm-restore-btn"
          disabled={!isConfirmed || isRestoring}
          onClick={handleRestoreSubmit}
        >
          {isRestoring ? "Restoring Snapshot..." : "Restore Snapshot"}
        </button>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="restore-backup-dialog"
        className={`sm:max-w-[500px] border-red-200 dark:border-red-900/50 ${className}`}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-red-900 dark:text-red-200">
                Confirm Database Restore
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                Disaster recovery action will overwrite current application data.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleRestoreSubmit} className="space-y-4 py-2">
          {/* Warning Banner */}
          <div
            data-testid="restore-warning-banner"
            className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold">Destructive Action Warning</p>
              <p className="text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-300/90">
                Restoring this snapshot will permanently replace your current database records
                and file assets with the state from this backup. All data created since this backup
                was generated will be lost.
              </p>
            </div>
          </div>

          {/* Snapshot Summary Card */}
          {snapshot && (
            <div
              data-testid="snapshot-details-card"
              className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900 dark:text-slate-100" data-testid="restore-snapshot-name">
                  {snapshot.name}
                </span>
                <Badge variant="outline" className="uppercase text-[10px]" data-testid="restore-snapshot-type">
                  {snapshot.type}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <div>
                  Size:{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-300" data-testid="restore-snapshot-size">
                    {snapshot.formattedSize}
                  </span>
                </div>
                <div>
                  Created:{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {new Date(snapshot.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              {snapshot.checksum && (
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  Checksum: {snapshot.checksum}
                </div>
              )}
            </div>
          )}

          {/* Safety Pre-Restore Snapshot Checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="safety-snapshot"
              data-testid="safety-snapshot-checkbox"
              checked={createSafetySnapshot}
              onChange={(e) => setCreateSafetySnapshot(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700"
            />
            <label
              htmlFor="safety-snapshot"
              className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none"
            >
              Create safety backup snapshot before restoring (Recommended)
            </label>
          </div>

          {/* Type-to-Confirm Safeguard */}
          <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
            <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Type <span className="font-mono text-red-600 dark:text-red-400">RESTORE</span> to confirm:
            </label>
            <Input
              data-testid="restore-confirm-input"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="RESTORE"
              required
              className="font-mono text-xs uppercase"
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
              variant="destructive"
              data-testid="confirm-restore-btn"
              disabled={!isConfirmed || isRestoring}
              className="text-xs flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white"
            >
              {isRestoring ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Restoring Snapshot...
                </>
              ) : (
                <>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore Snapshot
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
