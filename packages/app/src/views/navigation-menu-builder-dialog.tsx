import * as React from "react";
import { useState, useEffect } from "react";
import {
  Menu,
  Save,
  RotateCcw,
  ExternalLink,
  Link as LinkIcon,
  Database,
  Eye,
} from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Badge,
} from "@honocube/ui";
import {
  buildDefaultNavigation,
  applyNavigationMenu,
  type NavigationMenuConfig,
  type NavigationMenuBuilderDialogProps,
} from "@honocube/core";
import { SidebarCustomizer } from "./sidebar-customizer.js";

export function NavigationMenuBuilderDialog({
  open,
  onOpenChange,
  availableCollections = [],
  initialConfig,
  onSaveConfig,
  isSaving = false,
}: NavigationMenuBuilderDialogProps): React.JSX.Element | null {
  const [config, setConfig] = useState<NavigationMenuConfig>(() => {
    return initialConfig || buildDefaultNavigation(availableCollections);
  });

  // Sync with initialConfig if changed externally
  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
    } else {
      setConfig(buildDefaultNavigation(availableCollections));
    }
  }, [initialConfig, availableCollections, open]);

  if (!open) return null;

  const handleReset = () => {
    setConfig(buildDefaultNavigation(availableCollections));
  };

  const handleSave = async () => {
    if (onSaveConfig) {
      await onSaveConfig(config);
    }
    onOpenChange(false);
  };

  // Preview generated runtime groups
  const previewGroups = applyNavigationMenu(availableCollections, config);

  // SSR Fallback
  if (typeof document === "undefined") {
    if (!open) return null;
    return (
      <div data-testid="navigation-menu-builder-dialog" className="hidden">
        <h2>Navigation Menu Builder</h2>
        <div data-testid="live-sidebar-preview">
          <span>Live Preview</span>
          {previewGroups.map((g, idx) => (
            <div key={idx}>
              <span>{g.group}</span>
              {g.items.map((item: any, iIdx) => (
                <span key={iIdx}>{item.label || item.name}</span>
              ))}
            </div>
          ))}
        </div>
        <button data-testid="save-menu-button">Save Navigation</button>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="navigation-menu-builder-dialog"
        className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"
      >
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Menu className="size-5 text-primary" />
            <DialogTitle>Navigation Menu Builder</DialogTitle>
          </div>
          <DialogDescription>
            Customize your application navigation layout. Reorder modules, group resources,
            rename titles, or hide items visually without touching code.
          </DialogDescription>
        </DialogHeader>

        {/* Content Body: Split View (Editor on Left, Live Preview on Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden min-h-[480px]">
          {/* Left: Customizer Editor */}
          <div className="lg:col-span-7 p-6 overflow-y-auto border-r max-h-[calc(90vh-140px)]">
            <SidebarCustomizer
              availableCollections={availableCollections}
              menuConfig={config}
              onChange={setConfig}
              onReset={handleReset}
            />
          </div>

          {/* Right: Live Sidebar Preview */}
          <div className="lg:col-span-5 bg-muted/20 p-6 flex flex-col overflow-y-auto max-h-[calc(90vh-140px)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Eye className="size-3.5" />
                Live Preview
              </div>
              <Badge variant="outline" className="text-[10px]">
                {previewGroups.length} visible {previewGroups.length === 1 ? "group" : "groups"}
              </Badge>
            </div>

            {/* Sidebar Preview Container */}
            <div
              data-testid="live-sidebar-preview"
              className="flex-1 w-full rounded-lg border bg-sidebar text-sidebar-foreground shadow-sm flex flex-col p-3 overflow-hidden font-sans"
            >
              {/* App Brand Header */}
              <div className="flex items-center gap-2 px-2 py-2 mb-2 border-b pb-2">
                <div className="size-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                  H
                </div>
                <div className="text-sm font-semibold truncate">HonoCube Workspace</div>
              </div>

              {/* Groups & Items Preview */}
              <div className="flex flex-col gap-4 overflow-y-auto flex-1">
                {previewGroups.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    All navigation groups or items are hidden.
                  </div>
                ) : (
                  previewGroups.map((group, gIdx) => (
                    <div key={gIdx} className="flex flex-col gap-1">
                      <div className="px-2 text-[11px] font-semibold text-muted-foreground tracking-wide uppercase">
                        {group.group}
                      </div>

                      <div className="flex flex-col gap-0.5">
                        {group.items.map((item, iIdx) => {
                          const isCol =
                            typeof item === "object" &&
                            item !== null &&
                            "_isCollection" in item;
                          const label = item.label || (isCol ? (item as any).name : "");
                          const href = isCol ? `/${(item as any).name}` : item.href;
                          const isExternal = href?.startsWith("http");

                          return (
                            <div
                              key={iIdx}
                              className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                            >
                              <div className="flex items-center gap-2 truncate">
                                {isCol ? (
                                  <Database className="size-3.5 text-sidebar-foreground/70 shrink-0" />
                                ) : isExternal ? (
                                  <ExternalLink className="size-3.5 text-sidebar-foreground/70 shrink-0" />
                                ) : (
                                  <LinkIcon className="size-3.5 text-sidebar-foreground/70 shrink-0" />
                                )}
                                <span className="truncate">{label}</span>
                              </div>

                              {!isCol && (item as any).badge !== undefined && (
                                <Badge
                                  variant="secondary"
                                  className="text-[9px] px-1 py-0 h-4"
                                >
                                  {(item as any).badge}
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-3 border-t bg-muted/10 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs text-muted-foreground"
          >
            <RotateCcw className="mr-1.5 size-3.5" />
            Reset to Default
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              data-testid="cancel-menu-button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              data-testid="save-menu-button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="mr-1.5 size-4" />
              {isSaving ? "Saving..." : "Save Navigation"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
