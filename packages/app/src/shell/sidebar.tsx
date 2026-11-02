import React from "react";
import {
  Box,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from "lucide-react";
import {
  Button,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
  cn,
} from "@honocube/ui";
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
 * badge counts, and quick add shortcuts (canonical shadcn sidebar-07 layout).
 */
export function WorkspaceSidebar({
  app,
  pathname = "/",
  collapsed: propCollapsed,
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
  const { state } = useSidebar();
  const isCollapsed = propCollapsed !== undefined ? propCollapsed : state === "collapsed";

  const tenantSwitcherPosition =
    propTenantPos || app.layout?.tenantSwitcher || "sidebar";
  const userProfilePosition =
    propUserPos || app.layout?.userProfile || "sidebar";

  // 1. Resolve Navigation Groups
  let groups: NavigationGroup[] = [];

  if (app.navigation && app.navigation.length > 0) {
    groups = app.navigation;
  } else {
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
    <Sidebar
      collapsible="icon"
      data-testid="workspace-sidebar"
      className={cn(isCollapsed ? "w-16" : "w-64", className)}
    >
      {/* 1. Sidebar Header (canonical shadcn sidebar-07 team-switcher or Single Tenant App Title) */}
      <SidebarHeader>
        {headerSlot || (
          <div className="flex items-center justify-between w-full">
            {hasTenantsInSidebar ? (
              <div className="flex-1 min-w-0">
                <TenantSwitcher
                  app={app}
                  variant="sidebar"
                  collapsed={isCollapsed}
                  tenants={tenants}
                  activeTenantId={activeTenantId}
                  onTenantChange={onTenantChange}
                  onAddTenant={onAddTenant}
                />
              </div>
            ) : (
              <SidebarMenu className="flex-1 min-w-0">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    size="lg"
                    className="cursor-default hover:bg-transparent"
                  >
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold shadow-sm">
                      <Box className="size-4" />
                    </div>
                    {!isCollapsed && (
                      <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                        <span
                          data-testid="sidebar-app-title"
                          className="truncate font-semibold text-sidebar-foreground"
                        >
                          {app.title}
                        </span>
                      </div>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            )}

            {onCollapseChange && !isCollapsed && (
              <Button
                data-testid="sidebar-collapse-button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-sidebar-foreground/70 hover:text-sidebar-foreground shrink-0 ml-1"
                onClick={() => onCollapseChange(true)}
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </SidebarHeader>

      {/* 2. Sidebar Navigation Groups (canonical shadcn sidebar-07 nav-main) */}
      <SidebarContent>
        {groups.map((group, groupIdx) => (
          <SidebarGroup key={groupIdx}>
            {!isCollapsed && (
              <SidebarGroupLabel>{group.group}</SidebarGroupLabel>
            )}
            <SidebarMenu>
              {group.items.map((item, itemIdx) => {
                const isCol = isCollection(item);
                const name = isCol ? item.name : item.label;
                const label = item.label || (isCol ? item.name : "");
                const href = isCol ? `/${item.name}` : item.href;
                const badge = !isCol ? item.badge : undefined;

                const isActive =
                  pathname === href ||
                  (href !== "/" && pathname.startsWith(`${href}/`));

                return (
                  <SidebarMenuItem key={itemIdx}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={label}
                    >
                      <a
                        data-testid={`sidebar-link-${name}`}
                        href={href}
                        onClick={(e) => handleLinkClick(href, e)}
                        title={label}
                      >
                        <Layers className="size-4" />
                        {!isCollapsed && <span className="truncate">{label}</span>}
                      </a>
                    </SidebarMenuButton>

                    {/* Quick Create shortcut for collections */}
                    {!isCollapsed && isCol && (
                      <SidebarMenuAction
                        asChild
                        showOnHover
                        title={`New ${item.singular || label}`}
                      >
                        <a
                          data-testid={`sidebar-quick-create-${item.name}`}
                          href={`/${item.name}/new`}
                          onClick={(e) => handleLinkClick(`/${item.name}/new`, e)}
                        >
                          <Plus className="size-4" />
                          <span className="sr-only">New {item.singular || label}</span>
                        </a>
                      </SidebarMenuAction>
                    )}

                    {!isCollapsed && badge !== undefined && (
                      <SidebarMenuBadge>{badge}</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* 3. Sidebar Footer (canonical shadcn sidebar-07 nav-user) */}
      <SidebarFooter>
        {footerSlot || (
          <>
            {userProfilePosition === "sidebar" && currentUser && (
              <UserProfileDropdown
                variant="sidebar"
                collapsed={isCollapsed}
                user={currentUser}
                onLogout={onLogout}
                onSettingsClick={onSettingsClick}
              />
            )}
          </>
        )}

        {/* Collapsed expand toggle helper for manual control & tests */}
        {onCollapseChange && isCollapsed && (
          <Button
            data-testid="sidebar-expand-button"
            variant="ghost"
            size="icon"
            className="h-8 w-full text-sidebar-foreground/70 hover:text-sidebar-foreground justify-center mt-1"
            onClick={() => onCollapseChange(false)}
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>

      {/* 4. Rail for hover/click collapsing */}
      <SidebarRail />
    </Sidebar>
  );
}
