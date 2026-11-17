import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  f,
  FormField,
  InlineEntityCreationDialog,
  ForeignKeySelector,
} from "../src/index.js";

describe("Inline Foreign Key Entity Creation (Issue #147)", () => {
  describe("f.select() Fluent Builder Extensions", () => {
    it("configures select field with .createInline() and .target()", () => {
      const field = f.select("category", [
        { label: "Hardware", value: "hw" },
        { label: "Software", value: "sw" },
      ])
        .target("categories")
        .createInline(true, {
          title: "New Category",
          description: "Create a new product category inline",
        })
        .build();

      expect(field.type).toBe("select");
      expect(field.target).toBe("categories");
      expect(field.createInline).toBe(true);
      expect(field.createTitle).toBe("New Category");
      expect(field.createDescription).toBe("Create a new product category inline");
      expect(field.options).toHaveLength(2);
    });

    it("defaults createInline to true when calling .createInline() without arguments", () => {
      const field = f.select("brand")
        .target("brands")
        .createInline()
        .build();

      expect(field.createInline).toBe(true);
      expect(field.target).toBe("brands");
    });
  });

  describe("InlineEntityCreationDialog Component", () => {
    it("renders SSR fallback when document is undefined and open is true", () => {
      const html = renderToString(
        <InlineEntityCreationDialog
          open={true}
          onOpenChange={vi.fn()}
          target="brands"
          title="Create Brand"
          onSuccess={vi.fn()}
        />
      );

      expect(html).toContain("data-testid=\"inline-entity-creation-dialog\"");
      expect(html).toContain("Create Brand");
      expect(html).toContain("data-testid=\"inline-create-submit-btn\"");
    });

    it("returns null when open is false", () => {
      const html = renderToString(
        <InlineEntityCreationDialog
          open={false}
          onOpenChange={vi.fn()}
          target="brands"
          onSuccess={vi.fn()}
        />
      );

      expect(html).toBe("");
    });
  });

  describe("ForeignKeySelector Component", () => {
    it("renders label, description, required indicator and async combobox trigger", () => {
      const html = renderToString(
        <ForeignKeySelector
          name="supplierId"
          target="suppliers"
          label="Vendor / Supplier"
          description="Select an existing vendor or add a new one inline."
          required={true}
          value={null}
          placeholder="Choose vendor..."
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("data-testid=\"foreign-key-selector\"");
      expect(html).toContain("Vendor / Supplier");
      expect(html).toContain("*");
      expect(html).toContain("Select an existing vendor or add a new one inline.");
      expect(html).toContain("Choose vendor...");
      // By default createInline is true, so quick-add button is rendered
      expect(html).toContain("data-testid=\"async-combobox-quick-add\"");
    });

    it("can disable inline creation by passing createInline={false}", () => {
      const html = renderToString(
        <ForeignKeySelector
          name="supplierId"
          target="suppliers"
          label="Vendor"
          createInline={false}
          value={null}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("data-testid=\"foreign-key-selector\"");
      expect(html).toContain("Vendor");
      expect(html).not.toContain("data-testid=\"async-combobox-quick-add\"");
    });
  });

  describe("FormField Relation and Select Integration", () => {
    it("enables inline entity creation by default on relation fields (relConfig.createInline ?? true)", () => {
      const html = renderToString(
        <FormField
          name="brandId"
          field={{
            type: "relation",
            target: "brands",
            label: "Product Brand",
          }}
          fieldState={{ value: null, errors: [] } as any}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("Product Brand");
      // Quick add button should appear automatically
      expect(html).toContain("data-testid=\"async-combobox-quick-add\"");
      expect(html).toContain("Create new brands");
    });

    it("respects explicit createInline={false} on relation fields", () => {
      const html = renderToString(
        <FormField
          name="brandId"
          field={{
            type: "relation",
            target: "brands",
            label: "Product Brand",
            createInline: false,
          }}
          fieldState={{ value: null, errors: [] } as any}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("Product Brand");
      expect(html).not.toContain("data-testid=\"async-combobox-quick-add\"");
    });

    it("routes select fields with createInline: true or target to AsyncCombobox with inline creation", () => {
      const html = renderToString(
        <FormField
          name="taxRateId"
          field={{
            type: "select",
            label: "Tax Rate",
            target: "tax_rates",
            createInline: true,
            createTitle: "New Tax Rate",
            options: [
              { label: "Standard (20%)", value: "tax_std" },
              { label: "Reduced (5%)", value: "tax_red" },
            ],
          }}
          fieldState={{ value: null, errors: [] } as any}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("Tax Rate");
      expect(html).toContain("data-testid=\"async-combobox-trigger\"");
      expect(html).toContain("data-testid=\"async-combobox-quick-add\"");
      expect(html).toContain("Create new New Tax Rate");
    });

    it("routes standard select fields without createInline or target to standard Select control", () => {
      const html = renderToString(
        <FormField
          name="status"
          field={{
            type: "select",
            label: "Status",
            options: [
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
            ],
          }}
          fieldState={{ value: "active", errors: [] } as any}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("Status");
      // Should NOT render async combobox quick add
      expect(html).not.toContain("data-testid=\"async-combobox-quick-add\"");
    });
  });
});
