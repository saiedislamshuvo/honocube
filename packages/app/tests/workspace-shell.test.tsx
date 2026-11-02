import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  defineApp,
  defineCollection,
  WorkspaceShell,
  WorkspaceSidebar,
  WorkspaceTopbar,
  WorkspaceBreadcrumbs,
  parsePathnameToBreadcrumbs,
  TenantSwitcher,
  UserProfileDropdown,
  Spotlight,
  type ShellTenant,
  type ShellUser,
} from "../src/index.js";

describe("Workspace Shell Layout & Navigation Components", () => {
  // Test Collections
  const deals = defineCollection({
    name: "deals",
    label: "Deals Pipeline",
    singular: "Deal",
    group: "CRM",
    fields: {
      title: { type: "text", label: "Title" },
    },
  });

  const invoices = defineCollection({
    name: "invoices",
    label: "Customer Invoices",
    singular: "Invoice",
    group: "Accounting",
    fields: {
      invoiceNumber: { type: "text", label: "Invoice #" },
    },
  });

  const app = defineApp({
    name: "enterprise_crm",
    title: "Cube Enterprise Suite",
    apiBaseUrl: "https://api.crm.example.com",
    collections: [deals, invoices],
    navigation: [
      {
        group: "Sales & CRM",
        items: [deals],
      },
      {
        group: "Finance",
        items: [
          invoices,
          {
            label: "Financial Reports",
            href: "/reports/financial",
            badge: "New",
          },
        ],
      },
    ],
  });

  const mockTenants: ShellTenant[] = [
    { id: "tenant-acme", name: "Acme Global", plan: "Enterprise" },
    { id: "tenant-beta", name: "Beta Corp", plan: "Starter" },
  ];

  const mockUser: ShellUser = {
    name: "Sarah Connor",
    email: "sarah@acme.com",
    role: "Administrator",
  };

  it("renders WorkspaceShell with sidebar, topbar, breadcrumbs, and main content", () => {
    const handleNavigate = vi.fn();
    const handleTenantChange = vi.fn();
    const handleLogout = vi.fn();
    const handleThemeChange = vi.fn();

    const html = renderToString(
      <WorkspaceShell
        app={app}
        pathname="/deals"
        tenants={mockTenants}
        activeTenantId="tenant-acme"
        onTenantChange={handleTenantChange}
        currentUser={mockUser}
        onLogout={handleLogout}
        theme="light"
        onThemeChange={handleThemeChange}
        onNavigate={handleNavigate}
      >
        <div data-testid="dashboard-content">Welcome to the Dashboard</div>
      </WorkspaceShell>
    );

    // 1. Root shell container
    expect(html).toContain("data-testid=\"workspace-shell\"");

    // 2. Sidebar with app title and navigation groups
    expect(html).toContain("Cube Enterprise Suite");
    expect(html).toContain("Sales &amp; CRM");
    expect(html).toContain("Deals Pipeline");
    expect(html).toContain("Finance");
    expect(html).toContain("Customer Invoices");
    expect(html).toContain("Financial Reports");
    expect(html).toContain("New"); // Badge

    // 3. Quick create buttons for collections in sidebar
    expect(html).toContain("data-testid=\"sidebar-quick-create-deals\"");
    expect(html).toContain("data-testid=\"sidebar-quick-create-invoices\"");

    // 4. Topbar with Spotlight trigger and Breadcrumbs
    expect(html).toContain("data-testid=\"workspace-topbar\"");
    expect(html).toContain("data-testid=\"spotlight-trigger\"");
    expect(html).toContain("Search...");
    expect(html).toContain("⌘K");

    // 5. Tenant switcher trigger
    expect(html).toContain("data-testid=\"tenant-switcher-trigger\"");
    expect(html).toContain("Acme Global");

    // 6. User profile trigger
    expect(html).toContain("data-testid=\"user-profile-trigger\"");
    expect(html).toContain("Sarah Connor");
    expect(html).toContain("SC"); // Initials

    // 7. Main content rendered
    expect(html).toContain("Welcome to the Dashboard");
  });

  it("parses pathname into hierarchical breadcrumbs correctly", () => {
    // 1. Home route
    const homeCrumbs = parsePathnameToBreadcrumbs("/", app);
    expect(homeCrumbs).toHaveLength(1);
    expect(homeCrumbs[0].label).toBe("Home");
    expect(homeCrumbs[0].isCurrent).toBe(true);

    // 2. Collection list route
    const listCrumbs = parsePathnameToBreadcrumbs("/deals", app);
    expect(listCrumbs).toHaveLength(2);
    expect(listCrumbs[0].label).toBe("Home");
    expect(listCrumbs[1].label).toBe("Deals Pipeline");
    expect(listCrumbs[1].isCurrent).toBe(true);

    // 3. New record create route
    const newCrumbs = parsePathnameToBreadcrumbs("/deals/new", app);
    expect(newCrumbs).toHaveLength(3);
    expect(newCrumbs[0].label).toBe("Home");
    expect(newCrumbs[1].label).toBe("Deals Pipeline");
    expect(newCrumbs[2].label).toBe("New Deal");
    expect(newCrumbs[2].isCurrent).toBe(true);

    // 4. Record detail route
    const detailCrumbs = parsePathnameToBreadcrumbs("/invoices/INV-2026-001", app);
    expect(detailCrumbs).toHaveLength(3);
    expect(detailCrumbs[0].label).toBe("Home");
    expect(detailCrumbs[1].label).toBe("Customer Invoices");
    expect(detailCrumbs[2].label).toBe("INV-2026-001");
    expect(detailCrumbs[2].isCurrent).toBe(true);
  });

  it("renders WorkspaceBreadcrumbs with links and separator markers", () => {
    const handleNavigate = vi.fn();
    const html = renderToString(
      <WorkspaceBreadcrumbs
        app={app}
        pathname="/invoices/new"
        onNavigate={handleNavigate}
      />
    );

    expect(html).toContain("data-testid=\"workspace-breadcrumbs\"");
    expect(html).toContain("Home");
    expect(html).toContain("Customer Invoices");
    expect(html).toContain("New Invoice");
    expect(html).toContain("data-testid=\"breadcrumb-link-0\"");
    expect(html).toContain("data-testid=\"breadcrumb-link-1\"");
    expect(html).toContain("data-testid=\"breadcrumb-page-2\"");
  });

  it("renders TenantSwitcher with current workspace trigger", () => {
    const handleTenantChange = vi.fn();
    const handleAddTenant = vi.fn();

    const html = renderToString(
      <TenantSwitcher
        tenants={mockTenants}
        activeTenantId="tenant-beta"
        onTenantChange={handleTenantChange}
        onAddTenant={handleAddTenant}
      />
    );

    expect(html).toContain("data-testid=\"tenant-switcher-trigger\"");
    expect(html).toContain("Beta Corp");
  });

  it("renders UserProfileDropdown with user info trigger", () => {
    const html = renderToString(
      <UserProfileDropdown user={mockUser} onLogout={vi.fn()} />
    );

    expect(html).toContain("data-testid=\"user-profile-trigger\"");
    expect(html).toContain("Sarah Connor");
    expect(html).toContain("SC");
  });

  it("renders WorkspaceSidebar in collapsed mode", () => {
    const handleCollapseChange = vi.fn();

    const html = renderToString(
      <WorkspaceSidebar
        app={app}
        pathname="/deals"
        collapsed={true}
        onCollapseChange={handleCollapseChange}
      />
    );

    // Sidebar has collapsed class
    expect(html).toContain("w-16");
    expect(html).toContain("data-testid=\"sidebar-expand-button\"");
    // App title is hidden in collapsed mode
    expect(html).not.toContain("data-testid=\"sidebar-app-title\"");
  });

  it("renders Spotlight command palette with collections and quick create actions", () => {
    const handleSelect = vi.fn();
    const html = renderToString(
      <Spotlight app={app} inline={true} onSelect={handleSelect} />
    );

    expect(html).toContain("Type a command or search collections... (⌘K)");
    expect(html).toContain("Collections");
    expect(html).toContain("Quick Create");
    expect(html).toContain("Deals Pipeline");
    expect(html).toContain("Customer Invoices");
    expect(html).toContain("New Deal");
    expect(html).toContain("New Invoice");
  });

  it("renders WorkspaceTopbar directly with search trigger, theme toggle, and tenant switcher", () => {
    const handleSpotlight = vi.fn();
    const handleToggle = vi.fn();

    const html = renderToString(
      <WorkspaceTopbar
        app={app}
        pathname="/deals"
        tenants={mockTenants}
        onSpotlightOpen={handleSpotlight}
        onSidebarToggle={handleToggle}
      />
    );

    expect(html).toContain("data-testid=\"workspace-topbar\"");
    expect(html).toContain("data-testid=\"sidebar-toggle-button\"");
    expect(html).toContain("data-testid=\"spotlight-trigger\"");
  });
});
