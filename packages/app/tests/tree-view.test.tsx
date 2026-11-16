import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  defineApp,
  defineCollection,
  AppProvider,
  ThemeProvider,
  TreeView,
  ViewSwitcher,
  CollectionMultiView,
  queryKeys,
} from "../src/index.js";

describe("Hierarchical Tree View (Issue #114)", () => {
  // Nested Category hierarchy collection
  const categories = defineCollection({
    name: "categories",
    label: "Product Categories",
    singular: "Category",
    fields: {
      id: { type: "text", label: "Category ID" },
      name: { type: "text", label: "Category Name", required: true },
      slug: { type: "text", label: "URL Slug" },
      parentId: { type: "text", label: "Parent Category" },
      description: { type: "text", label: "Description" },
      status: {
        type: "select",
        label: "Status",
        options: [
          { label: "Active", value: "active" },
          { label: "Archived", value: "archived" },
        ],
        default: "active",
      },
      sortOrder: { type: "number", label: "Display Order", default: 0 },
    },
    table: {
      columns: ["id", "name", "parentId", "status"],
    },
    tree: {
      parentField: "parentId",
      titleField: "name",
      descriptionField: "description",
      badgeField: "status",
      orderField: "sortOrder",
      initialExpandedDepth: 2,
    },
    defaultView: "tree",
  });

  const app = defineApp({
    title: "E-Commerce Admin",
    apiBaseUrl: "https://api.store.example.com",
    collections: [categories],
  });

  const mockCategories = [
    {
      id: "cat-electronics",
      name: "Electronics",
      parentId: null,
      description: "Consumer electronics and gadgets",
      status: "active",
      sortOrder: 1,
    },
    {
      id: "cat-computers",
      name: "Computers & Tablets",
      parentId: "cat-electronics",
      description: "Laptops, desktops, and tablets",
      status: "active",
      sortOrder: 1,
    },
    {
      id: "cat-laptops",
      name: "Laptops",
      parentId: "cat-computers",
      description: "High performance laptops",
      status: "active",
      sortOrder: 1,
    },
    {
      id: "cat-phones",
      name: "Smartphones",
      parentId: "cat-electronics",
      description: "Cellphones and mobile accessories",
      status: "active",
      sortOrder: 2,
    },
    {
      id: "cat-clothing",
      name: "Clothing & Apparel",
      parentId: null,
      description: "Fashion, apparel, and footwear",
      status: "active",
      sortOrder: 2,
    },
    {
      id: "cat-shirts",
      name: "T-Shirts",
      parentId: "cat-clothing",
      description: "Casual and graphic tees",
      status: "active",
      sortOrder: 1,
    },
  ];

  it("renders hierarchical multi-level tree structure with correct nesting and child counts", () => {
    const html = renderToString(
      <TreeView
        collection={categories}
        data={mockCategories}
        initialExpandedDepth={2}
      />
    );

    // Root nodes rendered
    expect(html).toContain("Electronics");
    expect(html).toContain("Clothing &amp; Apparel");

    // Nested children rendered
    expect(html).toContain("Computers &amp; Tablets");
    expect(html).toContain("Smartphones");
    expect(html).toContain("T-Shirts");

    // Descriptions rendered
    expect(html).toContain("Consumer electronics and gadgets");
    expect(html).toContain("Casual and graphic tees");

    // Badges rendered
    expect(html).toContain("active");

    // Roles and accessibility
    expect(html).toContain('role="tree"');
    expect(html).toContain('role="treeitem"');
    expect(html).toContain('aria-label="Product Categories"');

    // Toolbar controls rendered
    expect(html).toContain("Search Product Categories...");
    expect(html).toContain("Expand All");
    expect(html).toContain("Collapse All");
  });

  it("respects initialExpandedDepth and collapses nodes beyond initial depth", () => {
    // With initialExpandedDepth = 1, only root categories (depth 0) are expanded.
    // cat-computers (depth 1) is collapsed, so its children (cat-laptops) are not expanded in SSR
    const html = renderToString(
      <TreeView
        collection={categories}
        data={mockCategories}
        initialExpandedDepth={1}
      />
    );

    expect(html).toContain("Electronics");
    expect(html).toContain("Computers &amp; Tablets");
    // cat-computers is collapsed, so cat-laptops should not be rendered
    expect(html).not.toContain("High performance laptops");
  });

  it("handles empty data and displays custom empty text", () => {
    const html = renderToString(
      <TreeView
        collection={categories}
        data={[]}
        emptyText="No categories declared yet."
      />
    );

    expect(html).toContain("No categories declared yet.");
    expect(html).not.toContain('role="treeitem"');
  });

  it("sorts sibling nodes by orderField", () => {
    const unorderedItems = [
      { id: "root-1", name: "Root Item", parentId: null },
      { id: "child-z", name: "Zebra Child", parentId: "root-1", sortOrder: 99 },
      { id: "child-a", name: "Apple Child", parentId: "root-1", sortOrder: 1 },
      { id: "child-m", name: "Mango Child", parentId: "root-1", sortOrder: 10 },
    ];

    const html = renderToString(
      <TreeView
        collection={categories}
        data={unorderedItems}
        initialExpandedDepth={2}
        orderField="sortOrder"
      />
    );

    const posApple = html.indexOf("Apple Child");
    const posMango = html.indexOf("Mango Child");
    const posZebra = html.indexOf("Zebra Child");

    expect(posApple).toBeGreaterThan(-1);
    expect(posMango).toBeGreaterThan(posApple);
    expect(posZebra).toBeGreaterThan(posMango);
  });

  it("safely handles cyclical parent references without infinite recursion", () => {
    const cyclicData = [
      { id: "node-1", name: "Node 1", parentId: "node-2" },
      { id: "node-2", name: "Node 2", parentId: "node-1" },
    ];

    const html = renderToString(
      <TreeView
        collection={categories}
        data={cyclicData}
        initialExpandedDepth={2}
      />
    );

    expect(html).toContain("Node 1");
    expect(html).toContain("Node 2");
  });

  it("renders add child action button when onAddChild callback is provided", () => {
    const handleAddChild = vi.fn();

    const html = renderToString(
      <TreeView
        collection={categories}
        data={mockCategories}
        onAddChild={handleAddChild}
      />
    );

    expect(html).toContain('aria-label="Add child to Electronics"');
    expect(html).toContain('title="Add child to Electronics"');
  });

  it("renders ViewSwitcher with Tree view icon and label", () => {
    const handleViewChange = vi.fn();

    const html = renderToString(
      <ViewSwitcher
        activeView="tree"
        onViewChange={handleViewChange}
        availableViews={["table", "tree", "list"]}
      />
    );

    expect(html).toContain("Tree");
    expect(html).toContain("Table");
    expect(html).toContain("List");
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-label="Tree view"');
  });

  it("integrates into CollectionMultiView and activates tree view by default", () => {
    const queryClient = new QueryClient();
    const queryKey = queryKeys.collection.list("categories", { limit: 500 });
    queryClient.setQueryData(queryKey, {
      success: true,
      data: mockCategories,
      meta: { pagination: { total: 6 } },
    });

    const customClient: any = {
      apiBaseUrl: "https://api.store.example.com",
      get: vi.fn(),
    };

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <AppProvider app={app} client={customClient}>
          <CollectionMultiView
            collection={categories}
            actions={<button id="add-root-btn">+ Add Root Category</button>}
          />
        </AppProvider>
      </QueryClientProvider>
    );

    // Collection title and actions rendered
    expect(html).toContain("Product Categories");
    expect(html).toContain("+ Add Root Category");

    // ViewSwitcher contains Tree option
    expect(html).toContain("Tree");
    expect(html).toContain("Table");

    // Active tree view rendered
    expect(html).toContain("Electronics");
    expect(html).toContain("Clothing &amp; Apparel");
  });

  it("supports theme customization for tree view slot in HonoCubeTheme", () => {
    const queryClient = new QueryClient();
    const queryKey = queryKeys.collection.list("categories", { limit: 500 });
    queryClient.setQueryData(queryKey, {
      success: true,
      data: mockCategories,
      meta: { pagination: { total: 6 } },
    });

    const customClient: any = {
      apiBaseUrl: "https://api.store.example.com",
      get: vi.fn(),
    };

    // Custom theme replacing TreeView with custom tree layout
    const customTheme = {
      name: "custom-tree-theme",
      components: {
        views: {
          tree: ({ collection }: any) => (
            <div data-testid="custom-tree-view">
              <h3>{`Custom Tree: ${collection.label}`}</h3>
            </div>
          ),
        },
      },
    };

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <AppProvider app={app} client={customClient}>
          <ThemeProvider themeContract={customTheme}>
            <CollectionMultiView
              collection={categories}
              defaultView="tree"
            />
          </ThemeProvider>
        </AppProvider>
      </QueryClientProvider>
    );

    expect(html).toContain("Custom Tree: Product Categories");
  });

  it("supports defaultExpandedKeys for explicit controlled node expansion", () => {
    // Only expand cat-clothing, keep cat-electronics collapsed
    const html = renderToString(
      <TreeView
        collection={categories}
        data={mockCategories}
        defaultExpandedKeys={["cat-clothing"]}
      />
    );

    // cat-clothing children (T-Shirts) rendered
    expect(html).toContain("T-Shirts");
    // cat-electronics children not expanded
    expect(html).not.toContain("Computers &amp; Tablets");
    expect(html).not.toContain("Smartphones");
  });

  it("enables draggable attribute when allowDragAndDrop is true", () => {
    const html = renderToString(
      <TreeView
        collection={categories}
        data={mockCategories}
        allowDragAndDrop={true}
      />
    );

    expect(html).toContain('draggable="true"');
  });

  it("renders extra actions in toolbar when actions prop is provided", () => {
    const html = renderToString(
      <TreeView
        collection={categories}
        data={mockCategories}
        actions={<button id="custom-tree-action">Export Tree</button>}
      />
    );

    expect(html).toContain("Export Tree");
  });
});
