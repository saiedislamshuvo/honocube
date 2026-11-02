import React from "react";
import { Menu, Moon, Search, Sun } from "lucide-react";
import { Button, cn } from "@honocube/ui";
import { WorkspaceBreadcrumbs } from "./breadcrumbs.js";
import { TenantSwitcher } from "./tenant-switcher.js";
import { UserProfileDropdown } from "./user-profile.js";
import type { WorkspaceTopbarProps } from "./types.js";

/**
 * Top sticky navigation bar housing breadcrumbs, spotlight trigger, tenant switcher,
 * theme toggle, and user profile menu.
 */
export function WorkspaceTopbar({
  app,
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
  onSpotlightOpen,
  onSidebarToggle,
  onNavigate,
  breadcrumbs,
  extraSlot,
  className = "",
}: WorkspaceTopbarProps): React.JSX.Element {
  const tenantSwitcherPosition =
    propTenantPos || app.layout?.tenantSwitcher || "sidebar";
  const userProfilePosition =
    propUserPos || app.layout?.userProfile || "sidebar";

  return (
    <header
      data-testid="workspace-topbar"
      className={cn(
        "sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6",
        className
      )}
    >
      {/* Left: Sidebar Toggle + Breadcrumbs */}
      <div className="flex items-center gap-3 truncate">
        {onSidebarToggle && (
          <Button
            data-testid="sidebar-toggle-button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
            onClick={onSidebarToggle}
            aria-label="Toggle sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>
        )}

        <WorkspaceBreadcrumbs
          app={app}
          pathname={pathname}
          items={breadcrumbs}
          onNavigate={onNavigate}
        />
      </div>

      {/* Right: Spotlight + Header Placed Elements + Theme Toggle */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Spotlight Trigger Button */}
        {onSpotlightOpen && (
          <Button
            data-testid="spotlight-trigger"
            variant="outline"
            size="sm"
            onClick={onSpotlightOpen}
            className="h-8 gap-2 px-2.5 sm:px-3 text-xs text-muted-foreground hover:text-foreground"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Search...</span>
            <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </Button>
        )}

        {/* Tenant Switcher (when placed in Header) */}
        {tenantSwitcherPosition === "header" && tenants && tenants.length > 0 && (
          <TenantSwitcher
            app={app}
            variant="default"
            tenants={tenants}
            activeTenantId={activeTenantId}
            onTenantChange={onTenantChange}
            onAddTenant={onAddTenant}
          />
        )}

        {/* Dark/Light Theme Toggle */}
        {onThemeChange && (
          <Button
            data-testid="theme-toggle-button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        )}

        {/* User Profile Menu (when placed in Header) */}
        {userProfilePosition === "header" && currentUser && (
          <UserProfileDropdown
            variant="default"
            user={currentUser}
            onLogout={onLogout}
            onSettingsClick={onSettingsClick}
          />
        )}

        {extraSlot}
      </div>
    </header>
  );
}
