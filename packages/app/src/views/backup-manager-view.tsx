import * as React from "react";
import { useState, useMemo } from "react";
import {
  Database,
  RotateCcw,
  Download,
  Trash2,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Settings,
  Archive,
} from "lucide-react";
import {
  Button,
  Input,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@honocube/ui";
import {
  formatBytes,
  DEFAULT_BACKUP_SCHEDULE,
  type BackupSnapshot,
  type BackupType,
  type BackupManagerViewProps,
} from "@honocube/core";
import { CreateBackupDialog } from "./create-backup-dialog.js";
import { RestoreBackupDialog } from "./restore-backup-dialog.js";
import { BackupScheduleDialog } from "./backup-schedule-dialog.js";

export function BackupManagerView({
  snapshots = [],
  schedule = DEFAULT_BACKUP_SCHEDULE,
  onCreateBackup,
  onRestoreBackup,
  onDeleteBackup,
  onDownloadBackup,
  onSaveSchedule,
  isLoading = false,
  className = "",
}: BackupManagerViewProps): React.JSX.Element {
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState<boolean>(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupSnapshot | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | BackupType>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Filtered snapshots
  const filteredSnapshots = useMemo(() => {
    let result = [...snapshots];
    if (typeFilter !== "all") {
      result = result.filter((s) => s.type === typeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q)) ||
          s.id.toLowerCase().includes(q)
      );
    }
    return result;
  }, [snapshots, typeFilter, searchQuery]);

  // Aggregate stats
  const totalStorageBytes = useMemo(() => {
    return snapshots.reduce((acc, s) => acc + (s.sizeBytes || 0), 0);
  }, [snapshots]);

  const lastSnapshot = useMemo(() => {
    if (snapshots.length === 0) return null;
    return [...snapshots].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
  }, [snapshots]);

  const handleDownload = (snap: BackupSnapshot) => {
    if (onDownloadBackup) {
      onDownloadBackup(snap);
    } else if (snap.downloadUrl && typeof window !== "undefined") {
      window.open(snap.downloadUrl, "_blank");
    }
  };

  return (
    <div
      data-testid="backup-manager-view"
      className={`space-y-6 p-6 max-w-7xl mx-auto ${className}`}
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Database className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            Backup &amp; Disaster Recovery
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage point-in-time database snapshots, file asset archives, and one-click disaster recovery restores.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            data-testid="open-schedule-settings-btn"
            onClick={() => setIsScheduleOpen(true)}
            className="text-xs flex items-center gap-1.5"
          >
            <Settings className="h-3.5 w-3.5" />
            Schedule Settings
          </Button>

          <Button
            size="sm"
            data-testid="open-create-backup-btn"
            onClick={() => setIsCreateOpen(true)}
            className="text-xs flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Backup
          </Button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Backups */}
        <Card data-testid="metric-total-backups">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Backups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {snapshots.length}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Active recovery points
            </p>
          </CardContent>
        </Card>

        {/* Metric 2: Last Backup */}
        <Card data-testid="metric-last-backup">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Last Backup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {lastSnapshot ? lastSnapshot.name : "None taken yet"}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              {lastSnapshot && (
                <Badge
                  variant={lastSnapshot.status === "completed" ? "default" : "destructive"}
                  className="text-[10px] px-1.5 py-0"
                >
                  {lastSnapshot.status}
                </Badge>
              )}
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {lastSnapshot ? new Date(lastSnapshot.createdAt).toLocaleDateString() : "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Total Storage Used */}
        <Card data-testid="metric-storage-used">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Storage Utilized
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {formatBytes(totalStorageBytes)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Total archive volume
            </p>
          </CardContent>
        </Card>

        {/* Metric 4: Retention Policy */}
        <Card data-testid="metric-retention-policy">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Retention Policy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">
              {schedule.enabled ? `${schedule.frequency} Cadence` : "Disabled"}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Keep last {schedule.retentionCount} snapshots
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-800 rounded-lg p-1 bg-slate-50 dark:bg-slate-900">
          <button
            type="button"
            data-testid="filter-type-all"
            onClick={() => setTypeFilter("all")}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              typeFilter === "all"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            All Backups
          </button>
          <button
            type="button"
            data-testid="filter-type-full"
            onClick={() => setTypeFilter("full")}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              typeFilter === "full"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            Full Snapshots
          </button>
          <button
            type="button"
            data-testid="filter-type-database"
            onClick={() => setTypeFilter("database")}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              typeFilter === "database"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            Database Only
          </button>
          <button
            type="button"
            data-testid="filter-type-assets"
            onClick={() => setTypeFilter("assets")}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              typeFilter === "assets"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            Assets Only
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            data-testid="search-backups-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search snapshots..."
            className="pl-8 text-xs h-9"
          />
        </div>
      </div>

      {/* Backups Table */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950">
        <Table data-testid="backups-table">
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Snapshot</TableHead>
              <TableHead className="text-xs">Scope</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Size</TableHead>
              <TableHead className="text-xs">Trigger</TableHead>
              <TableHead className="text-xs">Created At</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-xs text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    Loading backup records...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredSnapshots.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  data-testid="backups-empty-state"
                  className="h-40 text-center text-xs text-slate-500 dark:text-slate-400"
                >
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Archive className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      No backups found
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Create an immediate backup or configure the automated schedule.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredSnapshots.map((snap) => (
                <TableRow
                  key={snap.id}
                  data-testid={`backup-row-${snap.id}`}
                  className="hover:bg-slate-50 dark:hover:bg-slate-900/60"
                >
                  <TableCell className="font-medium text-xs">
                    <div className="flex flex-col">
                      <span className="text-slate-900 dark:text-slate-100 font-semibold">
                        {snap.name}
                      </span>
                      {snap.description && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                          {snap.description}
                        </span>
                      )}
                      {snap.checksum && (
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {snap.checksum.substring(0, 20)}...
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-xs">
                    <Badge variant="outline" className="uppercase text-[10px]">
                      {snap.type}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-xs">
                    <div className="flex items-center gap-1.5">
                      {snap.status === "completed" && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                      {snap.status === "failed" && (
                        <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                      )}
                      {snap.status === "in_progress" && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                      )}
                      <span className="capitalize">{snap.status}</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-xs font-mono">
                    {snap.formattedSize || formatBytes(snap.sizeBytes)}
                  </TableCell>

                  <TableCell className="text-xs capitalize text-slate-500 dark:text-slate-400">
                    {snap.trigger}
                  </TableCell>

                  <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(snap.createdAt).toLocaleString()}
                  </TableCell>

                  <TableCell className="text-xs text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`restore-btn-${snap.id}`}
                        onClick={() => setRestoreTarget(snap)}
                        title="Restore Snapshot"
                        className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Restore
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`download-btn-${snap.id}`}
                        onClick={() => handleDownload(snap)}
                        title="Download Backup"
                        className="h-8 w-8 p-0"
                      >
                        <Download className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                      </Button>

                      {onDeleteBackup && (
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`delete-btn-${snap.id}`}
                          onClick={() => onDeleteBackup(snap.id)}
                          title="Delete Backup"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modals */}
      <CreateBackupDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreate={onCreateBackup}
      />

      <RestoreBackupDialog
        open={Boolean(restoreTarget)}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
        snapshot={restoreTarget}
        onRestore={onRestoreBackup}
      />

      <BackupScheduleDialog
        open={isScheduleOpen}
        onOpenChange={setIsScheduleOpen}
        schedule={schedule}
        onSave={onSaveSchedule}
      />
    </div>
  );
}
