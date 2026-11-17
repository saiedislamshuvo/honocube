import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import {
  SidebarCustomizer,
  NavigationMenuBuilderDialog,
  WorkspaceSidebar,
  defineCollection,
  f,
} from "../src/index.js";
import {
  buildDefaultNavigation,
  type NavigationMenuConfig,
} from "@honocube/core";
import { SidebarProvider } from "@honocube/ui";

describe("Visual Navigation Menu Builder and Sidebar Customizer (Issue #145)", () => {
  const postsCollection = defineCollection({
    name: "posts",
    label: "Blog Posts",
    group: "Content",
    fields: {
      title: f.text(),
    },
  });

  const ordersCollection = defineCollection({
    name: "orders",
    label: "Customer Orders",
    group: "Sales",
    fields: {
      orderNumber: f.text(),
    },
  });

  const availableCollections = [postsCollection, ordersCollection];

  const sampleMenuConfig: NavigationMenuConfig = {
    groups: [
      {
        id: "group_sales_suite",
        title: "Sales Suite",
        hidden: false,
        items: [
          {
            id: "item_orders",
            type: "collection",
            collectionName: "orders",
            label: "Orders Management",
            href: "/orders",
            badge: 12,
            hidden: false,
          },
          {
            id: "link_external_stripe",
            type: "external",
            label: "Stripe Dashboard",
            href: "https://dashboard.stripe.com",
            external: true,
            target: "_blank",
            hidden: false,
          },
        ],
      },
      {
        id: "group_publishing",
        title: "Publishing & Media",
        hidden: false,
        items: [
          {
            id: "item_posts",
            type: "collection",
            collectionName: "posts",
            label: "Articles & Posts",
            href: "/posts",
            hidden: false,
          },
          {
            id: "item_internal_analytics",
            type: "custom_link",
            label: "Internal Analytics",
            href: "/analytics",
            hidden: false,
          },
        ],
      },
    ],
  };

  it("renders SidebarCustomizer with groups, titles, and item badges", () => {
    const html = renderToString(
      <SidebarCustomizer
        availableCollections={availableCollections}
        menuConfig={sampleMenuConfig}
        onChange={vi.fn()}
        onReset={vi.fn()}
      />
    );

    expect(html).toContain("data-testid=\"sidebar-customizer\"");
    expect(html).toContain("data-testid=\"menu-group-group_sales_suite\"");
    expect(html).toContain("data-testid=\"menu-group-group_publishing\"");
    expect(html).toContain("Sales Suite");
    expect(html).toContain("Publishing &amp; Media");
    expect(html).toContain("Orders Management");
    expect(html).toContain("Stripe Dashboard");
    expect(html).toContain("Articles &amp; Posts");
    expect(html).toContain("Reset to Default");
  });

  it("renders NavigationMenuBuilderDialog with live preview when open", () => {
    const closedHtml = renderToString(
      <NavigationMenuBuilderDialog
        open={false}
        onOpenChange={vi.fn()}
        availableCollections={availableCollections}
      />
    );
    expect(closedHtml).toBe("");

    const openHtml = renderToString(
      <NavigationMenuBuilderDialog
        open={true}
        onOpenChange={vi.fn()}
        availableCollections={availableCollections}
        initialConfig={sampleMenuConfig}
      />
    );

    expect(openHtml).toContain("data-testid=\"navigation-menu-builder-dialog\"");
    expect(openHtml).toContain("Navigation Menu Builder");
    expect(openHtml).toContain("data-testid=\"live-sidebar-preview\"");
    expect(openHtml).toContain("Live Preview");
    expect(openHtml).toContain("Orders Management");
    expect(openHtml).toContain("Stripe Dashboard");
    expect(openHtml).toContain("Save Navigation");
  });

  it("applies menuConfig in WorkspaceSidebar rendering customized groups and external links", () => {
    const mockApp = {
      title: "Enterprise ERP",
      collections: availableCollections,
    } as any;

    const html = renderToString(
      <SidebarProvider>
        <WorkspaceSidebar
          app={mockApp}
          menuConfig={sampleMenuConfig}
          pathname="/orders"
        />
      </SidebarProvider>
    );

    expect(html).toContain("Sales Suite");
    expect(html).toContain("Publishing &amp; Media");
    expect(html).toContain("Orders Management");
    expect(html).toContain("Stripe Dashboard");
    expect(html).toContain("target=\"_blank\"");
    expect(html).toContain("rel=\"noopener noreferrer\"");
  });

  it("builds and applies default navigation when no custom menuConfig is provided", () => {
    const defaultConfig = buildDefaultNavigation(availableCollections);
    expect(defaultConfig.groups.length).toBeGreaterThanOrEqual(2);

    const mockApp = {
      title: "Enterprise ERP",
      collections: availableCollections,
    } as any;

    const html = renderToString(
      <SidebarProvider>
        <WorkspaceSidebar
          app={mockApp}
          menuConfig={defaultConfig}
          pathname="/posts"
        />
      </SidebarProvider>
    );

    expect(html).toContain("Blog Posts");
    expect(html).toContain("Customer Orders");
  });
});
