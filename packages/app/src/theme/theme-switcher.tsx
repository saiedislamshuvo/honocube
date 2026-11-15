import React from "react";
import { Sun, Moon, Laptop, Palette, Check } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@honocube/ui";
import { useTheme } from "./theme-provider.js";
import type { ColorPreset } from "../types/app.js";

const PRESETS: Array<{ id: ColorPreset; label: string; color: string }> = [
  { id: "zinc", label: "Zinc", color: "bg-zinc-500" },
  { id: "blue", label: "Blue", color: "bg-blue-600" },
  { id: "emerald", label: "Emerald", color: "bg-emerald-600" },
  { id: "violet", label: "Violet", color: "bg-violet-600" },
  { id: "orange", label: "Orange", color: "bg-orange-600" },
  { id: "rose", label: "Rose", color: "bg-rose-600" },
];

export function ThemeSwitcher({
  showPresets = true,
}: {
  showPresets?: boolean;
}): React.JSX.Element {
  const { theme, setTheme, preset, setPreset, resolvedTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          data-testid="theme-switcher-button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="Theme settings"
        >
          {resolvedTheme === "dark" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Appearance
        </DropdownMenuLabel>
        <DropdownMenuItem
          data-testid="theme-option-light"
          onClick={() => setTheme("light")}
          className="gap-2 cursor-pointer"
        >
          <Sun className="h-4 w-4" />
          <span className="flex-1">Light</span>
          {theme === "light" && <Check className="h-3.5 w-3.5" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="theme-option-dark"
          onClick={() => setTheme("dark")}
          className="gap-2 cursor-pointer"
        >
          <Moon className="h-4 w-4" />
          <span className="flex-1">Dark</span>
          {theme === "dark" && <Check className="h-3.5 w-3.5" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="theme-option-system"
          onClick={() => setTheme("system")}
          className="gap-2 cursor-pointer"
        >
          <Laptop className="h-4 w-4" />
          <span className="flex-1">System</span>
          {theme === "system" && <Check className="h-3.5 w-3.5" />}
        </DropdownMenuItem>

        {showPresets && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5" />
              <span>Color Accent</span>
            </DropdownMenuLabel>
            <div className="grid grid-cols-2 gap-1 p-1">
              {PRESETS.map((p) => {
                const isActive = preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-testid={`preset-option-${p.id}`}
                    onClick={() => setPreset(p.id)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors hover:bg-muted text-left ${
                      isActive ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${p.color}`} />
                    <span className="truncate">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
