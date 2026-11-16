import * as React from "react";
import { useState } from "react";
import {
  UserCheck,
  Building2,
  User,
  FileText,
  AlertTriangle,
} from "lucide-react";
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@honocube/ui";
import type { ImpersonationDialogProps } from "@honocube/core";

export function ImpersonationDialog({
  open,
  onOpenChange,
  tenants = [],
  users = [],
  onImpersonate,
  isLoading = false,
}: ImpersonationDialogProps): React.JSX.Element | null {
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  if (!open) return null;

  const handleStart = async () => {
    if (!selectedTenantId && !selectedUserId) return;
    await onImpersonate({
      tenantId: selectedTenantId.trim() || undefined,
      userId: selectedUserId.trim() || undefined,
      reason: reason.trim() || undefined,
    });
    onOpenChange(false);
  };

  // SSR Fallback
  if (typeof document === "undefined") {
    return (
      <div data-testid="impersonation-dialog" className="hidden">
        <h2>Impersonate User or Tenant</h2>
        <button data-testid="confirm-impersonation-button">
          Start Impersonating
        </button>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="impersonation-dialog"
        className="sm:max-w-md flex flex-col gap-4"
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <UserCheck className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Impersonate User or Tenant
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Switch your active session context to troubleshoot permissions or verify reported tenant issues.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Form Body */}
        <div className="flex flex-col gap-3 py-1">
          {/* Tenant Target */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium flex items-center gap-1.5 text-foreground">
              <Building2 className="size-3.5 text-muted-foreground" />
              Target Organization / Tenant ID
            </label>
            {tenants.length > 0 ? (
              <select
                className="h-8 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
              >
                <option value="">-- None / Keep Current Tenant --</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.id})
                  </option>
                ))}
              </select>
            ) : (
              <Input
                placeholder="e.g. org_acme or tenant_123"
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="h-8 text-xs"
              />
            )}
          </div>

          {/* User Target */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium flex items-center gap-1.5 text-foreground">
              <User className="size-3.5 text-muted-foreground" />
              Target Employee / User
            </label>
            {users.length > 0 ? (
              <select
                className="h-8 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                <option value="">-- None / Entire Tenant --</option>
                {users.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.name} ({u.email || u.role || u.id})
                  </option>
                ))}
              </select>
            ) : (
              <Input
                placeholder="e.g. user_alice or support@example.com"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="h-8 text-xs"
              />
            )}
          </div>

          {/* Reason / Reference */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium flex items-center gap-1.5 text-foreground">
              <FileText className="size-3.5 text-muted-foreground" />
              Reason / Support Ticket Reference
            </label>
            <Input
              placeholder="e.g. Ticket #1042 - Billing inquiry verification"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          {/* Compliance & Audit Notice */}
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5 mt-1">
            <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold">Audit Notice: </span>
              All actions and mutations made during this session will be logged with your superadmin identity for compliance and security auditing.
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            data-testid="confirm-impersonation-button"
            size="sm"
            onClick={handleStart}
            disabled={(!selectedTenantId && !selectedUserId) || isLoading}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isLoading ? "Starting..." : "Start Impersonating"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
