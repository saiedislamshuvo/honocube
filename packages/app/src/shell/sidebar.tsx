import React from "react";
import {
  Box,
  Layers,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
  cn,
} from "@honocube/ui";
import type {
  NavigationGroup,
  NavigationItem,
  Collection,
  WorkspaceSidebarProps,
} from "@honocube/core";
import { applyNavigationMenu } from "@honocube/core";
import { TenantSwitcher } from "./tenant-switcher.js";
import { UserProfileDropdown } from "./user-profile.js";

function isCollection(item: NavigationItem): item is Collection<any> {
  return typeof item === "object" && item !== null && "_isCollection" in item;
}

/**
 * Collapsible left navigation sidebar organized by navigation groups with active state
 * and badge counts (canonical shadcn sidebar-07 layout).
 * Note: Sidebar toggle trigger lives in WorkspaceTopbar beside the breadcrumbs.
 */
export function WorkspaceSidebar({
  app,
  pathname = "/",
  collapsed: propCollapsed,
  onCollapseChange: _onCollapseChange,
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
  menuConfig,
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

  if (menuConfig) {
    groups = applyNavigationMenu(
      app.collections || [],
      menuConfig,
      currentUser
        ? { roles: (currentUser as any).roles, role: (currentUser as any).role }
        : undefined,
      activeTenantId
    );
  } else {
    const nav = app.getNavigation ? app.getNavigation() : app.navigation;
    if (Array.isArray(nav) && nav.length > 0) {
      groups = nav;
    } else if (!app.navigation && !app.getNavigation) {
      const collections = app.collections || [];
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
  }

  const handleLinkClick = (href: string, e: React.MouseEvent) => {
    if (href.startsWith("http")) {
      return;
    }
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
          <>
            {hasTenantsInSidebar ? (
              <TenantSwitcher
                app={app}
                variant="sidebar"
                collapsed={isCollapsed}
                tenants={tenants}
                activeTenantId={activeTenantId}
                onTenantChange={onTenantChange}
                onAddTenant={onAddTenant}
              />
            ) : (
              <SidebarMenu>
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
          </>
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
                const isExternal = href.startsWith("http");

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
                        target={isExternal ? "_blank" : undefined}
                        rel={isExternal ? "noopener noreferrer" : undefined}
                        onClick={(e) => handleLinkClick(href, e)}
                        title={label}
                      >
                        <Layers className="size-4" />
                        {!isCollapsed && <span className="truncate">{label}</span>}
                      </a>
                    </SidebarMenuButton>

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
      </SidebarFooter>

      {/* 4. Rail for hover/click collapsing */}
      <SidebarRail />
    </Sidebar>
  );
}
