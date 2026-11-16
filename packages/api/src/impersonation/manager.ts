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

export interface ImpersonationManagerOptions {
  maxDurationSeconds?: number;
  initialSessions?: ImpersonationSession[];
  authorize?: (c: any, appContext: any) => boolean | Promise<boolean>;
}

export interface ImpersonationManager {
  startSession: (params: {
    originalUser: ImpersonationUser;
    targetUser?: ImpersonationUser;
    targetTenantId?: string | number;
    reason?: string;
    expiresInSeconds?: number;
    metadata?: Record<string, unknown>;
  }) => ImpersonationSession;
  stopSession: (sessionId?: string) => boolean;
  getSession: (sessionId: string) => ImpersonationSession | undefined;
  getActiveSession: () => ImpersonationSession | undefined;
  listSessions: () => ImpersonationSession[];
  clear: () => void;
  resolveSessionFromContext: (
    c: any,
    appContext?: any
  ) => ImpersonationSession | undefined;
}

export function createImpersonationManager(
  options: ImpersonationManagerOptions = {}
): ImpersonationManager {
  const maxDuration = options.maxDurationSeconds ?? 3600; // 1 hour default
  const sessions = new Map<string, ImpersonationSession>();
  let currentActiveId: string | undefined;

  if (options.initialSessions) {
    for (const session of options.initialSessions) {
      sessions.set(session.id, { ...session });
      currentActiveId = session.id;
    }
  }

  const isExpired = (session: ImpersonationSession): boolean => {
    if (!session.expiresAt) return false;
    return new Date(session.expiresAt).getTime() <= Date.now();
  };

  const startSession = (params: {
    originalUser: ImpersonationUser;
    targetUser?: ImpersonationUser;
    targetTenantId?: string | number;
    reason?: string;
    expiresInSeconds?: number;
    metadata?: Record<string, unknown>;
  }): ImpersonationSession => {
    const duration = params.expiresInSeconds ?? maxDuration;
    const now = Date.now();
    const sessionId = `imp_${now}_${Math.random().toString(36).substring(2, 8)}`;

    const session: ImpersonationSession = {
      id: sessionId,
      originalUser: params.originalUser,
      targetUser: params.targetUser,
      targetTenantId: params.targetTenantId,
      reason: params.reason,
      startedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + duration * 1000).toISOString(),
      metadata: params.metadata,
    };

    sessions.set(sessionId, session);
    currentActiveId = sessionId;
    return session;
  };

  const stopSession = (sessionId?: string): boolean => {
    const idToStop = sessionId || currentActiveId;
    if (!idToStop) return false;

    const existed = sessions.delete(idToStop);
    if (currentActiveId === idToStop) {
      const remaining = Array.from(sessions.values()).filter(
        (s) => !isExpired(s)
      );
      currentActiveId = remaining[remaining.length - 1]?.id;
    }
    return existed;
  };

  const getSession = (sessionId: string): ImpersonationSession | undefined => {
    const session = sessions.get(sessionId);
    if (!session) return undefined;
    if (isExpired(session)) {
      sessions.delete(sessionId);
      if (currentActiveId === sessionId) {
        currentActiveId = undefined;
      }
      return undefined;
    }
    return session;
  };

  const getActiveSession = (): ImpersonationSession | undefined => {
    if (!currentActiveId) return undefined;
    return getSession(currentActiveId);
  };

  const listSessions = (): ImpersonationSession[] => {
    const valid: ImpersonationSession[] = [];
    for (const [id, session] of sessions.entries()) {
      if (isExpired(session)) {
        sessions.delete(id);
      } else {
        valid.push(session);
      }
    }
    return valid;
  };

  const clear = () => {
    sessions.clear();
    currentActiveId = undefined;
  };

  const resolveSessionFromContext = (
    c: any,
    _appContext?: any
  ): ImpersonationSession | undefined => {
    if (!c?.req) {
      return getActiveSession();
    }

    // 1. Check session id header
    const sessionIdHeader =
      c.req.header("x-impersonate-session") ||
      c.req.header("x-impersonation-session-id");
    if (sessionIdHeader) {
      const found = getSession(sessionIdHeader);
      if (found) return found;
    }

    // 2. Check query param
    try {
      const querySessionId = c.req.query?.("impersonate_session");
      if (querySessionId) {
        const found = getSession(querySessionId);
        if (found) return found;
      }
    } catch {
      // ignore
    }

    // 3. Stateless headers: x-impersonate-user and/or x-impersonate-tenant
    const impUserHeader = c.req.header("x-impersonate-user");
    const impTenantHeader = c.req.header("x-impersonate-tenant");
    const impReason = c.req.header("x-impersonate-reason");

    if (impUserHeader || impTenantHeader) {
      const originalUser =
        c.get?.("user") ||
        _appContext?.user || {
          id: "superadmin",
          name: "Superadmin",
          role: "superadmin",
        };

      return {
        id: `stateless_${impUserHeader || ""}_${impTenantHeader || ""}`,
        originalUser,
        targetUser: impUserHeader
          ? { id: impUserHeader, name: impUserHeader }
          : undefined,
        targetTenantId: impTenantHeader || undefined,
        reason: impReason || undefined,
        startedAt: new Date().toISOString(),
      };
    }

    // 4. Default to in-memory active session if any
    return getActiveSession();
  };

  return {
    startSession,
    stopSession,
    getSession,
    getActiveSession,
    listSessions,
    clear,
    resolveSessionFromContext,
  };
}
