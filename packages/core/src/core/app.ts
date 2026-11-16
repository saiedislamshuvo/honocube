import type { AppConfig, AppInstance, NavigationGroup } from "../types/app.js";
import type { Collection } from "../types/collection.js";
import { isHonoCubeTheme, type HonoCubeTheme } from "../theme/theme-contract.js";

function isCollection(item: any): item is Collection<any> {
  if (!item || typeof item !== "object") return false;
  return Boolean(
    item._isCollection ||
      (typeof item.name === "string" && item.fields && typeof item.fields === "object")
  );
}

function extractCollections(items: any[], map: Map<string, Collection<any>>) {
  for (const item of items) {
    if (!item) continue;
    if (isCollection(item) && item.name) {
      if (!map.has(item.name)) {
        map.set(item.name, item);
      }
    }
    if (Array.isArray((item as any).items)) {
      extractCollections((item as any).items, map);
    }
    if (Array.isArray((item as any).children)) {
      extractCollections((item as any).children, map);
    }
  }
}

export function defineApp(config: AppConfig): AppInstance {
  if (!config || typeof config !== "object") {
    throw new Error("defineApp: Configuration object is required.");
  }
  if (!config.title || typeof config.title !== "string" || config.title.trim() === "") {
    throw new Error("defineApp: App 'title' is required.");
  }
  if (!config.apiBaseUrl || typeof config.apiBaseUrl !== "string" || config.apiBaseUrl.trim() === "") {
    throw new Error("defineApp: App 'apiBaseUrl' is required.");
  }

  const collectionsMap = new Map<string, Collection<any>>();

  // 1. Auto-infer and register collections defined in navigation groups
  if (Array.isArray(config.navigation)) {
    for (const group of config.navigation) {
      if (group && Array.isArray(group.items)) {
        extractCollections(group.items, collectionsMap);
      }
    }
  }

  // 2. Register extra non-navigation collections (e.g. child tables, sub-resources, modal-only tables)
  if (Array.isArray(config.extraCollections)) {
    for (const col of config.extraCollections) {
      if (col && col.name && !collectionsMap.has(col.name)) {
        collectionsMap.set(col.name, col);
      }
    }
  }

  // 3. Register legacy collections array for backwards compatibility
  if (Array.isArray(config.collections)) {
    for (const col of config.collections) {
      if (col && col.name && !collectionsMap.has(col.name)) {
        collectionsMap.set(col.name, col);
      }
    }
  }

  const allCollections = Array.from(collectionsMap.values());

  // 4. Resolve navigation: use explicit navigation if provided;
  // otherwise, auto-infer navigation groups from config.collections (if present)
  let navigation: NavigationGroup[];
  if (config.navigation !== undefined) {
    navigation = config.navigation;
  } else if (Array.isArray(config.collections) && config.collections.length > 0) {
    const groupMap = new Map<string, Collection<any>[]>();
    for (const col of config.collections) {
      if (col && col.name) {
        const groupName = col.group || (col.singleton ? "Settings" : "Collections");
        if (!groupMap.has(groupName)) {
          groupMap.set(groupName, []);
        }
        groupMap.get(groupName)!.push(col);
      }
    }
    navigation = Array.from(groupMap.entries()).map(([group, items]) => ({
      group,
      items,
    }));
  } else {
    navigation = [];
  }

  let resolvedTheme: HonoCubeTheme | undefined;
  if (isHonoCubeTheme(config.theme)) {
    resolvedTheme = config.theme;
  } else if (
    config.theme &&
    typeof config.theme === "object" &&
    isHonoCubeTheme((config.theme as any).theme)
  ) {
    resolvedTheme = (config.theme as any).theme;
  }

  const app: AppInstance = {
    ...config,
    _isApp: true,
    navigation,
    collections: allCollections,
    extraCollections: config.extraCollections || [],
    getCollection: (name: string) => collectionsMap.get(name),
    getCollections: () => allCollections,
    getNavigation: () => navigation,
    getTheme: () => resolvedTheme,
  };

  return Object.freeze(app);
}
