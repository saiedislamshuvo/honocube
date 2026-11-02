import React, { useState } from "react";
import { cn } from "@honocube/ui";
import { WorkspaceSidebar } from "./sidebar.js";
import { WorkspaceTopbar } from "./topbar.js";
import { Spotlight } from "./spotlight.js";
import type { WorkspaceShellProps } from "./types.js";

/**
 * Root Next.js application workspace shell layout (`app/(workspace)/layout.tsx`)
 * composing the sidebar navigation, top header bar, breadcrumbs, tenant switcher,
 * user profile, and Spotlight command palette.
 */
export function WorkspaceShell({
  app,
  children,
  pathname = "/",
  tenants,
  activeTenantId,
  onTenantChange,
  currentUser,
  onLogout,
  theme,
  onThemeChange,
  collapsed: controlledCollapsed,
  onCollapseChange: controlledOnCollapseChange,
  onNavigate,
  breadcrumbs,
  className = "",
}: WorkspaceShellProps): React.JSX.Element {
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
    <div
      data-testid="workspace-shell"
      className={cn(
        "flex h-screen w-full overflow-hidden bg-background text-foreground antialiased",
        className
      )}
    >
      {/* 1. Left Sidebar Navigation */}
      <WorkspaceSidebar
        app={app}
        pathname={pathname}
        collapsed={isCollapsed}
        onCollapseChange={setCollapsed}
        onNavigate={onNavigate}
      />

      {/* 2. Main Viewport (Topbar + Page View) */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <WorkspaceTopbar
          app={app}
          pathname={pathname}
          tenants={tenants}
          activeTenantId={activeTenantId}
          onTenantChange={onTenantChange}
          currentUser={currentUser}
          onLogout={onLogout}
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
      </div>

      {/* 3. Global Spotlight ⌘K Command Palette */}
      <Spotlight
        app={app}
        open={spotlightOpen}
        onOpenChange={setSpotlightOpen}
        onNavigate={onNavigate}
      />
    </div>
  );
}
