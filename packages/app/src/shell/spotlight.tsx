import React, { useEffect, useState } from "react";
import { Layers, Plus } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@honocube/ui";
import type { SpotlightProps } from "./types.js";

/**
 * Global Spotlight command palette (⌘K / Ctrl+K) enabling instant search,
 * collection navigation, and quick record creation shortcuts.
 */
export function Spotlight({
  app,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  inline = false,
  onSelect,
  onNavigate,
  className = "",
}: SpotlightProps): React.JSX.Element {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const setOpen = (open: boolean) => {
    if (!isControlled) {
      setInternalOpen(open);
    }
    controlledOnOpenChange?.(open);
  };

  // Global ⌘K / Ctrl+K keyboard shortcut listener
  useEffect(() => {
    if (inline) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(!isOpen);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, inline]);

  const collections = app.getCollections ? app.getCollections() : app.collections || [];

  const handleSelect = (action: {
    type: "navigate" | "create";
    collection?: string;
    href: string;
  }) => {
    if (!inline) {
      setOpen(false);
    }
    if (onSelect) {
      onSelect(action);
    } else if (onNavigate) {
      onNavigate(action.href);
    } else if (typeof window !== "undefined") {
      window.location.href = action.href;
    }
  };

  const commandContent = (
    <>
      <CommandInput
        data-testid="spotlight-input"
        placeholder="Type a command or search collections... (⌘K)"
      />
      <CommandList data-testid="spotlight-list">
        <CommandEmpty>No matching collections or actions found.</CommandEmpty>

        {/* Collections Navigation Group */}
        <CommandGroup heading="Collections">
          {collections.map((col) => {
            const label = col.label || col.name;
            const href = `/${col.name}`;

            return (
              <CommandItem
                key={`nav-${col.name}`}
                data-testid={`spotlight-item-${col.name}`}
                onSelect={() =>
                  handleSelect({ type: "navigate", collection: col.name, href })
                }
                className="cursor-pointer text-xs flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">{label}</span>
                </div>
                <CommandShortcut className="text-[10px]">Jump to</CommandShortcut>
              </CommandItem>
            );
          })}
        </CommandGroup>

        {/* Quick Actions Group */}
        <CommandGroup heading="Quick Create">
          {collections.map((col) => {
            const singular = col.singular || col.label || col.name;
            const href = `/${col.name}/new`;

            return (
              <CommandItem
                key={`create-${col.name}`}
                data-testid={`spotlight-create-${col.name}`}
                onSelect={() =>
                  handleSelect({ type: "create", collection: col.name, href })
                }
                className="cursor-pointer text-xs flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" />
                  <span className="font-medium text-foreground">{`New ${singular}`}</span>
                </div>
                <CommandShortcut className="text-[10px]">Create</CommandShortcut>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </>
  );

  if (inline) {
    return (
      <div className={`overflow-hidden rounded-md border border-border bg-popover ${className}`}>
        <Command>{commandContent}</Command>
      </div>
    );
  }

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={setOpen}
    >
      {commandContent}
    </CommandDialog>
  );
}
