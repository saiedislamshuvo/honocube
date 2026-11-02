import type React from "react";
import type { AppInstance } from "../types/app.js";

export interface ShellTenant {
  id: string;
  name: string;
  logo?: string;
  plan?: string;
}

export interface ShellUser {
  name: string;
  email?: string;
  avatar?: string;
  role?: string;
}

export interface BreadcrumbItemData {
  label: string;
  href?: string;
  isCurrent?: boolean;
}

export interface WorkspaceBreadcrumbsProps {
  app?: AppInstance;
  pathname?: string;
  items?: BreadcrumbItemData[];
  homeLabel?: string;
  onNavigate?: (href: string) => void;
  className?: string;
}

export interface TenantSwitcherProps {
  tenants?: ShellTenant[];
  activeTenantId?: string;
  onTenantChange?: (tenantId: string) => void;
  onAddTenant?: () => void;
  className?: string;
}

export interface UserProfileDropdownProps {
  user?: ShellUser;
  onLogout?: () => void;
  onSettingsClick?: () => void;
  className?: string;
}

export interface SpotlightProps {
  app: AppInstance;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  inline?: boolean;
  onSelect?: (action: {
    type: "navigate" | "create";
    collection?: string;
    href: string;
  }) => void;
  onNavigate?: (href: string) => void;
  className?: string;
}

export interface WorkspaceSidebarProps {
  app: AppInstance;
  pathname?: string;
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  onNavigate?: (href: string) => void;
  headerSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
  className?: string;
}

export interface WorkspaceTopbarProps {
  app: AppInstance;
  pathname?: string;
  tenants?: ShellTenant[];
  activeTenantId?: string;
  onTenantChange?: (tenantId: string) => void;
  currentUser?: ShellUser;
  onLogout?: () => void;
  theme?: "light" | "dark" | "system";
  onThemeChange?: (theme: "light" | "dark") => void;
  onSpotlightOpen?: () => void;
  onSidebarToggle?: () => void;
  onNavigate?: (href: string) => void;
  breadcrumbs?: BreadcrumbItemData[];
  extraSlot?: React.ReactNode;
  className?: string;
}

export interface WorkspaceShellProps {
  app: AppInstance;
  children: React.ReactNode;
  pathname?: string;
  tenants?: ShellTenant[];
  activeTenantId?: string;
  onTenantChange?: (tenantId: string) => void;
  currentUser?: ShellUser;
  onLogout?: () => void;
  theme?: "light" | "dark" | "system";
  onThemeChange?: (theme: "light" | "dark") => void;
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  onNavigate?: (href: string) => void;
  breadcrumbs?: BreadcrumbItemData[];
  className?: string;
}
