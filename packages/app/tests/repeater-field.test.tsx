import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  defineApp,
  defineCollection,
  f,
  AppProvider,
  FormView,
  FormField,
  RepeaterField,
} from "../src/index.js";

describe("Dynamic Form Repeater for Arbitrary Nested Field Groups (Issue #129)", () => {
  describe("f.repeater() Fluent Builder", () => {
    it("builds repeater with nested child fields schema and constraints", () => {
      const repeater = f.repeater("Invoice Line Items", {
        description: f.text("Item Description"),
        quantity: f.number("Qty"),
        unitPrice: f.currency("Unit Price"),
      })
        .minItems(1)
        .maxItems(10)
        .layout("table")
        .addButtonText("Add Line")
        .itemLabel("Line")
        .collapsible(false)
        .allowReorder(true)
        .allowClone(true)
        .build();

      expect(repeater.type).toBe("repeater");
      expect(repeater.label).toBe("Invoice Line Items");
      expect(repeater.fields).toBeDefined();
      expect(repeater.fields?.description).toBeDefined();
      expect(repeater.minItems).toBe(1);
      expect(repeater.maxItems).toBe(10);
      expect(repeater.layout).toBe("table");
      expect(repeater.addButtonText).toBe("Add Line");
      expect(repeater.itemLabel).toBe("Line");
      expect(repeater.collapsible).toBe(false);
      expect(repeater.allowReorder).toBe(true);
      expect(repeater.allowClone).toBe(true);
    });

    it("supports direct field map invocation", () => {
      const rep = f.repeater({
        task: f.text("Task"),
        completed: f.boolean("Done"),
      }, "Project Tasks").build();

      expect(rep.type).toBe("repeater");
      expect(rep.label).toBe("Project Tasks");
      expect(rep.fields?.task).toBeDefined();
    });
  });

  describe("RepeaterField Component Rendering", () => {
    const sampleItems = [
      { description: "Consulting Services", quantity: 10, unitPrice: 150 },
      { description: "Software License", quantity: 1, unitPrice: 500 },
    ];

    it("renders empty state when array is empty", () => {
      const html = renderToString(
        <RepeaterField
          name="items"
          label="Line Items"
          value={[]}
          addButtonText="Add Line"
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("data-testid=\"repeater-field-container\"");
      expect(html).toContain("Line Items");
      expect(html).toContain("data-testid=\"repeater-empty-state\"");
      expect(html).toContain("data-testid=\"repeater-add-btn\"");
      expect(html).toContain("Add Line");
      expect(html).toContain("(0 items)");
    });

    it("renders item cards in default cards layout", () => {
      const html = renderToString(
        <RepeaterField
          name="items"
          label="Line Items"
          itemLabel="Line Item"
          value={sampleItems}
          fields={{
            description: { type: "text", label: "Description" },
            quantity: { type: "number", label: "Qty" },
          }}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("data-testid=\"repeater-field-container\"");
      expect(html).toContain("(2 items)");
      expect(html).toContain("Consulting Services");
      expect(html).toContain("Software License");
      expect(html).toContain("data-testid=\"repeater-item-delete\"");
      expect(html).toContain("data-testid=\"repeater-item-clone\"");
      expect(html).toContain("data-testid=\"repeater-item-move-up\"");
      expect(html).toContain("data-testid=\"repeater-item-move-down\"");
    });

    it("renders concise tabular structure in table layout mode", () => {
      const html = renderToString(
        <RepeaterField
          name="items"
          layout="table"
          value={sampleItems}
          fields={{
            description: { type: "text", label: "Description" },
            quantity: { type: "number", label: "Qty" },
          }}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("<table");
      expect(html).toContain("Description");
      expect(html).toContain("Qty");
      expect(html).toContain("Consulting Services");
    });

    it("respects maxItems by hiding add button when threshold is reached", () => {
      const html = renderToString(
        <RepeaterField
          name="items"
          value={sampleItems}
          maxItems={2}
          onChange={vi.fn()}
        />
      );

      expect(html).not.toContain("data-testid=\"repeater-add-btn\"");
      expect(html).toContain("max 2");
    });

    it("suppresses action buttons in disabled / readOnly state", () => {
      const html = renderToString(
        <RepeaterField
          name="items"
          value={sampleItems}
          disabled={true}
          onChange={vi.fn()}
        />
      );

      expect(html).not.toContain("data-testid=\"repeater-add-btn\"");
      expect(html).not.toContain("data-testid=\"repeater-item-delete\"");
      expect(html).not.toContain("data-testid=\"repeater-item-clone\"");
    });
  });

  describe("FormField & FormView Integration", () => {
    it("renders RepeaterField within FormField", () => {
      const html = renderToString(
        <FormField
          name="specifications"
          field={{
            type: "repeater",
            label: "Product Specs",
            fields: {
              attr: { type: "text", label: "Attribute" },
              val: { type: "text", label: "Value" },
            },
          }}
          fieldState={{
            value: [{ attr: "Weight", val: "1.2kg" }],
            errors: [],
          } as any}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("Product Specs");
      expect(html).toContain("data-testid=\"repeater-field-container\"");
      expect(html).toContain("Weight");
      expect(html).toContain("1.2kg");
    });

    it("renders repeater inside FormView schema", () => {
      const products = defineCollection({
        name: "products",
        fields: {
          id: { type: "text" },
          name: { type: "text", label: "Product Name" },
          pricingTiers: f.repeater("Pricing Tiers", {
            tierName: f.text("Tier Name"),
            minQty: f.number("Min Units"),
            discountPct: f.number("Discount %"),
          }).addButtonText("+ Add Tier"),
        },
      });

      const app = defineApp({
        title: "Product Catalog",
        apiBaseUrl: "https://api.example.com",
        collections: [products],
      });

      const queryClient = new QueryClient();
      const mockClient: any = {
        apiBaseUrl: "https://api.example.com",
        get: vi.fn(),
      };

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <AppProvider app={app} client={mockClient}>
            <FormView
              collection={products}
              initialValues={{
                name: "Enterprise Database",
                pricingTiers: [
                  { tierName: "Tier 1", minQty: 10, discountPct: 5 },
                  { tierName: "Tier 2", minQty: 50, discountPct: 15 },
                ],
              }}
            />
          </AppProvider>
        </QueryClientProvider>
      );

      expect(html).toContain("Pricing Tiers");
      expect(html).toContain("data-testid=\"repeater-field-container\"");
      expect(html).toContain("Tier 1");
      expect(html).toContain("Tier 2");
      expect(html).toContain("+ Add Tier");
    });
  });
});
