import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  formatBytes,
  validateRestoreConfirmation,
  createMockBackupSnapshot,
  DEFAULT_BACKUP_SCHEDULE,
  CreateBackupDialog,
  RestoreBackupDialog,
  BackupScheduleDialog,
  BackupManagerView,
  type BackupSnapshot,
} from "../src/index.js";

describe("Database & Asset Backup Management UI (Issue #151)", () => {
  describe("Backup Utilities", () => {
    it("formats storage sizes accurately", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(1048576 * 14.5)).toBe("14.5 MB");
      expect(formatBytes(1073741824 * 3.2)).toBe("3.2 GB");
    });

    it("validates typing 'RESTORE' confirmation token", () => {
      expect(validateRestoreConfirmation("RESTORE")).toBe(true);
      expect(validateRestoreConfirmation("restore")).toBe(false);
      expect(validateRestoreConfirmation("DELETE")).toBe(false);
      expect(validateRestoreConfirmation("")).toBe(false);
    });

    it("generates realistic mock backup snapshots", () => {
      const snap = createMockBackupSnapshot({ name: "my-custom-snapshot" });
      expect(snap.id).toBeDefined();
      expect(snap.name).toBe("my-custom-snapshot");
      expect(snap.status).toBe("completed");
      expect(snap.type).toBe("full");
      expect(snap.checksum).toBeDefined();
      expect(snap.tablesCount).toBe(18);
    });
  });

  describe("CreateBackupDialog Component", () => {
    it("renders creation dialog with scope selector, name, and description fields", () => {
      const html = renderToString(
        <CreateBackupDialog
          open={true}
          onOpenChange={vi.fn()}
          onCreate={vi.fn()}
        />
      );

      expect(html).toContain("data-testid=\"create-backup-dialog\"");
      expect(html).toContain("Create Backup Snapshot");
      expect(html).toContain("data-testid=\"backup-name-input\"");
      expect(html).toContain("data-testid=\"backup-type-full\"");
      expect(html).toContain("data-testid=\"backup-type-database\"");
      expect(html).toContain("data-testid=\"backup-type-assets\"");
      expect(html).toContain("data-testid=\"backup-desc-input\"");
      expect(html).toContain("data-testid=\"submit-backup-btn\"");
    });
  });

  describe("RestoreBackupDialog Component", () => {
    it("renders danger zone warning, snapshot details, and confirmation safeguard", () => {
      const sampleSnapshot = createMockBackupSnapshot({
        id: "snap_critical_1",
        name: "pre-upgrade-db-backup",
        type: "database",
        formattedSize: "28.4 MB",
      });

      const html = renderToString(
        <RestoreBackupDialog
          open={true}
          onOpenChange={vi.fn()}
          snapshot={sampleSnapshot}
          onRestore={vi.fn()}
        />
      );

      expect(html).toContain("data-testid=\"restore-backup-dialog\"");
      expect(html).toContain("data-testid=\"restore-warning-banner\"");
      expect(html).toContain("data-testid=\"snapshot-details-card\"");
      expect(html).toContain("pre-upgrade-db-backup");
      expect(html).toContain("database");
      expect(html).toContain("28.4 MB");
      expect(html).toContain("data-testid=\"safety-snapshot-checkbox\"");
      expect(html).toContain("data-testid=\"restore-confirm-input\"");
      expect(html).toContain("data-testid=\"confirm-restore-btn\"");
    });
  });

  describe("BackupScheduleDialog Component", () => {
    it("renders cadence toggle, frequency, execution time, and retention limit inputs", () => {
      const html = renderToString(
        <BackupScheduleDialog
          open={true}
          onOpenChange={vi.fn()}
          schedule={DEFAULT_BACKUP_SCHEDULE}
          onSave={vi.fn()}
        />
      );

      expect(html).toContain("data-testid=\"backup-schedule-dialog\"");
      expect(html).toContain("data-testid=\"schedule-enabled-switch\"");
      expect(html).toContain("data-testid=\"schedule-frequency-select\"");
      expect(html).toContain("data-testid=\"schedule-time-input\"");
      expect(html).toContain("data-testid=\"schedule-type-select\"");
      expect(html).toContain("data-testid=\"schedule-retention-input\"");
      expect(html).toContain("data-testid=\"save-schedule-btn\"");
    });
  });

  describe("BackupManagerView Component", () => {
    it("renders overview stat cards, search bar, and snapshot table", () => {
      const snapshots: BackupSnapshot[] = [
        createMockBackupSnapshot({
          id: "snap_01",
          name: "daily-prod-full",
          type: "full",
          status: "completed",
          sizeBytes: 52428800,
          formattedSize: "50.0 MB",
        }),
        createMockBackupSnapshot({
          id: "snap_02",
          name: "schema-v2-db-only",
          type: "database",
          status: "completed",
          sizeBytes: 15728640,
          formattedSize: "15.0 MB",
        }),
      ];

      const html = renderToString(
        <BackupManagerView
          snapshots={snapshots}
          schedule={DEFAULT_BACKUP_SCHEDULE}
          onCreateBackup={vi.fn()}
          onRestoreBackup={vi.fn()}
          onDeleteBackup={vi.fn()}
        />
      );

      // Stat cards
      expect(html).toContain("data-testid=\"backup-manager-view\"");
      expect(html).toContain("data-testid=\"metric-total-backups\"");
      expect(html).toContain("data-testid=\"metric-last-backup\"");
      expect(html).toContain("data-testid=\"metric-storage-used\"");
      expect(html).toContain("data-testid=\"metric-retention-policy\"");

      // Action triggers
      expect(html).toContain("data-testid=\"open-create-backup-btn\"");
      expect(html).toContain("data-testid=\"open-schedule-settings-btn\"");

      // Filters
      expect(html).toContain("data-testid=\"filter-type-all\"");
      expect(html).toContain("data-testid=\"filter-type-full\"");
      expect(html).toContain("data-testid=\"filter-type-database\"");
      expect(html).toContain("data-testid=\"filter-type-assets\"");
      expect(html).toContain("data-testid=\"search-backups-input\"");

      // Table & Rows
      expect(html).toContain("data-testid=\"backups-table\"");
      expect(html).toContain("data-testid=\"backup-row-snap_01\"");
      expect(html).toContain("data-testid=\"backup-row-snap_02\"");
      expect(html).toContain("daily-prod-full");
      expect(html).toContain("schema-v2-db-only");
      expect(html).toContain("data-testid=\"restore-btn-snap_01\"");
      expect(html).toContain("data-testid=\"download-btn-snap_01\"");
      expect(html).toContain("data-testid=\"delete-btn-snap_01\"");
    });

    it("renders empty state when snapshot list is empty", () => {
      const html = renderToString(
        <BackupManagerView
          snapshots={[]}
          schedule={DEFAULT_BACKUP_SCHEDULE}
        />
      );

      expect(html).toContain("data-testid=\"backups-empty-state\"");
      expect(html).toContain("No backups found");
    });
  });
});
