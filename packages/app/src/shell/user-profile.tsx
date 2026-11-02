import React from "react";
import { ChevronsUpDown, LogOut, Settings, User } from "lucide-react";
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
import type { UserProfileDropdownProps } from "./types.js";

/**
 * User profile dropdown with initials avatar, account info, settings, and logout (shadcn sidebar-07 nav-user style).
 */
export function UserProfileDropdown({
  user,
  onLogout,
  onSettingsClick,
  variant = "default",
  collapsed = false,
  className = "",
}: UserProfileDropdownProps): React.JSX.Element | null {
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            data-testid="user-profile-trigger"
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              collapsed ? "justify-center p-0 h-9 w-9" : "h-11",
              className
            )}
            title={user.name}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">
              {initials}
            </div>
            {!collapsed && (
              <div className="grid flex-1 text-left text-xs leading-tight min-w-0">
                <span className="truncate font-semibold text-foreground">{user.name}</span>
                <span className="truncate text-[10px] text-muted-foreground">
                  {user.email || user.role || ""}
                </span>
              </div>
            )}
            {!collapsed && (
              <ChevronsUpDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-60" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={collapsed ? "start" : "end"}
          side={collapsed ? "right" : "top"}
          className="w-56 text-xs mb-1 shadow-md"
        >
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
            className="cursor-pointer gap-2 py-1.5 px-2"
          >
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Profile & Account</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            data-testid="user-profile-settings"
            onClick={onSettingsClick}
            className="cursor-pointer gap-2 py-1.5 px-2"
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
                className="cursor-pointer gap-2 text-destructive focus:text-destructive py-1.5 px-2"
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
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
            {initials}
          </div>
          <span className="hidden md:inline-block max-w-[120px] truncate">
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
