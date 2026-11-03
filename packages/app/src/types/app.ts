import type { Collection } from "./collection.js";

export type AuthType = "bearer" | "cookie" | "custom";

export interface AuthConfig {
  type: AuthType;
  getToken?: () => string | null | Promise<string | null>;
  loginUrl?: string;
  logoutUrl?: string;
  headerName?: string;
  tokenPrefix?: string;
}

export interface TenantConfig {
  header?: string;
  getTenantId?: () => string | null | Promise<string | null>;
}

export interface IdempotencyConfig {
  enabled?: boolean;
  header?: string;
  generateKey?: () => string;
}

export interface CustomNavigationLink {
  label: string;
  href: string;
  icon?: string;
  badge?: string | number;
}

export type NavigationItem = Collection<any> | CustomNavigationLink;

export interface NavigationGroup {
  group: string;
  icon?: string;
  items: NavigationItem[];
}

export type ShellElementPosition = "sidebar" | "header" | "none";

export interface AppLayoutConfig {
  tenantSwitcher?: ShellElementPosition;
  userProfile?: ShellElementPosition;
  sidebarCollapseMode?: "icon" | "offcanvas";
}

export interface AppConfig {
  title: string;
  apiBaseUrl: string;
  auth?: AuthConfig;
  tenant?: TenantConfig;
  idempotency?: IdempotencyConfig;
  navigation?: NavigationGroup[];
  collections?: Collection<any>[];
  layout?: AppLayoutConfig;
  components?: {
    fields?: Record<string, any>;
    views?: Record<string, any>;
  };
}

export interface AppInstance extends AppConfig {
  readonly _isApp: true;
  getCollection: (name: string) => Collection<any> | undefined;
  getCollections: () => Collection<any>[];
  getNavigation: () => NavigationGroup[];
}
