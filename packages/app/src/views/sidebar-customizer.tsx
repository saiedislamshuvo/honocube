import * as React from "react";
import { useState } from "react";
import {
  Layers,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  ExternalLink,
  Link as LinkIcon,
  RotateCcw,
  FolderPlus,
  Database,
} from "lucide-react";
import {
  Button,
  Input,
  Badge,
  Card,
  CardHeader,
  CardContent,
  cn,
} from "@honocube/ui";
import type {
  NavigationMenuGroupConfig,
  NavigationMenuItemConfig,
  SidebarCustomizerProps,
} from "@honocube/core";

export function SidebarCustomizer({
  availableCollections = [],
  menuConfig,
  onChange,
  onReset,
  className = "",
}: SidebarCustomizerProps): React.JSX.Element {
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [addingItemToGroup, setAddingItemToGroup] = useState<string | null>(null);
  const [newItemType, setNewItemType] = useState<"collection" | "custom_link">("collection");
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [customLinkLabel, setCustomLinkLabel] = useState<string>("");
  const [customLinkHref, setCustomLinkHref] = useState<string>("");

  const groups: NavigationMenuGroupConfig[] = menuConfig.groups || [];

  const updateGroups = (newGroups: NavigationMenuGroupConfig[]) => {
    onChange({
      ...menuConfig,
      groups: newGroups,
    });
  };

  // Group Operations
  const handleAddGroup = () => {
    const trimmed = newGroupTitle.trim();
    if (!trimmed) return;

    const newGroup: NavigationMenuGroupConfig = {
      id: `group_${Date.now()}_${trimmed.toLowerCase().replace(/\s+/g, "_")}`,
      title: trimmed,
      hidden: false,
      items: [],
    };

    updateGroups([...groups, newGroup]);
    setNewGroupTitle("");
  };

  const handleRemoveGroup = (groupId: string) => {
    updateGroups(groups.filter((g: NavigationMenuGroupConfig) => g.id !== groupId));
  };

  const handleToggleGroupVisibility = (groupId: string) => {
    updateGroups(
      groups.map((g: NavigationMenuGroupConfig) =>
        g.id === groupId ? { ...g, hidden: !g.hidden } : g
      )
    );
  };

  const handleRenameGroup = (groupId: string, newTitle: string) => {
    updateGroups(
      groups.map((g: NavigationMenuGroupConfig) =>
        g.id === groupId ? { ...g, title: newTitle } : g
      )
    );
  };

  const handleMoveGroup = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= groups.length) return;

    const copy = [...groups];
    const [moved] = copy.splice(index, 1);
    if (moved) {
      copy.splice(targetIndex, 0, moved);
      updateGroups(copy);
    }
  };

  // Item Operations
  const handleRemoveItem = (groupId: string, itemId: string) => {
    updateGroups(
      groups.map((g: NavigationMenuGroupConfig) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          items: g.items.filter((item: NavigationMenuItemConfig) => item.id !== itemId),
        };
      })
    );
  };

  const handleToggleItemVisibility = (groupId: string, itemId: string) => {
    updateGroups(
      groups.map((g: NavigationMenuGroupConfig) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          items: g.items.map((item: NavigationMenuItemConfig) =>
            item.id === itemId ? { ...item, hidden: !item.hidden } : item
          ),
        };
      })
    );
  };

  const handleRenameItem = (
    groupId: string,
    itemId: string,
    newLabel: string
  ) => {
    updateGroups(
      groups.map((g: NavigationMenuGroupConfig) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          items: g.items.map((item: NavigationMenuItemConfig) =>
            item.id === itemId ? { ...item, label: newLabel } : item
          ),
        };
      })
    );
  };

  const handleMoveItem = (
    groupId: string,
    itemIndex: number,
    direction: "up" | "down"
  ) => {
    updateGroups(
      groups.map((g: NavigationMenuGroupConfig) => {
        if (g.id !== groupId) return g;
        const targetIndex = direction === "up" ? itemIndex - 1 : itemIndex + 1;
        if (targetIndex < 0 || targetIndex >= g.items.length) return g;

        const copy = [...g.items];
        const [moved] = copy.splice(itemIndex, 1);
        if (moved) {
          copy.splice(targetIndex, 0, moved);
        }
        return { ...g, items: copy };
      })
    );
  };

  const handleAddItemToGroup = (groupId: string) => {
    if (newItemType === "collection") {
      const colName =
        selectedCollection ||
        (availableCollections.length > 0 ? availableCollections[0]?.name : "");
      if (!colName) return;
      const col = availableCollections.find((c) => c.name === colName);
      const label = col?.label || colName;

      const newItem: NavigationMenuItemConfig = {
        id: `item_${Date.now()}_${colName}`,
        type: "collection",
        label,
        href: `/${colName}`,
        collectionName: colName,
        hidden: false,
      };

      updateGroups(
        groups.map((g: NavigationMenuGroupConfig) =>
          g.id === groupId ? { ...g, items: [...g.items, newItem] } : g
        )
      );
    } else {
      const label = customLinkLabel.trim();
      const href = customLinkHref.trim();
      if (!label || !href) return;

      const isExternal = href.startsWith("http://") || href.startsWith("https://");
      const newItem: NavigationMenuItemConfig = {
        id: `link_${Date.now()}`,
        type: isExternal ? "external" : "custom_link",
        label,
        href,
        external: isExternal,
        target: isExternal ? "_blank" : undefined,
        hidden: false,
      };

      updateGroups(
        groups.map((g: NavigationMenuGroupConfig) =>
          g.id === groupId ? { ...g, items: [...g.items, newItem] } : g
        )
      );
    }

    setAddingItemToGroup(null);
    setSelectedCollection("");
    setCustomLinkLabel("");
    setCustomLinkHref("");
  };

  return (
    <div
      data-testid="sidebar-customizer"
      className={cn("flex flex-col gap-4", className)}
    >
      {/* Top action toolbar: Add new group + Reset */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Input
            data-testid="new-group-input"
            placeholder="New Group Title (e.g. Sales, Operations)"
            value={newGroupTitle}
            onChange={(e) => setNewGroupTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddGroup();
              }
            }}
          />
          <Button
            type="button"
            data-testid="add-group-button"
            variant="default"
            size="sm"
            onClick={handleAddGroup}
            disabled={!newGroupTitle.trim()}
          >
            <FolderPlus className="mr-1.5 size-4" />
            Add Group
          </Button>
        </div>

        {onReset && (
          <Button
            type="button"
            data-testid="reset-menu-button"
            variant="outline"
            size="sm"
            onClick={onReset}
          >
            <RotateCcw className="mr-1.5 size-4" />
            Reset to Default
          </Button>
        )}
      </div>

      {/* Groups List */}
      <div className="flex flex-col gap-4">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg border-dashed text-muted-foreground">
            <Layers className="size-8 mb-2 opacity-50" />
            <p className="text-sm font-medium">No navigation groups configured</p>
            <p className="text-xs">
              Add a new group above or reset to defaults.
            </p>
          </div>
        ) : (
          groups.map((group: NavigationMenuGroupConfig, groupIdx: number) => (
            <Card
              key={group.id}
              data-testid={`menu-group-${group.id}`}
              className={cn(
                "border transition-all",
                group.hidden ? "opacity-60 bg-muted/30" : "bg-card"
              )}
            >
              {/* Group Header */}
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 border-b">
                <div className="flex items-center gap-2 flex-1 mr-4">
                  <Input
                    className="h-8 max-w-[220px] font-semibold text-sm"
                    value={group.title}
                    onChange={(e) => handleRenameGroup(group.id, e.target.value)}
                    placeholder="Group Title"
                  />
                  {group.hidden && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Hidden
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    {group.items.length} {group.items.length === 1 ? "item" : "items"}
                  </Badge>
                </div>

                <div className="flex items-center gap-1">
                  {/* Reorder Group Up/Down */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={groupIdx === 0}
                    onClick={() => handleMoveGroup(groupIdx, "up")}
                    title="Move Group Up"
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={groupIdx === groups.length - 1}
                    onClick={() => handleMoveGroup(groupIdx, "down")}
                    title="Move Group Down"
                  >
                    <ChevronDown className="size-4" />
                  </Button>

                  {/* Toggle Visibility */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => handleToggleGroupVisibility(group.id)}
                    title={group.hidden ? "Show Group" : "Hide Group"}
                  >
                    {group.hidden ? (
                      <EyeOff className="size-4 text-muted-foreground" />
                    ) : (
                      <Eye className="size-4 text-primary" />
                    )}
                  </Button>

                  {/* Delete Group */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveGroup(group.id)}
                    title="Remove Group"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardHeader>

              {/* Group Items */}
              <CardContent className="p-3 flex flex-col gap-2">
                {group.items.length === 0 ? (
                  <div className="text-xs text-muted-foreground p-3 text-center border border-dashed rounded">
                    No items in this group. Add a collection or link below.
                  </div>
                ) : (
                  group.items.map((item: NavigationMenuItemConfig, itemIdx: number) => (
                    <div
                      key={item.id}
                      data-testid={`menu-item-${item.id}`}
                      className={cn(
                        "flex items-center justify-between gap-2 p-2 rounded-md border text-sm",
                        item.hidden ? "opacity-50 bg-muted/40" : "bg-background"
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {item.type === "collection" ? (
                          <Database className="size-4 text-blue-500 shrink-0" />
                        ) : item.type === "external" ? (
                          <ExternalLink className="size-4 text-emerald-500 shrink-0" />
                        ) : (
                          <LinkIcon className="size-4 text-amber-500 shrink-0" />
                        )}

                        <Input
                          className="h-7 text-xs flex-1 max-w-[200px]"
                          value={item.label}
                          onChange={(e) =>
                            handleRenameItem(group.id, item.id, e.target.value)
                          }
                          placeholder="Item Label"
                        />

                        <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                          {item.href}
                        </span>

                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase font-mono px-1 py-0"
                        >
                          {item.type}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Item Move Up/Down */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          disabled={itemIdx === 0}
                          onClick={() => handleMoveItem(group.id, itemIdx, "up")}
                          title="Move Item Up"
                        >
                          <ChevronUp className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          disabled={itemIdx === group.items.length - 1}
                          onClick={() => handleMoveItem(group.id, itemIdx, "down")}
                          title="Move Item Down"
                        >
                          <ChevronDown className="size-3.5" />
                        </Button>

                        {/* Toggle Item Visibility */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          onClick={() => handleToggleItemVisibility(group.id, item.id)}
                          title={item.hidden ? "Show Item" : "Hide Item"}
                        >
                          {item.hidden ? (
                            <EyeOff className="size-3.5 text-muted-foreground" />
                          ) : (
                            <Eye className="size-3.5 text-primary" />
                          )}
                        </Button>

                        {/* Delete Item */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveItem(group.id, item.id)}
                          title="Remove Item"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}

                {/* Add Item Form / Trigger */}
                {addingItemToGroup === group.id ? (
                  <div className="border border-primary/40 bg-muted/20 p-3 rounded-md flex flex-col gap-3 mt-1">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={newItemType === "collection" ? "default" : "outline"}
                        className="h-7 text-xs"
                        onClick={() => setNewItemType("collection")}
                      >
                        <Database className="mr-1 size-3" />
                        Collection
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={newItemType === "custom_link" ? "default" : "outline"}
                        className="h-7 text-xs"
                        onClick={() => setNewItemType("custom_link")}
                      >
                        <LinkIcon className="mr-1 size-3" />
                        Custom Link
                      </Button>
                    </div>

                    {newItemType === "collection" ? (
                      <div className="flex items-center gap-2">
                        <select
                          className="h-8 flex-1 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                          value={
                            selectedCollection ||
                            (availableCollections.length > 0
                              ? availableCollections[0]?.name
                              : "")
                          }
                          onChange={(e) => setSelectedCollection(e.target.value)}
                        >
                          {availableCollections.map((col) => (
                            <option key={col.name} value={col.name}>
                              {col.label || col.name} (/{col.name})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input
                          placeholder="Label (e.g. Analytics, Docs)"
                          value={customLinkLabel}
                          onChange={(e) => setCustomLinkLabel(e.target.value)}
                          className="h-8 text-xs"
                        />
                        <Input
                          placeholder="URL (e.g. /reports or https://...)"
                          value={customLinkHref}
                          onChange={(e) => setCustomLinkHref(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 mt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setAddingItemToGroup(null);
                          setSelectedCollection("");
                          setCustomLinkLabel("");
                          setCustomLinkHref("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleAddItemToGroup(group.id)}
                      >
                        Add to {group.title}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-dashed text-muted-foreground hover:text-foreground mt-1"
                    onClick={() => {
                      setAddingItemToGroup(group.id);
                      setNewItemType("collection");
                      if (availableCollections.length > 0 && availableCollections[0]) {
                        setSelectedCollection(availableCollections[0].name);
                      }
                    }}
                  >
                    <Plus className="mr-1.5 size-3.5" />
                    Add Item
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
