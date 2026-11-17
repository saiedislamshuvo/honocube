import * as React from "react";
import { useState } from "react";
import {
  Calendar,
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
  Switch,
} from "@honocube/ui";
import {
  DEFAULT_BACKUP_SCHEDULE,
  type BackupFrequency,
  type BackupType,
  type BackupScheduleDialogProps,
} from "@honocube/core";

export function BackupScheduleDialog({
  open,
  onOpenChange,
  schedule: initialSchedule,
  onSave,
  isSaving = false,
  className = "",
}: BackupScheduleDialogProps): React.JSX.Element | null {
  const current = initialSchedule || DEFAULT_BACKUP_SCHEDULE;

  const [enabled, setEnabled] = useState<boolean>(current.enabled);
  const [frequency, setFrequency] = useState<BackupFrequency>(current.frequency);
  const [time, setTime] = useState<string>(current.time || "02:00 UTC");
  const [backupType, setBackupType] = useState<BackupType>(current.backupType);
  const [retentionCount, setRetentionCount] = useState<number>(current.retentionCount);

  React.useEffect(() => {
    if (initialSchedule) {
      setEnabled(initialSchedule.enabled);
      setFrequency(initialSchedule.frequency);
      setTime(initialSchedule.time || "02:00 UTC");
      setBackupType(initialSchedule.backupType);
      setRetentionCount(initialSchedule.retentionCount);
    }
  }, [initialSchedule, open]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (onSave) {
      await onSave({
        enabled,
        frequency,
        time,
        backupType,
        retentionCount: Math.max(1, Number(retentionCount) || 7),
      });
    }
    onOpenChange(false);
  };

  if (!open) return null;

  // SSR Fallback for fast server-rendering & headless testing
  if (typeof document === "undefined") {
    return (
      <div data-testid="backup-schedule-dialog" className="hidden">
        <h2>Automated Backup Schedule &amp; Retention</h2>
        <form onSubmit={handleSave}>
          <input
            type="checkbox"
            data-testid="schedule-enabled-switch"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <select
            data-testid="schedule-frequency-select"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as BackupFrequency)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <input
            data-testid="schedule-time-input"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
          <select
            data-testid="schedule-type-select"
            value={backupType}
            onChange={(e) => setBackupType(e.target.value as BackupType)}
          >
            <option value="full">Full System</option>
            <option value="database">Database Only</option>
            <option value="assets">Assets Only</option>
          </select>
          <input
            type="number"
            data-testid="schedule-retention-input"
            value={retentionCount}
            onChange={(e) => setRetentionCount(parseInt(e.target.value, 10))}
          />
          <button type="submit" data-testid="save-schedule-btn" disabled={isSaving}>
            Save Policy
          </button>
        </form>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="backup-schedule-dialog"
        className={`sm:max-w-[480px] ${className}`}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Backup Schedule &amp; Retention
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                Configure automated snapshot cadence and storage pruning limits.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-2">
          {/* Enabled Switch */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Automated Backups
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Run background backups automatically on a recurring schedule
              </p>
            </div>
            <Switch
              data-testid="schedule-enabled-switch"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {/* Frequency & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Frequency
              </label>
              <select
                data-testid="schedule-frequency-select"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as BackupFrequency)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Execution Time
              </label>
              <Input
                data-testid="schedule-time-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="02:00 UTC"
                className="text-xs"
              />
            </div>
          </div>

          {/* Backup Scope */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Default Snapshot Scope
            </label>
            <select
              data-testid="schedule-type-select"
              value={backupType}
              onChange={(e) => setBackupType(e.target.value as BackupType)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="full">Full System (Database &amp; Assets)</option>
              <option value="database">Database Only (Tables &amp; Records)</option>
              <option value="assets">Media Assets Only (Uploaded Files)</option>
            </select>
          </div>

          {/* Retention Count */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Retention Count (Keep Last N Backups)
            </label>
            <Input
              type="number"
              min="1"
              max="365"
              data-testid="schedule-retention-input"
              value={retentionCount}
              onChange={(e) => setRetentionCount(parseInt(e.target.value, 10))}
              className="text-xs"
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Older snapshots beyond this limit will be automatically pruned.
            </p>
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
              data-testid="save-schedule-btn"
              disabled={isSaving}
              className="text-xs flex items-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Policy"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
