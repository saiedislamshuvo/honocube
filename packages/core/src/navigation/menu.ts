import type { Collection } from "../types/collection.js";
import type {
  NavigationGroup,
  NavigationItem,
  CustomNavigationLink,
} from "../types/app.js";

export type NavigationItemType = "collection" | "custom_link" | "external";

export interface NavigationMenuItemConfig {
  id: string;
  type: NavigationItemType;
  label: string;
  href: string;
  collectionName?: string;
  icon?: string;
  badge?: string | number;
  hidden?: boolean;
  roles?: string[];
  external?: boolean;
  target?: string;
}

export interface NavigationMenuGroupConfig {
  id: string;
  title: string;
  icon?: string;
  hidden?: boolean;
  roles?: string[];
  items: NavigationMenuItemConfig[];
}

export interface NavigationMenuConfig {
  groups: NavigationMenuGroupConfig[];
  tenantId?: string;
  version?: number;
}

/**
 * Builds a default visual navigation menu configuration from collections and custom links.
 */
export function buildDefaultNavigation(
  collections: Collection<any>[] = [],
  customLinks: CustomNavigationLink[] = []
): NavigationMenuConfig {
  const groupMap = new Map<string, NavigationMenuItemConfig[]>();

  for (const col of collections) {
    const groupName = col.group || "Collections";
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, []);
    }

    groupMap.get(groupName)!.push({
      id: `item_${col.name}`,
      type: "collection",
      label: col.label || col.name,
      href: `/${col.name}`,
      collectionName: col.name,
      icon: typeof col.icon === "string" ? col.icon : undefined,
      hidden: false,
    });
  }

  const groups: NavigationMenuGroupConfig[] = Array.from(
    groupMap.entries()
  ).map(([title, items], idx) => ({
    id: `group_${idx + 1}_${title.toLowerCase().replace(/\s+/g, "_")}`,
    title,
    hidden: false,
    items,
  }));

  if (customLinks.length > 0) {
    groups.push({
      id: "group_custom_links",
      title: "Quick Links",
      hidden: false,
      items: customLinks.map((link, idx) => ({
        id: `link_${idx + 1}`,
        type: link.href.startsWith("http") ? "external" : "custom_link",
        label: link.label,
        href: link.href,
        icon: link.icon,
        badge: link.badge,
        external: link.href.startsWith("http"),
        target: link.href.startsWith("http") ? "_blank" : undefined,
        hidden: false,
      })),
    });
  }

  return {
    groups,
    version: 1,
  };
}

/**
 * Transforms a visual NavigationMenuConfig into runtime NavigationGroup[]
 * filtered by user role and active tenant.
 */
export function applyNavigationMenu(
  collections: Collection<any>[] = [],
  menuConfig: NavigationMenuConfig,
  currentUser?: { roles?: string[]; role?: string },
  activeTenantId?: string
): NavigationGroup[] {
  if (!menuConfig?.groups) return [];

  if (menuConfig.tenantId && activeTenantId && menuConfig.tenantId !== activeTenantId) {
    return [];
  }

  const userRoles = new Set<string>();
  if (currentUser?.roles) {
    currentUser.roles.forEach((r) => userRoles.add(r.toLowerCase()));
  }
  if (currentUser?.role) {
    userRoles.add(currentUser.role.toLowerCase());
  }
  const isSuperadmin =
    userRoles.has("superadmin") || userRoles.has("admin") || userRoles.size === 0;

  const collectionMap = new Map<string, Collection<any>>();
  for (const col of collections) {
    collectionMap.set(col.name, col);
  }

  const result: NavigationGroup[] = [];

  for (const groupConfig of menuConfig.groups) {
    if (groupConfig.hidden) continue;

    // Role check for group
    if (groupConfig.roles && groupConfig.roles.length > 0 && !isSuperadmin) {
      const hasRole = groupConfig.roles.some((r) =>
        userRoles.has(r.toLowerCase())
      );
      if (!hasRole) continue;
    }

    const items: NavigationItem[] = [];

    for (const itemConfig of groupConfig.items) {
      if (itemConfig.hidden) continue;

      // Role check for item
      if (itemConfig.roles && itemConfig.roles.length > 0 && !isSuperadmin) {
        const hasRole = itemConfig.roles.some((r) =>
          userRoles.has(r.toLowerCase())
        );
        if (!hasRole) continue;
      }

      if (itemConfig.type === "collection" && itemConfig.collectionName) {
        const col = collectionMap.get(itemConfig.collectionName);
        if (col) {
          // If title or label was renamed, augment the collection object
          if (itemConfig.label && itemConfig.label !== (col.label || col.name)) {
            items.push({
              ...col,
              label: itemConfig.label,
            });
          } else {
            items.push(col);
          }
        } else {
          // Fallback to custom navigation link
          items.push({
            label: itemConfig.label,
            href: itemConfig.href,
            icon: itemConfig.icon,
            badge: itemConfig.badge,
          });
        }
      } else {
        items.push({
          label: itemConfig.label,
          href: itemConfig.href,
          icon: itemConfig.icon,
          badge: itemConfig.badge,
        });
      }
    }

    if (items.length > 0) {
      result.push({
        group: groupConfig.title,
        icon: groupConfig.icon,
        items,
      });
    }
  }

  return result;
}
