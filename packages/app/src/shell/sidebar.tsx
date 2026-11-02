import React from "react";
import {
  Box,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from "lucide-react";
import { Badge, Button, cn } from "@honocube/ui";
import type { NavigationGroup, NavigationItem } from "../types/app.js";
import type { Collection } from "../types/collection.js";
import { TenantSwitcher } from "./tenant-switcher.js";
import { UserProfileDropdown } from "./user-profile.js";
import type { WorkspaceSidebarProps } from "./types.js";

function isCollection(item: NavigationItem): item is Collection<any> {
  return typeof item === "object" && item !== null && "_isCollection" in item;
}

/**
 * Collapsible left navigation sidebar organized by navigation groups with active state,
 * badge counts, and quick add shortcuts (official shadcn sidebar-07 layout).
 */
export function WorkspaceSidebar({
  app,
  pathname = "/",
  collapsed = false,
  onCollapseChange,
  onNavigate,
  tenants,
  activeTenantId,
  onTenantChange,
  onAddTenant,
  tenantSwitcherPosition: propTenantPos,
  currentUser,
  onLogout,
  onSettingsClick,
  userProfilePosition: propUserPos,
  headerSlot,
  footerSlot,
  className = "",
}: WorkspaceSidebarProps): React.JSX.Element {
  const tenantSwitcherPosition =
    propTenantPos || app.layout?.tenantSwitcher || "sidebar";
  const userProfilePosition =
    propUserPos || app.layout?.userProfile || "sidebar";

  // 1. Resolve Navigation Groups
  let groups: NavigationGroup[] = [];

  if (app.navigation && app.navigation.length > 0) {
    groups = app.navigation;
  } else {
    // Auto-group collections by group field or fallback
    const collections = app.getCollections ? app.getCollections() : app.collections || [];
    const groupMap = new Map<string, Collection<any>[]>();

    for (const col of collections) {
      const gName = col.group || "Collections";
      if (!groupMap.has(gName)) {
        groupMap.set(gName, []);
      }
      groupMap.get(gName)?.push(col);
    }

    groups = Array.from(groupMap.entries()).map(([group, items]) => ({
      group,
      items,
    }));
  }

  const handleLinkClick = (href: string, e: React.MouseEvent) => {
    if (onNavigate) {
      e.preventDefault();
      onNavigate(href);
    }
  };

  const hasTenantsInSidebar =
    tenantSwitcherPosition === "sidebar" && Boolean(tenants && tenants.length > 0);

  return (
    <aside
      data-testid="workspace-sidebar"
      className={cn(
        "flex flex-col border-r border-border bg-card transition-all duration-300 h-full select-none",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* 1. Sidebar Header (shadcn sidebar-07 team-switcher or Brand Title) */}
      <div
        className={cn(
          "flex h-14 items-center justify-between border-b border-border",
          collapsed ? "px-2 justify-center" : "px-3"
        )}
      >
        {headerSlot || (
          <>
            {hasTenantsInSidebar ? (
              <div className="flex-1 min-w-0">
                <TenantSwitcher
                  app={app}
                  variant="sidebar"
                  collapsed={collapsed}
                  tenants={tenants}
                  activeTenantId={activeTenantId}
                  onTenantChange={onTenantChange}
                  onAddTenant={onAddTenant}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2.5 truncate">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-sm">
                  <Box className="h-4 w-4" />
                </div>
                {!collapsed && (
                  <span
                    data-testid="sidebar-app-title"
                    className="font-semibold text-sm tracking-tight text-foreground truncate"
                  >
                    {app.title}
                  </span>
                )}
              </div>
            )}
          </>
        )}

        {onCollapseChange && !collapsed && (
          <Button
            data-testid="sidebar-collapse-button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0 ml-1"
            onClick={() => onCollapseChange(!collapsed)}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* 2. Navigation Groups & Links (shadcn sidebar-07 nav-main) */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
        {groups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-1">
            {!collapsed && (
              <h3 className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                {group.group}
              </h3>
            )}

            <div className="space-y-0.5">
              {group.items.map((item, itemIdx) => {
                const isCol = isCollection(item);
                const name = isCol ? item.name : item.label;
                const label = item.label || (isCol ? item.name : "");
                const href = isCol ? `/${item.name}` : item.href;
                const badge = !isCol ? item.badge : undefined;

                // Active check: exact match or child route
                const isActive =
                  pathname === href ||
                  (href !== "/" && pathname.startsWith(`${href}/`));

                return (
                  <div
                    key={itemIdx}
                    className="group relative flex items-center justify-between rounded-md"
                  >
                    <a
                      data-testid={`sidebar-link-${name}`}
                      href={href}
                      onClick={(e) => handleLinkClick(href, e)}
                      className={cn(
                        "flex flex-1 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        collapsed && "justify-center px-0"
                      )}
                      title={label}
                    >
                      <Layers className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <span className="truncate flex-1">{label}</span>
                      )}
                    </a>

                    {/* Quick Add Button on Hover (for Collections) */}
                    {!collapsed && isCol && (
                      <a
                        data-testid={`sidebar-quick-create-${item.name}`}
                        href={`/${item.name}/new`}
                        onClick={(e) => handleLinkClick(`/${item.name}/new`, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 mr-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted"
                        title={`New ${item.singular || label}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </a>
                    )}

                    {!collapsed && badge !== undefined && (
                      <Badge
                        variant="secondary"
                        className="ml-auto mr-1.5 h-4 px-1 text-[10px] font-semibold"
                      >
                        {badge}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 3. Sidebar Footer (shadcn sidebar-07 nav-user & expand button) */}
      <div className="border-t border-border p-2 space-y-1">
        {footerSlot || (
          <>
            {userProfilePosition === "sidebar" && currentUser && (
              <UserProfileDropdown
                variant="sidebar"
                collapsed={collapsed}
                user={currentUser}
                onLogout={onLogout}
                onSettingsClick={onSettingsClick}
              />
            )}
          </>
        )}

        {onCollapseChange && collapsed && (
          <Button
            data-testid="sidebar-expand-button"
            variant="ghost"
            size="icon"
            className="h-8 w-full text-muted-foreground hover:text-foreground justify-center"
            onClick={() => onCollapseChange(false)}
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        )}
      </div>
    </aside>
  );
}
