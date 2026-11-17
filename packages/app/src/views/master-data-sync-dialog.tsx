import * as React from "react";
import { useState } from "react";
import { RefreshCw, CheckSquare, Square, ArrowDownRight } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Badge,
} from "@honocube/ui";
import type { MasterDataSyncDialogProps } from "@honocube/core";

export function MasterDataSyncDialog({
  open,
  onOpenChange,
  sourceCompany,
  subsidiaries = [],
  onSync,
  isSyncing = false,
  resourceName = "Master Data",
}: MasterDataSyncDialogProps): React.JSX.Element | null {
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>(
    subsidiaries.map((s) => s.id)
  );
  const [strategy, setStrategy] = useState<"overwrite" | "skip" | "clone">("overwrite");
  const [matchField, setMatchField] = useState<string>("code");

  const toggleTenant = (id: string) => {
    setSelectedTenantIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedTenantIds.length === subsidiaries.length) {
      setSelectedTenantIds([]);
    } else {
      setSelectedTenantIds(subsidiaries.map((s) => s.id));
    }
  };

  const handleExecuteSync = async () => {
    if (selectedTenantIds.length === 0) return;
    await onSync({
      targetTenantIds: selectedTenantIds,
      strategy,
      matchField,
    });
  };

  // SSR portal fallback
  if (typeof document === "undefined") {
    if (!open) return null;
    return (
      <div data-testid="master-data-sync-dialog" className="hidden">
        <span>{`Sync ${resourceName}`}</span>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="master-data-sync-dialog" className="sm:max-w-[520px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <RefreshCw className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Sync {resourceName} Downstream
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Propagate central master catalog data from{" "}
                <span className="font-medium text-foreground">
                  {sourceCompany?.name || "Holding Parent"}
                </span>{" "}
                to child subsidiary workspaces.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2 text-sm">
          {/* Target Subsidiaries Checklist */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">
                Target Subsidiaries ({selectedTenantIds.length}/{subsidiaries.length})
              </span>
              <button
                type="button"
                onClick={toggleAll}
                className="text-primary hover:underline cursor-pointer font-medium"
              >
                {selectedTenantIds.length === subsidiaries.length ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div className="max-h-40 overflow-y-auto rounded-md border border-border divide-y divide-border/60 bg-muted/20">
              {subsidiaries.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  No child subsidiaries available.
                </div>
              ) : (
                subsidiaries.map((sub) => {
                  const isChecked = selectedTenantIds.includes(sub.id);
                  return (
                    <div
                      key={sub.id}
                      onClick={() => toggleTenant(sub.id)}
                      className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isChecked ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium text-foreground text-xs">{sub.name}</span>
                        {sub.code && (
                          <span className="text-[10px] text-muted-foreground">({sub.code})</span>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] py-0 px-1">
                        {sub.type || "subsidiary"}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Conflict Resolution Strategy */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Conflict Resolution Strategy
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStrategy("overwrite")}
                className={`flex flex-col items-center justify-center p-2 rounded-md border text-xs transition-colors cursor-pointer ${
                  strategy === "overwrite"
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <span>Overwrite</span>
                <span className="text-[10px] opacity-75">Update matches</span>
              </button>
              <button
                type="button"
                onClick={() => setStrategy("skip")}
                className={`flex flex-col items-center justify-center p-2 rounded-md border text-xs transition-colors cursor-pointer ${
                  strategy === "skip"
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <span>Skip</span>
                <span className="text-[10px] opacity-75">Keep existing</span>
              </button>
              <button
                type="button"
                onClick={() => setStrategy("clone")}
                className={`flex flex-col items-center justify-center p-2 rounded-md border text-xs transition-colors cursor-pointer ${
                  strategy === "clone"
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <span>Clone</span>
                <span className="text-[10px] opacity-75">Always insert</span>
              </button>
            </div>
          </div>

          {/* Match Identifier */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Match Records By
            </label>
            <div className="flex gap-2">
              {["code", "slug", "name"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setMatchField(f)}
                  className={`px-3 py-1 text-xs rounded-md border transition-colors cursor-pointer capitalize ${
                    matchField === f
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSyncing}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleExecuteSync}
            disabled={isSyncing || selectedTenantIds.length === 0}
            className="gap-1.5"
          >
            <ArrowDownRight className="h-3.5 w-3.5" />
            <span>{isSyncing ? "Syncing..." : `Sync to ${selectedTenantIds.length} Subsidiaries`}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
