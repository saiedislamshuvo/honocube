import { describe, it, expect } from "vitest";
import {
  defineCollection,
  f,
  buildDefaultNavigation,
  applyNavigationMenu,
  type NavigationMenuConfig,
} from "../src/index.js";

describe("Visual Navigation Menu Builder (Issue #145)", () => {
  const postsCollection = defineCollection({
    name: "posts",
    group: "Content",
    label: "Articles & Blog",
    fields: {
      title: f.text(),
    },
  });

  const ordersCollection = defineCollection({
    name: "orders",
    group: "Sales",
    label: "Customer Orders",
    fields: {
      total: f.number(),
    },
  });

  const customersCollection = defineCollection({
    name: "customers",
    group: "Sales",
    label: "Client Directory",
    fields: {
      name: f.text(),
    },
  });

  it("builds default navigation menu configuration from collections", () => {
    const config = buildDefaultNavigation(
      [postsCollection, ordersCollection, customersCollection],
      [{ label: "Company Portal", href: "https://portal.company.com" }]
    );

    expect(config.groups).toHaveLength(3); // Content, Sales, Quick Links
    expect(config.groups[0].title).toBe("Content");
    expect(config.groups[0].items[0].label).toBe("Articles & Blog");
    expect(config.groups[1].title).toBe("Sales");
    expect(config.groups[1].items).toHaveLength(2);
    expect(config.groups[2].title).toBe("Quick Links");
    expect(config.groups[2].items[0].href).toBe("https://portal.company.com");
  });

  it("transforms and filters menu config into runtime navigation groups", () => {
    const customConfig: NavigationMenuConfig = {
      groups: [
        {
          id: "grp-content",
          title: "Editorial Suite",
          items: [
            {
              id: "item-posts",
              type: "collection",
              label: "Published Stories",
              href: "/posts",
              collectionName: "posts",
            },
          ],
        },
        {
          id: "grp-finance",
          title: "Finance & Accounting",
          roles: ["finance", "executive"],
          items: [
            {
              id: "item-orders",
              type: "collection",
              label: "Sales Ledger",
              href: "/orders",
              collectionName: "orders",
            },
          ],
        },
        {
          id: "grp-hidden",
          title: "Hidden Archive",
          hidden: true,
          items: [
            {
              id: "item-customers",
              type: "collection",
              label: "Customers",
              href: "/customers",
              collectionName: "customers",
            },
          ],
        },
      ],
    };

    // 1. Regular user without finance role
    const regularNav = applyNavigationMenu(
      [postsCollection, ordersCollection, customersCollection],
      customConfig,
      { role: "editor" }
    );
    expect(regularNav).toHaveLength(1);
    expect(regularNav[0].group).toBe("Editorial Suite");
    expect((regularNav[0].items[0] as any).label).toBe("Published Stories");

    // 2. Finance user
    const financeNav = applyNavigationMenu(
      [postsCollection, ordersCollection, customersCollection],
      customConfig,
      { roles: ["finance"] }
    );
    expect(financeNav).toHaveLength(2);
    expect(financeNav[1].group).toBe("Finance & Accounting");
    expect((financeNav[1].items[0] as any).label).toBe("Sales Ledger");

    // 3. Superadmin sees all non-hidden groups
    const superadminNav = applyNavigationMenu(
      [postsCollection, ordersCollection, customersCollection],
      customConfig,
      { roles: ["superadmin"] }
    );
    expect(superadminNav).toHaveLength(2);
  });
});
