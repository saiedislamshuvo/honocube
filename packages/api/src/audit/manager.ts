import type { AuditEntry, AuditFieldDiff, AuditAction } from "../types.js";

export interface AuditQueryFilter {
  resource?: string;
  recordId?: string | number;
  action?: string;
  actorId?: string | number;
  tenantId?: string | number;
  startDate?: string | number;
  endDate?: string | number;
  limit?: number;
}

export interface AuditManagerOptions {
  maxLogSize?: number;
  initialEntries?: AuditEntry[];
}

export interface AuditManager {
  record: (
    entry: Omit<AuditEntry, "id" | "timestamp"> & {
      id?: string | number;
      timestamp?: string;
    }
  ) => AuditEntry;
  getEntries: (filter?: AuditQueryFilter) => AuditEntry[];
  getEntry: (id: string | number) => AuditEntry | undefined;
  getRecordTrail: (resource: string, recordId: string | number) => AuditEntry[];
  clear: () => void;
}

export function createAuditManager(
  options: AuditManagerOptions = {}
): AuditManager {
  const maxLogSize = options.maxLogSize ?? 1000;
  const entries: AuditEntry[] = [];

  if (options.initialEntries) {
    for (const entry of options.initialEntries) {
      entries.push({ ...entry });
    }
  }

  const record = (
    input: Omit<AuditEntry, "id" | "timestamp"> & {
      id?: string | number;
      timestamp?: string;
    }
  ): AuditEntry => {
    const entry: AuditEntry = {
      ...input,
      id:
        input.id ??
        `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: input.timestamp ?? new Date().toISOString(),
    };

    entries.unshift(entry);
    if (entries.length > maxLogSize) {
      entries.length = maxLogSize;
    }
    return entry;
  };

  const getEntries = (filter?: AuditQueryFilter): AuditEntry[] => {
    let result = entries;

    if (filter?.resource) {
      result = result.filter(
        (e) => e.resource.toLowerCase() === filter.resource!.toLowerCase()
      );
    }

    if (filter?.recordId !== undefined && filter?.recordId !== null) {
      result = result.filter((e) => String(e.recordId) === String(filter.recordId));
    }

    if (filter?.action) {
      result = result.filter(
        (e) => e.action.toLowerCase() === filter.action!.toLowerCase()
      );
    }

    if (filter?.actorId !== undefined && filter?.actorId !== null) {
      result = result.filter(
        (e) => e.actorId !== null && String(e.actorId) === String(filter.actorId)
      );
    }

    if (filter?.tenantId !== undefined && filter?.tenantId !== null) {
      result = result.filter(
        (e) => e.tenantId !== null && String(e.tenantId) === String(filter.tenantId)
      );
    }

    if (filter?.startDate) {
      const startMs =
        typeof filter.startDate === "number"
          ? filter.startDate
          : new Date(filter.startDate).getTime();
      result = result.filter((e) => new Date(e.timestamp).getTime() >= startMs);
    }

    if (filter?.endDate) {
      const endMs =
        typeof filter.endDate === "number"
          ? filter.endDate
          : new Date(filter.endDate).getTime();
      result = result.filter((e) => new Date(e.timestamp).getTime() <= endMs);
    }

    if (filter?.limit && filter.limit > 0) {
      result = result.slice(0, filter.limit);
    }

    return result;
  };

  const getEntry = (id: string | number): AuditEntry | undefined => {
    return entries.find((e) => String(e.id) === String(id));
  };

  const getRecordTrail = (
    resource: string,
    recordId: string | number
  ): AuditEntry[] => {
    return getEntries({ resource, recordId });
  };

  const clear = () => {
    entries.length = 0;
  };

  return {
    record,
    getEntries,
    getEntry,
    getRecordTrail,
    clear,
  };
}

export type { AuditEntry, AuditFieldDiff, AuditAction };
