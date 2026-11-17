/**
 * Backup and Disaster Recovery Contracts & Utilities (Issue #151)
 */

export type BackupType = "full" | "database" | "assets";
export type BackupStatus = "pending" | "in_progress" | "completed" | "failed";
export type BackupTrigger = "manual" | "scheduled";
export type BackupFrequency = "daily" | "weekly" | "monthly";

export interface BackupSnapshot {
  id: string;
  name: string;
  type: BackupType;
  status: BackupStatus;
  trigger: BackupTrigger;
  sizeBytes: number;
  formattedSize: string;
  createdAt: string;
  completedAt?: string;
  checksum?: string;
  description?: string;
  tablesCount?: number;
  recordsCount?: number;
  assetsCount?: number;
  storageLocation?: string;
  downloadUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface BackupScheduleConfig {
  enabled: boolean;
  frequency: BackupFrequency;
  time?: string;
  backupType: BackupType;
  retentionCount: number;
  targetStorage?: string;
  lastRunAt?: string;
  nextRunAt?: string;
}

export interface RestoreOptions {
  snapshotId: string;
  confirmation: string;
  createPreRestoreSnapshot?: boolean;
}

export interface RestoreResult {
  success: boolean;
  snapshotId: string;
  preRestoreSnapshotId?: string;
  restoredAt: string;
  durationMs: number;
  tablesRestored?: number;
  recordsRestored?: number;
  assetsRestored?: number;
  error?: string;
}

export interface CreateBackupOptions {
  name?: string;
  type?: BackupType;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface BackupManagerConfig {
  snapshots?: BackupSnapshot[];
  schedule?: BackupScheduleConfig;
  defaultRetentionCount?: number;
  storageTarget?: string;
  onBeforeBackup?: (options: CreateBackupOptions) => Promise<void> | void;
  onAfterBackup?: (snapshot: BackupSnapshot) => Promise<void> | void;
  onBeforeRestore?: (options: RestoreOptions) => Promise<void> | void;
  onAfterRestore?: (result: RestoreResult) => Promise<void> | void;
}

export const DEFAULT_BACKUP_SCHEDULE: BackupScheduleConfig = {
  enabled: true,
  frequency: "daily",
  time: "02:00 UTC",
  backupType: "full",
  retentionCount: 7,
  targetStorage: "local",
};

/**
 * Format raw byte size into human-readable string (B, KB, MB, GB, TB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0 || !Number.isFinite(bytes) || bytes < 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, idx)).toFixed(dm))} ${sizes[idx]}`;
}

/**
 * Validates that confirmation text matches the required token (default: "RESTORE")
 */
export function validateRestoreConfirmation(input: string, requiredText = "RESTORE"): boolean {
  if (!input) return false;
  return input.trim() === requiredText.trim();
}

/**
 * Helper to generate a realistic mock backup snapshot for testing and development
 */
export function createMockBackupSnapshot(overrides?: Partial<BackupSnapshot>): BackupSnapshot {
  const now = new Date();
  const id = overrides?.id || `backup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const type = overrides?.type || "full";
  const sizeBytes = overrides?.sizeBytes ?? (type === "assets" ? 52428800 : type === "database" ? 15728640 : 68157440);

  return {
    id,
    name: overrides?.name || `snapshot-${now.toISOString().split("T")[0]}-${type}`,
    type,
    status: overrides?.status || "completed",
    trigger: overrides?.trigger || "manual",
    sizeBytes,
    formattedSize: overrides?.formattedSize || formatBytes(sizeBytes),
    createdAt: overrides?.createdAt || now.toISOString(),
    completedAt: overrides?.completedAt || new Date(now.getTime() + 15000).toISOString(),
    checksum: overrides?.checksum || `sha256:${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`,
    description: overrides?.description || (type === "full" ? "Full database and media asset snapshot" : `${type} backup`),
    tablesCount: overrides?.tablesCount ?? (type !== "assets" ? 18 : 0),
    recordsCount: overrides?.recordsCount ?? (type !== "assets" ? 2450 : 0),
    assetsCount: overrides?.assetsCount ?? (type !== "database" ? 340 : 0),
    storageLocation: overrides?.storageLocation || `backups/${id}.tar.gz`,
    downloadUrl: overrides?.downloadUrl || `/api/backups/${id}/download`,
    metadata: overrides?.metadata,
  };
}
