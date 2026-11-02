import React from "react";
import { LogOut, Settings, User } from "lucide-react";
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
 * User profile dropdown with initials avatar, account info, settings, and logout.
 */
export function UserProfileDropdown({
  user,
  onLogout,
  onSettingsClick,
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
