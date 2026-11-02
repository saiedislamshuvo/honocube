import React from "react";
import { ChevronsUpDown, LogOut, Settings, User } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
  cn,
} from "@honocube/ui";
import type { UserProfileDropdownProps } from "./types.js";

/**
 * User profile dropdown with initials avatar, account info, settings, and logout (canonical shadcn sidebar-07 nav-user style).
 */
export function UserProfileDropdown({
  user,
  onLogout,
  onSettingsClick,
  variant = "default",
  collapsed: propCollapsed,
  className = "",
}: UserProfileDropdownProps): React.JSX.Element | null {
  const { isMobile, state } = useSidebar();
  const collapsed = propCollapsed !== undefined ? propCollapsed : state === "collapsed";

  if (!user) {
    return null;
  }

  const initials =
    user.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  // 1. Sidebar Variant (official shadcn sidebar-07 nav-user)
  if (variant === "sidebar") {
    return (
      <SidebarMenu className={className}>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                data-testid="user-profile-trigger"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                title={user.name}
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                  <AvatarFallback className="rounded-lg bg-sidebar-primary/10 text-primary font-bold text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                    <span className="truncate font-semibold text-sidebar-foreground">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email || user.role || ""}
                    </span>
                  </div>
                )}
                {!collapsed && (
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                )}
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg text-xs"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                    <AvatarFallback className="rounded-lg bg-sidebar-primary/10 text-primary font-bold text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold text-foreground">{user.name}</span>
                    {user.email && (
                      <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                    )}
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  data-testid="user-profile-account"
                  onClick={onSettingsClick}
                  className="cursor-pointer gap-2 py-1.5 px-2"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>Profile & Account</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  data-testid="user-profile-settings"
                  onClick={onSettingsClick}
                  className="cursor-pointer gap-2 py-1.5 px-2"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span>Workspace Settings</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              {onLogout && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    data-testid="user-profile-logout"
                    onClick={onLogout}
                    className="cursor-pointer gap-2 text-destructive focus:text-destructive py-1.5 px-2"
                  >
                    <LogOut className="h-4 w-4 text-destructive" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  // 2. Default Topbar Variant (Header button)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          data-testid="user-profile-trigger"
          variant="ghost"
          size="sm"
          className={cn("h-8 gap-2 px-2 text-xs font-medium hover:bg-muted", className)}
        >
          <Avatar className="h-6 w-6">
            {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
            <AvatarFallback className="text-[11px] font-semibold bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden md:inline-block max-w-[120px] truncate font-medium">
            {user.name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 text-xs">
        <DropdownMenuLabel className="font-normal p-2">
          <div className="flex flex-col space-y-1">
            <p className="text-xs font-semibold leading-none text-foreground truncate">
              {user.name}
            </p>
            {user.email && (
              <p className="text-[11px] leading-none text-muted-foreground truncate">
                {user.email}
              </p>
            )}
            {user.role && (
              <span className="inline-flex items-center text-[10px] text-primary font-medium capitalize pt-0.5">
                {user.role}
              </span>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          data-testid="user-profile-account"
          onClick={onSettingsClick}
          className="cursor-pointer gap-2"
        >
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Profile & Account</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          data-testid="user-profile-settings"
          onClick={onSettingsClick}
          className="cursor-pointer gap-2"
        >
          <Settings className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Workspace Settings</span>
        </DropdownMenuItem>

        {onLogout && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid="user-profile-logout"
              onClick={onLogout}
              className="cursor-pointer gap-2 text-destructive focus:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5 text-destructive" />
              <span>Log out</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
