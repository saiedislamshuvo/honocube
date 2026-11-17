import { describe, expect, it } from "vitest";
import {
  createBackupManager,
  formatBytes,
  validateRestoreConfirmation,
  createApp,
  type BackupSnapshot,
} from "../../src/index.js";

describe("Database & Asset Backup Management Engine (Issue #151)", () => {
  describe("Utility Functions", () => {
    it("formats bytes into human-readable strings", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(512)).toBe("512 B");
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(1536)).toBe("1.5 KB");
      expect(formatBytes(1048576 * 25.5)).toBe("25.5 MB");
      expect(formatBytes(1073741824 * 2)).toBe("2 GB");
      expect(formatBytes(-100)).toBe("0 B");
    });

    it("validates restore confirmation token", () => {
      expect(validateRestoreConfirmation("RESTORE")).toBe(true);
      expect(validateRestoreConfirmation("  RESTORE  ")).toBe(true);
      expect(validateRestoreConfirmation("restore")).toBe(false);
      expect(validateRestoreConfirmation("CONFIRM")).toBe(false);
      expect(validateRestoreConfirmation("")).toBe(false);
    });
  });

  describe("BackupManager Core Engine", () => {
    it("creates, retrieves, and lists backup snapshots", async () => {
      const manager = createBackupManager();
      expect(manager.listBackups()).toHaveLength(0);

      const fullSnap = await manager.createBackup({
        name: "test-full-snapshot",
        type: "full",
        description: "Full system backup",
      });

      expect(fullSnap.id).toBeDefined();
      expect(fullSnap.name).toBe("test-full-snapshot");
      expect(fullSnap.type).toBe("full");
      expect(fullSnap.status).toBe("completed");
      expect(fullSnap.tablesCount).toBeGreaterThan(0);
      expect(fullSnap.assetsCount).toBeGreaterThan(0);
      expect(fullSnap.sizeBytes).toBeGreaterThan(0);
      expect(fullSnap.checksum).toMatch(/^sha256:/);

      const retrieved = manager.getBackup(fullSnap.id);
      expect(retrieved?.name).toBe("test-full-snapshot");

      const dbOnlySnap = await manager.createBackup({
        name: "test-db-only",
        type: "database",
      });
      expect(dbOnlySnap.tablesCount).toBeGreaterThan(0);
      expect(dbOnlySnap.assetsCount).toBe(0);

      const all = manager.listBackups();
      expect(all).toHaveLength(2);
      expect(all[0].id).toBe(dbOnlySnap.id); // Most recent first

      const dbFiltered = manager.listBackups({ type: "database" });
      expect(dbFiltered).toHaveLength(1);
      expect(dbFiltered[0].name).toBe("test-db-only");
    });

    it("safely restores from snapshot with confirmation safeguard and creates pre-restore safety snapshot", async () => {
      const manager = createBackupManager();
      const snapshot = await manager.createBackup({
        name: "stable-prod-snapshot",
        type: "full",
      });

      // Attempt restore with invalid confirmation
      await expect(
        manager.restoreBackup({
          snapshotId: snapshot.id,
          confirmation: "wrong_token",
        })
      ).rejects.toThrow("Restore confirmation rejected: input must be 'RESTORE'");

      // Valid restore
      const result = await manager.restoreBackup({
        snapshotId: snapshot.id,
        confirmation: "RESTORE",
        createPreRestoreSnapshot: true,
      });

      expect(result.success).toBe(true);
      expect(result.snapshotId).toBe(snapshot.id);
      expect(result.preRestoreSnapshotId).toBeDefined();

      // Check that the pre-restore snapshot was automatically created
      const preRestoreSnap = manager.getBackup(result.preRestoreSnapshotId!);
      expect(preRestoreSnap).toBeDefined();
      expect(preRestoreSnap?.name).toContain("pre-restore-safety");
    });

    it("enforces retention policy by pruning oldest completed backups", async () => {
      const manager = createBackupManager({
        defaultRetentionCount: 3,
      });

      const snap1 = await manager.createBackup({ name: "snap-1" });
      const snap2 = await manager.createBackup({ name: "snap-2" });
      const snap3 = await manager.createBackup({ name: "snap-3" });

      expect(manager.listBackups()).toHaveLength(3);

      // 4th backup should prune snap-1
      const snap4 = await manager.createBackup({ name: "snap-4" });
      const current = manager.listBackups();
      expect(current).toHaveLength(3);
      expect(current.map((s) => s.id)).toEqual([snap4.id, snap3.id, snap2.id]);
      expect(manager.getBackup(snap1.id)).toBeUndefined();
    });

    it("manages backup schedule configuration", () => {
      const manager = createBackupManager();
      const initialSchedule = manager.getSchedule();
      expect(initialSchedule.enabled).toBe(true);
      expect(initialSchedule.frequency).toBe("daily");

      const updated = manager.updateSchedule({
        enabled: true,
        frequency: "weekly",
        time: "04:00 UTC",
        retentionCount: 14,
      });

      expect(updated.frequency).toBe("weekly");
      expect(updated.time).toBe("04:00 UTC");
      expect(updated.retentionCount).toBe(14);
      expect(manager.getSchedule().frequency).toBe("weekly");
    });
  });

  describe("Hono REST Backup Endpoints", () => {
    it("serves backup management routes on the HonoCube API", async () => {
      const initialSnap: BackupSnapshot = {
        id: "snap_init_1",
        name: "initial-snapshot",
        type: "full",
        status: "completed",
        trigger: "manual",
        sizeBytes: 10485760,
        formattedSize: "10 MB",
        createdAt: new Date().toISOString(),
      };

      const app = createApp({
        backups: {
          initialSnapshots: [initialSnap],
        },
      });

      const api = app.defineApi({});

      // 1. GET /backups
      const listRes = await api.request("/backups");
      expect(listRes.status).toBe(200);
      const listJson = await listRes.json();
      expect(listJson.data).toHaveLength(1);
      expect(listJson.data[0].id).toBe("snap_init_1");

      // 2. POST /backups
      const createRes = await api.request("/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "api-created-snapshot",
          type: "database",
          description: "Database backup before schema migration",
        }),
      });
      expect(createRes.status).toBe(201);
      const createJson = await createRes.json();
      expect(createJson.data.name).toBe("api-created-snapshot");
      const createdId = createJson.data.id;

      // 3. GET /backups/:id
      const getRes = await api.request(`/backups/${createdId}`);
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json();
      expect(getJson.data.name).toBe("api-created-snapshot");

      // 4. POST /backups/:id/restore with rejection
      const badRestoreRes = await api.request(`/backups/${createdId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation: "NOPE",
        }),
      });
      expect(badRestoreRes.status).toBe(400);

      // 5. POST /backups/:id/restore with valid confirmation
      const goodRestoreRes = await api.request(`/backups/${createdId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation: "RESTORE",
        }),
      });
      expect(goodRestoreRes.status).toBe(200);
      const goodRestoreJson = await goodRestoreRes.json();
      expect(goodRestoreJson.data.success).toBe(true);

      // 6. GET /backups/schedule & POST /backups/schedule
      const schedGetRes = await api.request("/backups/schedule");
      expect(schedGetRes.status).toBe(200);

      const schedUpdateRes = await api.request("/backups/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frequency: "monthly",
          retentionCount: 30,
        }),
      });
      expect(schedUpdateRes.status).toBe(200);
      const schedUpdateJson = await schedUpdateRes.json();
      expect(schedUpdateJson.data.frequency).toBe("monthly");
      expect(schedUpdateJson.data.retentionCount).toBe(30);

      // 7. DELETE /backups/:id
      const deleteRes = await api.request(`/backups/${createdId}`, {
        method: "DELETE",
      });
      expect(deleteRes.status).toBe(200);

      const afterDeleteRes = await api.request(`/backups/${createdId}`);
      expect(afterDeleteRes.status).toBe(404);
    });
  });
});
