import React, { useState } from "react";
import { SidebarInset, SidebarProvider, Toaster, cn } from "@honocube/ui";
import { WorkspaceSidebar } from "./sidebar.js";
import { WorkspaceTopbar } from "./topbar.js";
import { Spotlight } from "./spotlight.js";
import type { WorkspaceShellProps } from "./types.js";

/**
 * Root Next.js application workspace shell layout (`app/(workspace)/layout.tsx`)
 * composing the canonical shadcn sidebar-07 layout:
 * - SidebarProvider (root context + ⌘B keyboard shortcut + cookie persistence)
 * - WorkspaceSidebar (official collapsible="icon" Sidebar)
 * - SidebarInset (main content viewport)
 * - WorkspaceTopbar (with canonical SidebarTrigger, Breadcrumbs, Spotlight, Tenant Switcher, Profile)
 */
export function WorkspaceShell({
  app,
  children,
  pathname = "/",
  tenants,
  activeTenantId,
  onTenantChange,
  onAddTenant,
  tenantSwitcherPosition: propTenantPos,
  currentUser,
  onLogout,
  onSettingsClick,
  userProfilePosition: propUserPos,
  theme,
  onThemeChange,
  collapsed: controlledCollapsed,
  onCollapseChange: controlledOnCollapseChange,
  onNavigate,
  breadcrumbs,
  className = "",
}: WorkspaceShellProps): React.JSX.Element {
  const tenantSwitcherPosition =
    propTenantPos || app.layout?.tenantSwitcher || "sidebar";
  const userProfilePosition =
    propUserPos || app.layout?.userProfile || "sidebar";

  // Sidebar collapsed state (controlled or uncontrolled)
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isControlled = controlledCollapsed !== undefined;
  const isCollapsed = isControlled ? controlledCollapsed : internalCollapsed;

  const setCollapsed = (val: boolean) => {
    if (!isControlled) {
      setInternalCollapsed(val);
    }
    controlledOnCollapseChange?.(val);
  };

  // Spotlight command palette open state
  const [spotlightOpen, setSpotlightOpen] = useState(false);

  return (
    <SidebarProvider
      open={!isCollapsed}
      onOpenChange={(open) => setCollapsed(!open)}
    >
      <div
        data-testid="workspace-shell"
        className={cn(
          "flex h-screen w-full overflow-hidden bg-background text-foreground antialiased",
          className
        )}
      >
        {/* 1. Left Sidebar Navigation (canonical shadcn sidebar-07) */}
        <WorkspaceSidebar
          app={app}
          pathname={pathname}
          collapsed={isCollapsed}
          onCollapseChange={setCollapsed}
          onNavigate={onNavigate}
          tenants={tenants}
          activeTenantId={activeTenantId}
          onTenantChange={onTenantChange}
          onAddTenant={onAddTenant}
          tenantSwitcherPosition={tenantSwitcherPosition}
          currentUser={currentUser}
          onLogout={onLogout}
          onSettingsClick={onSettingsClick}
          userProfilePosition={userProfilePosition}
        />

        {/* 2. Main Viewport (SidebarInset + Topbar + Page View) */}
        <SidebarInset className="flex flex-1 flex-col overflow-hidden">
          <WorkspaceTopbar
            app={app}
            pathname={pathname}
            tenants={tenants}
            activeTenantId={activeTenantId}
            onTenantChange={onTenantChange}
            onAddTenant={onAddTenant}
            tenantSwitcherPosition={tenantSwitcherPosition}
            currentUser={currentUser}
            onLogout={onLogout}
            onSettingsClick={onSettingsClick}
            userProfilePosition={userProfilePosition}
            theme={theme}
            onThemeChange={onThemeChange}
            onSpotlightOpen={() => setSpotlightOpen(true)}
            onSidebarToggle={() => setCollapsed(!isCollapsed)}
            onNavigate={onNavigate}
            breadcrumbs={breadcrumbs}
          />

          {/* Content Outlet */}
          <main
            data-testid="workspace-main"
            className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8"
          >
            {children}
          </main>
        </SidebarInset>

        {/* 3. Global Spotlight ⌘K Command Palette */}
        <Spotlight
          app={app}
          open={spotlightOpen}
          onOpenChange={setSpotlightOpen}
          onNavigate={onNavigate}
        />

        {/* 4. Global Toast Notifications */}
        <Toaster position="top-right" richColors />
      </div>
    </SidebarProvider>
  );
}
