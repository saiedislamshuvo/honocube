import * as React from "react";
import { useState } from "react";
import { ShieldAlert, LogOut } from "lucide-react";
import { Button, Badge, cn } from "@honocube/ui";
import {
  formatImpersonationTitle,
  type ImpersonationBannerProps,
} from "@honocube/core";

/**
 * High-visibility warning banner displayed at the top of the workspace
 * whenever a superadmin is actively impersonating another user or tenant.
 */
export function ImpersonationBanner({
  session,
  onStopImpersonation,
  className = "",
}: ImpersonationBannerProps): React.JSX.Element | null {
  const [isStopping, setIsStopping] = useState(false);

  if (!session) return null;

  const handleStop = async () => {
    if (!onStopImpersonation) return;
    setIsStopping(true);
    try {
      await onStopImpersonation();
    } finally {
      setIsStopping(false);
    }
  };

  const title = formatImpersonationTitle(session);
  const adminName = session.originalUser?.name || "Superadmin";

  return (
    <div
      data-testid="impersonation-banner"
      className={cn(
        "relative z-50 flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-950 dark:text-amber-200 text-xs font-medium shadow-sm transition-all",
        className
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="flex size-6 items-center justify-center rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-400 shrink-0">
          <ShieldAlert className="size-4" />
        </div>

        <div className="flex flex-wrap items-center gap-2 truncate">
          <span className="font-semibold text-amber-900 dark:text-amber-100">
            Impersonation Active:
          </span>
          <span className="truncate">{title}</span>

          <Badge
            variant="outline"
            className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-300 text-[10px] px-1.5 py-0 h-4"
          >
            {`Real Admin: ${adminName}`}
          </Badge>

          {session.reason && (
            <span className="hidden sm:inline text-amber-800/80 dark:text-amber-300/80 text-[11px] truncate">
              {`(${session.reason})`}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          type="button"
          data-testid="stop-impersonation-button"
          variant="outline"
          size="sm"
          onClick={handleStop}
          disabled={isStopping}
          className="h-7 text-xs border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-200 hover:bg-amber-500/20 shadow-none"
        >
          <LogOut className="mr-1.5 size-3.5" />
          {isStopping ? "Exiting..." : "Exit Impersonation"}
        </Button>
      </div>
    </div>
  );
}
