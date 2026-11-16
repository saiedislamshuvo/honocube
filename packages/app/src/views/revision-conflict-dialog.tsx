import React, { useMemo } from "react";
import { AlertTriangle, RefreshCw, ArrowRight, X, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@honocube/ui";
import type { RevisionConflict, ConflictResolutionAction } from "@honocube/core";

export interface RevisionConflictDialogProps<T = Record<string, unknown>> {
  /**
   * The active revision conflict details.
   */
  conflict?: RevisionConflict<T> | null;

  /**
   * Whether the conflict dialog is open.
   */
  open?: boolean;

  /**
   * Callback to resolve the conflict via a chosen strategy.
   */
  onResolve?: (action: ConflictResolutionAction, mergedValues?: Partial<T> | Record<string, any>) => void | Promise<void>;

  /**
   * Callback when the dialog is dismissed/cancelled.
   */
  onCancel?: () => void;

  /**
   * Optional custom field labels mapping (field name -> display label).
   */
  fieldLabels?: Record<string, string>;
}

export function RevisionConflictDialog({
  conflict,
  open = true,
  onResolve,
  onCancel,
  fieldLabels = {},
}: RevisionConflictDialogProps): React.JSX.Element | null {
  const isOpen = Boolean(open && conflict);

  const diffEntries = useMemo(() => {
    if (!conflict) return [];

    const client = conflict.clientRecord || {};
    const server = conflict.serverRecord || {};
    const allKeys = Array.from(new Set([...Object.keys(client), ...Object.keys(server)]));

    // Exclude internal timestamp and version keys from noise in the diff
    const excludedKeys = new Set(["createdAt", "created_at", "updatedAt", "updated_at"]);

    return allKeys
      .filter((k) => !excludedKeys.has(k))
      .map((key) => {
        const clientVal = client[key];
        const serverVal = server[key];
        const isDifferent = JSON.stringify(clientVal) !== JSON.stringify(serverVal);

        const label = fieldLabels[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");
        return {
          key,
          label,
          clientVal: clientVal !== undefined ? String(clientVal) : "(empty)",
          serverVal: serverVal !== undefined ? String(serverVal) : "(empty)",
          isDifferent,
        };
      })
      .filter((entry) => entry.isDifferent || entry.key === "version" || entry.key === "_version");
  }, [conflict, fieldLabels]);

  if (!isOpen) return null;

  // SSR Static Fallback for unit testing and server rendering environments
  if (typeof document === "undefined") {
    return (
      <div data-testid="revision-conflict-dialog" className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="fixed left-[50%] top-[50%] z-50 max-w-2xl translate-x-[-50%] translate-y-[-50%] p-6 border rounded-lg bg-card shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="text-lg font-semibold">Revision Conflict Detected</h3>
            <Badge variant="destructive">Conflict</Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            This record was modified by another transaction while you were editing it.
          </p>
          <div className="border rounded-md max-h-60 overflow-y-auto mb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Your Value</TableHead>
                  <TableHead>Server Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diffEntries.map((row) => (
                  <TableRow key={row.key} className={row.isDifferent ? "bg-muted/40 font-medium" : ""}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell className={row.isDifferent ? "text-amber-600 dark:text-amber-400" : ""}>
                      {row.clientVal}
                    </TableCell>
                    <TableCell className={row.isDifferent ? "text-blue-600 dark:text-blue-400" : ""}>
                      {row.serverVal}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => onResolve?.("reload")}>
              Reload Server
            </Button>
            <Button onClick={() => onResolve?.("overwrite")}>Overwrite Server</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onCancel?.()}>
      <DialogContent data-testid="revision-conflict-dialog" className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <span>Revision Conflict Detected</span>
                <Badge variant="destructive" className="text-xs">
                  OCC Conflict
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-sm mt-1">
                Another user or background process modified this record while you were editing it.
                Review the changes below and select a resolution strategy.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="my-2 border rounded-md max-h-72 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/3">Field</TableHead>
                <TableHead className="w-1/3">Your Changes</TableHead>
                <TableHead className="w-1/3">Server Version</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diffEntries.length > 0 ? (
                diffEntries.map((entry) => (
                  <TableRow
                    key={entry.key}
                    className={entry.isDifferent ? "bg-amber-500/5 font-medium" : ""}
                  >
                    <TableCell className="font-semibold text-xs">{entry.label}</TableCell>
                    <TableCell className={entry.isDifferent ? "text-amber-600 dark:text-amber-400" : ""}>
                      {entry.clientVal}
                    </TableCell>
                    <TableCell className={entry.isDifferent ? "text-blue-600 dark:text-blue-400 font-semibold" : ""}>
                      {entry.serverVal}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                    Version incremented with no conflicting field changes.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="gap-1 text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span>Cancel</span>
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onResolve?.("reload")}
              className="gap-1"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Reload Server Version</span>
            </Button>

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => onResolve?.("overwrite")}
              className="gap-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              <ArrowRight className="h-4 w-4" />
              <span>Overwrite With My Changes</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
