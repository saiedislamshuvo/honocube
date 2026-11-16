import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  useId,
} from "react";
import { UnsavedChangesDialog } from "../views/unsaved-changes-dialog.js";

export interface NavigationGuardContextValue {
  isGuarded: boolean;
  registerGuard: (id: string, isDirty: boolean, message?: string) => void;
  unregisterGuard: (id: string) => void;
  guardedNavigate: (target: string | (() => void)) => boolean;
  confirmNavigation: () => void;
  cancelNavigation: () => void;
  dialogOpen: boolean;
  message?: string;
}

const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(null);

export interface NavigationGuardProviderProps {
  children: React.ReactNode;
  onNavigate?: (href: string) => void;
  dialogTitle?: React.ReactNode;
  dialogDescription?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function NavigationGuardProvider({
  children,
  onNavigate,
  dialogTitle,
  dialogDescription,
  confirmLabel,
  cancelLabel,
}: NavigationGuardProviderProps): React.JSX.Element {
  const guardsRef = useRef<Map<string, { isDirty: boolean; message?: string }>>(new Map());
  const [isGuarded, setIsGuarded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeMessage, setActiveMessage] = useState<string | undefined>(undefined);
  const pendingTargetRef = useRef<(string | (() => void)) | null>(null);

  const recomputeGuarded = useCallback(() => {
    let dirty = false;
    let msg: string | undefined = undefined;
    for (const guard of guardsRef.current.values()) {
      if (guard.isDirty) {
        dirty = true;
        if (guard.message) msg = guard.message;
        break;
      }
    }
    setIsGuarded(dirty);
    setActiveMessage(msg);
  }, []);

  const registerGuard = useCallback(
    (id: string, isDirty: boolean, message?: string) => {
      guardsRef.current.set(id, { isDirty, message });
      recomputeGuarded();
    },
    [recomputeGuarded]
  );

  const unregisterGuard = useCallback(
    (id: string) => {
      guardsRef.current.delete(id);
      recomputeGuarded();
    },
    [recomputeGuarded]
  );

  const executeNavigation = useCallback(
    (target: string | (() => void)) => {
      if (typeof target === "string") {
        if (onNavigate) {
          onNavigate(target);
        } else if (typeof window !== "undefined") {
          window.location.href = target;
        }
      } else if (typeof target === "function") {
        target();
      }
    },
    [onNavigate]
  );

  const guardedNavigate = useCallback(
    (target: string | (() => void)): boolean => {
      if (isGuarded) {
        pendingTargetRef.current = target;
        setDialogOpen(true);
        return false;
      }
      executeNavigation(target);
      return true;
    },
    [isGuarded, executeNavigation]
  );

  const confirmNavigation = useCallback(() => {
    const target = pendingTargetRef.current;
    pendingTargetRef.current = null;
    setDialogOpen(false);
    // Clear all dirty states so subsequent navigation isn't blocked
    guardsRef.current.clear();
    setIsGuarded(false);
    if (target) {
      executeNavigation(target);
    }
  }, [executeNavigation]);

  const cancelNavigation = useCallback(() => {
    pendingTargetRef.current = null;
    setDialogOpen(false);
  }, []);

  // Global browser beforeunload listener when guarded
  useEffect(() => {
    if (!isGuarded || typeof window === "undefined") return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const msg = activeMessage || "You have unsaved changes. Are you sure you want to leave?";
      e.preventDefault();
      e.returnValue = msg;
      return msg;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isGuarded, activeMessage]);

  return (
    <NavigationGuardContext.Provider
      value={{
        isGuarded,
        registerGuard,
        unregisterGuard,
        guardedNavigate,
        confirmNavigation,
        cancelNavigation,
        dialogOpen,
        message: activeMessage,
      }}
    >
      {children}
      <UnsavedChangesDialog
        open={dialogOpen}
        title={dialogTitle}
        description={dialogDescription || activeMessage}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        onConfirm={confirmNavigation}
        onCancel={cancelNavigation}
      />
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard(): NavigationGuardContextValue | null {
  return useContext(NavigationGuardContext);
}

export interface UseUnsavedChangesGuardOptions {
  isDirty?: boolean;
  enabled?: boolean;
  message?: string;
  onConfirmLeave?: () => void;
  onCancelLeave?: () => void;
}

export function useUnsavedChangesGuard({
  isDirty = false,
  enabled = true,
  message = "You have unsaved changes. Are you sure you want to leave?",
  onConfirmLeave,
  onCancelLeave,
}: UseUnsavedChangesGuardOptions = {}) {
  const guardId = useId();
  const context = useNavigationGuard();

  const [standaloneDialogOpen, setStandaloneDialogOpen] = useState(false);
  const standalonePendingRef = useRef<(string | (() => void)) | null>(null);

  const shouldGuard = Boolean(enabled && isDirty);

  // Register with provider if available
  useEffect(() => {
    if (context) {
      context.registerGuard(guardId, shouldGuard, message);
      return () => {
        context.unregisterGuard(guardId);
      };
    }
  }, [context, guardId, shouldGuard, message]);

  // Window beforeunload prompt (especially when standalone or directly mounted)
  useEffect(() => {
    if (!shouldGuard || typeof window === "undefined") return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [shouldGuard, message]);

  // Intercept browser back/forward buttons (popstate)
  useEffect(() => {
    if (!shouldGuard || typeof window === "undefined") return;

    // Push dummy history entry so back button doesn't unload immediately
    try {
      window.history.pushState(null, "", window.location.href);
    } catch {
      // In non-browser/test environments, history.pushState might not be supported
    }

    const handlePopState = () => {
      try {
        window.history.pushState(null, "", window.location.href);
      } catch {
        // Ignored
      }
      setStandaloneDialogOpen(true);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [shouldGuard]);

  const confirmLeave = useCallback(() => {
    const target = standalonePendingRef.current;
    standalonePendingRef.current = null;
    setStandaloneDialogOpen(false);
    onConfirmLeave?.();
    if (target) {
      if (typeof target === "string" && typeof window !== "undefined") {
        window.location.href = target;
      } else if (typeof target === "function") {
        target();
      }
    }
  }, [onConfirmLeave]);

  const cancelLeave = useCallback(() => {
    standalonePendingRef.current = null;
    setStandaloneDialogOpen(false);
    onCancelLeave?.();
  }, [onCancelLeave]);

  const guardedNavigate = useCallback(
    (target: string | (() => void)): boolean => {
      if (context) {
        return context.guardedNavigate(target);
      }
      if (shouldGuard) {
        standalonePendingRef.current = target;
        setStandaloneDialogOpen(true);
        return false;
      }
      if (typeof target === "string" && typeof window !== "undefined") {
        window.location.href = target;
      } else if (typeof target === "function") {
        target();
      }
      return true;
    },
    [context, shouldGuard]
  );

  return {
    isGuarded: context ? context.isGuarded : shouldGuard,
    dialogOpen: context ? context.dialogOpen : standaloneDialogOpen,
    guardedNavigate,
    confirmLeave: context ? context.confirmNavigation : confirmLeave,
    cancelLeave: context ? context.cancelNavigation : cancelLeave,
    // Helper to render dialog if not wrapped in provider
    renderDialog: () =>
      !context && standaloneDialogOpen ? (
        <UnsavedChangesDialog
          open={standaloneDialogOpen}
          onConfirm={confirmLeave}
          onCancel={cancelLeave}
          description={message}
        />
      ) : null,
  };
}
