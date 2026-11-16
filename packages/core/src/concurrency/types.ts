export interface RevisionConflict<T = Record<string, unknown>> {
  id: string | number;
  expectedVersion?: string | number;
  currentVersion?: string | number;
  serverRecord?: T;
  clientRecord?: T;
}

export type ConflictResolutionAction = "overwrite" | "reload" | "merge" | "cancel";
