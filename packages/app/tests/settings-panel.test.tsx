import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  defineApp,
  defineCollection,
  resolveWorkspaceRoute,
  AppProvider,
  ThemeProvider,
  WorkspacePage,
  SettingsPanel,
  queryKeys,
} from "../src/index.js";

describe("Singleton Settings Configuration Panel (Issue #115)", () => {
  // 1. Singleton Settings Collection definition
  const storeSettings = defineCollection({
    name: "store_settings",
    label: "Store Configuration",
    singular: "Setting",
    singleton: true,
    fields: {
      siteName: { type: "text", label: "Store Name", required: true },
      contactEmail: { type: "text", label: "Support Email", required: true },
      currency: {
        type: "select",
        label: "Primary Currency",
        options: [
          { label: "USD ($)", value: "USD" },
          { label: "EUR (€)", value: "EUR" },
          { label: "GBP (£)", value: "GBP" },
        ],
        default: "USD",
      },
      maintenanceMode: { type: "boolean", label: "Maintenance Mode", default: false },
      stripeSecretKey: { type: "text", label: "Stripe Secret Key" },
      webhookSecret: { type: "text", label: "Webhook Signing Secret" },
    },
    form: {
      tabs: [
        {
          label: "General",
          sections: [
            {
              title: "Branding & Contact",
              description: "Configure store identity and customer support channels",
              fields: ["siteName", "contactEmail"],
            },
            {
              title: "Regional & Currency",
              fields: ["currency", "maintenanceMode"],
            },
          ],
        },
        {
          label: "Payments",
          sections: [
            {
              title: "Stripe Gateway",
              description: "API keys and webhook endpoints for payment processing",
              fields: ["stripeSecretKey", "webhookSecret"],
            },
          ],
        },
      ],
    },
  });

  const products = defineCollection({
    name: "products",
    label: "Products",
    fields: {
      id: { type: "text", label: "SKU" },
      name: { type: "text", label: "Product Name" },
    },
  });

  const app = defineApp({
    title: "E-Commerce Admin",
    apiBaseUrl: "https://api.store.example.com",
    collections: [storeSettings, products],
  });

  const mockSettingsData = {
    siteName: "Acme Global Store",
    contactEmail: "support@acmestore.com",
    currency: "USD",
    maintenanceMode: false,
    stripeSecretKey: "sk_live_1234567890",
    webhookSecret: "whsec_abcdef123456",
  };

  describe("Pure Route Resolution (`resolveWorkspaceRoute`)", () => {
    it("resolves singleton collections directly to 'singleton' route instead of 'list'", () => {
      const resolved = resolveWorkspaceRoute(app, ["store_settings"]);

      expect(resolved.type).toBe("singleton");
      expect(resolved.collectionName).toBe("store_settings");
      expect(resolved.collection?.singleton).toBe(true);
    });

    it("preserves active tab / sub-path identifier for deep-linked settings tabs", () => {
      const resolved = resolveWorkspaceRoute(app, ["store_settings", "payments"]);

      expect(resolved.type).toBe("singleton");
      expect(resolved.collectionName).toBe("store_settings");
      expect(resolved.recordId).toBe("payments");
      expect(resolved.slug).toEqual(["store_settings", "payments"]);
    });

    it("continues to resolve non-singleton multi-record collections normally", () => {
      const listRoute = resolveWorkspaceRoute(app, ["products"]);
      expect(listRoute.type).toBe("list");

      const createRoute = resolveWorkspaceRoute(app, ["products", "new"]);
      expect(createRoute.type).toBe("create");

      const detailRoute = resolveWorkspaceRoute(app, ["products", "prod-101"]);
      expect(detailRoute.type).toBe("detail");
      expect(detailRoute.recordId).toBe("prod-101");
    });
  });

  describe("Navigation Auto-Inference (`defineApp`)", () => {
    it("automatically groups singleton collections into 'Settings' group when unspecified", () => {
      const nav = app.getNavigation();
      const settingsGroup = nav.find((g) => g.group === "Settings");
      const collectionsGroup = nav.find((g) => g.group === "Collections");

      expect(settingsGroup).toBeDefined();
      expect(settingsGroup?.items.some((item) => item.name === "store_settings")).toBe(true);

      expect(collectionsGroup).toBeDefined();
      expect(collectionsGroup?.items.some((item) => item.name === "products")).toBe(true);
    });
  });

  describe("SettingsPanel Component", () => {
    it("renders standalone settings panel with header, tabs, sections, and fields", () => {
      const html = renderToString(
        <SettingsPanel
          collection={storeSettings}
          data={mockSettingsData}
        />
      );

      // 1. Header Toolbar
      expect(html).toContain("Store Configuration");
      expect(html).toContain("Save Changes");

      // 2. Tabs
      expect(html).toContain("General");
      expect(html).toContain("Payments");

      // 3. Sections & Descriptions
      expect(html).toContain("Branding &amp; Contact");
      expect(html).toContain("Configure store identity and customer support channels");
      expect(html).toContain("Regional &amp; Currency");

      // 4. Form values rendered in inputs
      expect(html).toContain('value="Acme Global Store"');
      expect(html).toContain('value="support@acmestore.com"');
    });

    it("renders custom title, description, and save button label", () => {
      const html = renderToString(
        <SettingsPanel
          collection={storeSettings}
          data={mockSettingsData}
          title="System Preferences"
          description="Global environment variables and keys"
          saveLabel="Apply Configuration"
        />
      );

      expect(html).toContain("System Preferences");
      expect(html).toContain("Global environment variables and keys");
      expect(html).toContain("Apply Configuration");
    });

    it("renders without tabs when collection has simple section or flat layout", () => {
      const flatSettings = defineCollection({
        name: "simple_config",
        label: "Simple Config",
        singleton: true,
        fields: {
          appTitle: { type: "text", label: "App Title" },
          debugMode: { type: "boolean", label: "Debug Mode" },
        },
      });

      const html = renderToString(
        <SettingsPanel
          collection={flatSettings}
          data={{ appTitle: "My App", debugMode: true }}
        />
      );

      expect(html).toContain("Simple Config");
      expect(html).toContain("App Title");
      expect(html).toContain("Debug Mode");
      expect(html).not.toContain('role="tablist"');
    });
  });

  describe("WorkspacePage Integration", () => {
    it("renders singleton settings route directly without multi-record table or '+ New' button", () => {
      const queryClient = new QueryClient();
      const queryKey = queryKeys.collection.list("store_settings", { limit: 1 });
      queryClient.setQueryData(queryKey, {
        success: true,
        data: [mockSettingsData],
      });

      const customClient: any = {
        apiBaseUrl: "https://api.store.example.com",
        get: vi.fn(),
      };

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <AppProvider app={app} client={customClient}>
            <WorkspacePage
              app={app}
              params={{ slug: ["store_settings"] }}
            />
          </AppProvider>
        </QueryClientProvider>
      );

      // 1. Singleton route container
      expect(html).toContain('data-testid="route-singleton"');

      // 2. No list route or create button
      expect(html).not.toContain('data-testid="route-list"');
      expect(html).not.toContain('data-testid="collection-create-button"');

      // 3. SettingsPanel rendered
      expect(html).toContain("Store Configuration");
      expect(html).toContain("Save Changes");
      expect(html).toContain("Branding &amp; Contact");
    });

    it("supports custom singleton view slot override via HonoCubeTheme", () => {
      const queryClient = new QueryClient();
      const customClient: any = {
        apiBaseUrl: "https://api.store.example.com",
        get: vi.fn(),
      };

      const customTheme = {
        name: "custom-settings-theme",
        components: {
          views: {
            singleton: ({ collection }: any) => (
              <div data-testid="custom-singleton-slot">
                <h2>{`Custom Settings Panel for ${collection.label}`}</h2>
              </div>
            ),
          },
        },
      };

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <AppProvider app={app} client={customClient}>
            <ThemeProvider themeContract={customTheme}>
              <WorkspacePage
                app={app}
                params={{ slug: ["store_settings"] }}
              />
            </ThemeProvider>
          </AppProvider>
        </QueryClientProvider>
      );

      expect(html).toContain('data-testid="custom-singleton-slot"');
      expect(html).toContain("Custom Settings Panel for Store Configuration");
    });

    it("renders custom actions slot in settings header", () => {
      const html = renderToString(
        <SettingsPanel
          collection={storeSettings}
          data={mockSettingsData}
          actions={<button id="test-reset-btn">Reset to Defaults</button>}
        />
      );

      expect(html).toContain("Reset to Defaults");
    });

    it("renders form sections properly when sections are defined without tabs", () => {
      const sectionSettings = defineCollection({
        name: "sectioned_settings",
        label: "Sectioned Settings",
        singleton: true,
        fields: {
          apiKey: { type: "text", label: "API Key" },
          environment: { type: "text", label: "Environment" },
        },
        form: {
          sections: [
            {
              title: "Developer Credentials",
              description: "API keys for external integration",
              fields: ["apiKey", "environment"],
            },
          ],
        },
      });

      const html = renderToString(
        <SettingsPanel
          collection={sectionSettings}
          data={{ apiKey: "key_123", environment: "production" }}
        />
      );

      expect(html).toContain("Developer Credentials");
      expect(html).toContain("API keys for external integration");
      expect(html).toContain('value="key_123"');
    });
  });
});
