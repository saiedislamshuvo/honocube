import React from "react";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from "@honocube/ui";
import type { TenantSwitcherProps } from "./types.js";

/**
 * Multi-tenant company/workspace switcher dropdown for topbar and sidebar.
 */
export function TenantSwitcher({
  tenants = [],
  activeTenantId,
  onTenantChange,
  onAddTenant,
  className = "",
}: TenantSwitcherProps): React.JSX.Element | null {
  if (tenants.length === 0) {
    return null;
  }

  const activeTenant =
    tenants.find((t) => t.id === activeTenantId) || tenants[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          data-testid="tenant-switcher-trigger"
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-2 px-2.5 text-xs font-medium justify-between min-w-[140px] max-w-[220px]",
            className
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
              <Building2 className="h-3 w-3" />
            </div>
            <span className="truncate">{activeTenant?.name || "Select Workspace"}</span>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 text-xs">
        <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground">
          Workspaces
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tenants.map((tenant) => {
          const isActive = tenant.id === activeTenant?.id;

          return (
            <DropdownMenuItem
              key={tenant.id}
              data-testid={`tenant-item-${tenant.id}`}
              onClick={() => onTenantChange?.(tenant.id)}
              className="flex items-center justify-between cursor-pointer py-1.5"
            >
              <div className="flex items-center gap-2 truncate">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted font-medium text-[10px]">
                  {tenant.name.charAt(0).toUpperCase()}
                </div>
                <span className="truncate font-medium">{tenant.name}</span>
              </div>
              {isActive && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
            </DropdownMenuItem>
          );
        })}

        {onAddTenant && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid="add-tenant-action"
              onClick={onAddTenant}
              className="gap-2 cursor-pointer text-muted-foreground focus:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Workspace</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
