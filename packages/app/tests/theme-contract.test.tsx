import React from "react";
import { renderToString } from "react-dom/server";
import { describe, it, expect } from "vitest";
import {
  createTheme,
  isHonoCubeTheme,
  resolveTheme,
  defaultTheme,
  defineApp,
  defineCollection,
  WorkspacePage,
  WorkspaceShell,
  ThemeProvider,
  useAppTheme,
} from "../src/index.js";
import {
  defineApp as headlessDefineApp,
  defineCollection as headlessDefineCollection,
  useCollectionList,
  useCollectionForm,
  useCollectionWorkflow,
} from "../src/headless.js";

describe("Headless Data Layer (@honocube/app/headless)", () => {
  it("exports headless schema and app creators", () => {
    expect(typeof headlessDefineApp).toBe("function");
    expect(typeof headlessDefineCollection).toBe("function");
    expect(typeof useCollectionList).toBe("function");
    expect(typeof useCollectionForm).toBe("function");
    expect(typeof useCollectionWorkflow).toBe("function");

    const collection = headlessDefineCollection({
      name: "tasks",
      fields: {
        title: { type: "text", required: true },
      },
    });

    expect(collection.name).toBe("tasks");
    expect(collection._isCollection).toBe(true);

    const app = headlessDefineApp({
      title: "Headless System",
      apiBaseUrl: "http://localhost:3000/api",
      collections: [collection],
    });

    expect(app.title).toBe("Headless System");
    expect(app.getCollection("tasks")).toBeDefined();
  });
});

describe("Theme Contract & Specification", () => {
  it("validates theme with isHonoCubeTheme", () => {
    expect(isHonoCubeTheme(defaultTheme)).toBe(true);
    expect(isHonoCubeTheme({ name: "custom" })).toBe(true);
    expect(isHonoCubeTheme(null)).toBe(false);
    expect(isHonoCubeTheme({})).toBe(false);
    expect(isHonoCubeTheme("theme")).toBe(false);
  });

  it("defaultTheme contains standard components", () => {
    expect(defaultTheme.name).toBe("default");
    expect(defaultTheme.components?.Shell).toBeDefined();
    expect(defaultTheme.components?.Dashboard).toBeDefined();
    expect(defaultTheme.components?.views?.table).toBeDefined();
    expect(defaultTheme.components?.views?.form).toBeDefined();
    expect(defaultTheme.components?.views?.kanban).toBeDefined();
  });

  it("creates custom themes with createTheme", () => {
    const CustomTable = () => <div data-testid="custom-table-slot">Custom Table</div>;

    const customTheme = createTheme({
      name: "modern-crm",
      version: "1.0.0",
      description: "Custom modern CRM theme",
      defaultMode: "dark",
      defaultPreset: "violet",
      components: {
        views: {
          table: CustomTable,
        },
      },
    });

    expect(customTheme.name).toBe("modern-crm");
    expect(customTheme.defaultMode).toBe("dark");
    expect(customTheme.defaultPreset).toBe("violet");
    expect(customTheme.components?.views?.table).toBe(CustomTable);
  });

  it("resolveTheme merges custom overrides with base theme defaults", () => {
    const CustomDashboard = () => <div>Custom Dashboard</div>;

    const partialTheme = createTheme({
      name: "partial",
      components: {
        Dashboard: CustomDashboard,
      },
    });

    const merged = resolveTheme(partialTheme, defaultTheme);
    expect(merged).toBeDefined();
    expect(merged?.components?.Dashboard).toBe(CustomDashboard);
    // Should fallback to default views for unspecified slots
    expect(merged?.components?.views?.table).toBe(defaultTheme.components?.views?.table);
    expect(merged?.components?.views?.form).toBe(defaultTheme.components?.views?.form);
  });
});

describe("Theme Slot Overrides in WorkspacePage", () => {
  const collection = defineCollection({
    name: "orders",
    singular: "Order",
    label: "Orders",
    fields: {
      orderNumber: { type: "text", required: true },
      amount: { type: "number" },
    },
  });

  it("renders custom Dashboard component when supplied by theme", () => {
    const CustomDashboard = ({ app }: any) => (
      <div data-testid="custom-dashboard-theme">
        <h1>Welcome to {app.title} Custom Theme</h1>
      </div>
    );

    const theme = createTheme({
      name: "branded",
      components: {
        Dashboard: CustomDashboard,
      },
    });

    const app = defineApp({
      title: "Test Branded App",
      apiBaseUrl: "http://localhost:3000/api",
      theme,
      collections: [collection],
    });

    const html = renderToString(<WorkspacePage app={app} params={{ slug: [] }} />);

    expect(html).toContain("custom-dashboard-theme");
    expect(html).toContain("Test Branded App");
  });

  it("renders custom View slot override (e.g. multiView / table) when supplied by theme", () => {
    const CustomMultiView = ({ collection }: any) => (
      <div data-testid="custom-multiview-theme">
        Custom View for {collection.name}
      </div>
    );

    const theme = createTheme({
      name: "custom-views",
      components: {
        views: {
          multiView: CustomMultiView,
        },
      },
    });

    const app = defineApp({
      title: "Custom Views App",
      apiBaseUrl: "http://localhost:3000/api",
      theme,
      collections: [collection],
    });

    const html = renderToString(<WorkspacePage app={app} params={{ slug: ["orders"] }} />);

    expect(html).toContain("custom-multiview-theme");
    expect(html).toContain("orders");
  });

  it("renders custom NotFound slot override when supplied by theme", () => {
    const CustomNotFound = ({ collectionName }: any) => (
      <div data-testid="custom-not-found-theme">
        Unknown Collection: {collectionName}
      </div>
    );

    const theme = createTheme({
      name: "custom-not-found",
      components: {
        notFound: CustomNotFound,
      },
    });

    const app = defineApp({
      title: "Not Found App",
      apiBaseUrl: "http://localhost:3000/api",
      theme,
      collections: [collection],
    });

    const html = renderToString(<WorkspacePage app={app} params={{ slug: ["nonexistent"] }} />);

    expect(html).toContain("custom-not-found-theme");
    expect(html).toContain("nonexistent");
  });
});

describe("Theme Slot Overrides in WorkspaceShell", () => {
  it("renders custom Sidebar and Topbar from theme contract", () => {
    const CustomSidebar = () => <aside data-testid="custom-theme-sidebar">Custom Sidebar</aside>;
    const CustomTopbar = () => <header data-testid="custom-theme-topbar">Custom Topbar</header>;

    const theme = createTheme({
      name: "custom-shell-theme",
      components: {
        Sidebar: CustomSidebar,
        Topbar: CustomTopbar,
      },
    });

    const app = defineApp({
      title: "Shell Theme App",
      apiBaseUrl: "http://localhost:3000/api",
      theme,
    });

    const html = renderToString(
      <WorkspaceShell app={app} themeContract={theme}>
        <div data-testid="shell-child">App Content</div>
      </WorkspaceShell>
    );

    expect(html).toContain("custom-theme-sidebar");
    expect(html).toContain("custom-theme-topbar");
    expect(html).toContain("shell-child");
  });
});

describe("ThemeProvider and useAppTheme Hook", () => {
  it("provides activeTheme to child components via useAppTheme", () => {
    const theme = createTheme({
      name: "context-theme",
      defaultMode: "dark",
      defaultPreset: "emerald",
    });

    function Consumer() {
      const activeTheme = useAppTheme();
      return (
        <div>
          <span data-testid="theme-name">{activeTheme?.name}</span>
          <span data-testid="theme-preset">{activeTheme?.defaultPreset}</span>
        </div>
      );
    }

    const html = renderToString(
      <ThemeProvider themeContract={theme}>
        <Consumer />
      </ThemeProvider>
    );

    expect(html).toContain("context-theme");
    expect(html).toContain("emerald");
  });
});
