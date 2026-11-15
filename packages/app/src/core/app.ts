import type { AppConfig, AppInstance, NavigationItem } from "../types/app.js";
import type { Collection } from "../types/collection.js";
import { isHonoCubeTheme, type HonoCubeTheme } from "../theme/theme-contract.js";

function isCollection(item: NavigationItem): item is Collection<any> {
  return typeof item === "object" && item !== null && "_isCollection" in item;
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

  if (Array.isArray(config.collections)) {
    for (const col of config.collections) {
      if (col && col.name) {
        collectionsMap.set(col.name, col);
      }
    }
  }

  const navigation = config.navigation || [];
  for (const group of navigation) {
    if (Array.isArray(group.items)) {
      for (const item of group.items) {
        if (isCollection(item) && item.name) {
          collectionsMap.set(item.name, item);
        }
      }
    }
  }

  const allCollections = Array.from(collectionsMap.values());

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
    getCollection: (name: string) => collectionsMap.get(name),
    getCollections: () => allCollections,
    getNavigation: () => navigation,
    getTheme: () => resolvedTheme,
  };

  return Object.freeze(app);
}
