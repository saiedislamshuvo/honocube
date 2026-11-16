export interface ImpersonationUser {
  id: string | number;
  name: string;
  email?: string;
  role?: string;
  roles?: string[];
  tenantId?: string | number;
  [key: string]: unknown;
}

export interface ImpersonationSession {
  id: string;
  originalUser: ImpersonationUser;
  targetUser?: ImpersonationUser;
  targetTenantId?: string | number;
  reason?: string;
  startedAt: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ImpersonationState {
  isImpersonating: boolean;
  session?: ImpersonationSession | null;
}

/**
 * Returns true if the session object represents an active impersonation session.
 */
export function isImpersonating(
  session?: ImpersonationSession | null
): boolean {
  if (!session) return false;
  if (!session.expiresAt) return true;
  return new Date(session.expiresAt).getTime() > Date.now();
}

/**
 * Formats a user-friendly descriptive label for the active impersonation session.
 */
export function formatImpersonationTitle(
  session: ImpersonationSession
): string {
  const targetUser = session.targetUser?.name || session.targetUser?.id;
  const targetTenant = session.targetTenantId;

  if (targetUser && targetTenant) {
    return `${targetUser} @ Tenant ${targetTenant}`;
  }
  if (targetUser) {
    return `User ${targetUser}`;
  }
  if (targetTenant) {
    return `Tenant ${targetTenant}`;
  }
  return "Tenant Workspace";
}
