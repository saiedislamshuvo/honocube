import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  defineApp,
  defineCollection,
  f,
  slugify,
  AppProvider,
  FormView,
  SlugInputField,
  FormField,
} from "../src/index.js";

describe("Slug Input Field with Auto-derivation and Manual Override Locks (Issue #124)", () => {
  describe("slugify Utility", () => {
    it("transforms simple titles into URL-safe slugs", () => {
      expect(slugify("Summer Linen Shirt")).toBe("summer-linen-shirt");
      expect(slugify("Enterprise Cloud Platform")).toBe("enterprise-cloud-platform");
    });

    it("removes diacritics, accents, and special symbols", () => {
      expect(slugify("Café & Résumé")).toBe("cafe-resume");
      expect(slugify("Hello, World! (2026 Edition)")).toBe("hello-world-2026-edition");
    });

    it("supports custom separators", () => {
      expect(slugify("Custom Slug Value", { separator: "_" })).toBe("custom_slug_value");
    });

    it("supports preserving uppercase when lowercase is false", () => {
      expect(slugify("API-Documentation", { lowercase: false })).toBe("API-Documentation");
    });

    it("handles null, undefined, and empty inputs gracefully", () => {
      expect(slugify("")).toBe("");
      expect(slugify(null)).toBe("");
      expect(slugify(undefined)).toBe("");
    });
  });

  describe("f.slug() Fluent Builder", () => {
    it("builds a slug field config with default properties", () => {
      const slugField = f.slug("Slug URL").from("title").build();

      expect(slugField.type).toBe("slug");
      expect(slugField.label).toBe("Slug URL");
      expect(slugField.from).toBe("title");
      expect(slugField.separator).toBe("-");
      expect(slugField.lowercase).toBe(true);
    });

    it("supports chained customization methods", () => {
      const customSlug = f.slug("URL Identifier")
        .from("headline")
        .separator("_")
        .lowercase(true)
        .locked(true)
        .build();

      expect(customSlug.type).toBe("slug");
      expect(customSlug.from).toBe("headline");
      expect(customSlug.separator).toBe("_");
      expect(customSlug.locked).toBe(true);
    });
  });

  describe("SlugInputField Component", () => {
    it("renders slug input container with lock and sync action buttons", () => {
      const html = renderToString(
        <SlugInputField
          name="slug"
          value="summer-linen-shirt"
          sourceValue="Summer Linen Shirt"
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("data-testid=\"slug-input-container\"");
      expect(html).toContain("data-testid=\"slug-input\"");
      expect(html).toContain("value=\"summer-linen-shirt\"");
      expect(html).toContain("data-testid=\"slug-lock-toggle-btn\"");
      expect(html).toContain("data-testid=\"slug-sync-btn\"");
    });

    it("indicates locked status when slug value is established", () => {
      const html = renderToString(
        <SlugInputField
          name="slug"
          value="existing-slug"
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("data-locked=\"true\"");
    });

    it("renders unlocked when value is empty and locked is not set", () => {
      const html = renderToString(
        <SlugInputField
          name="slug"
          value=""
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("data-locked=\"false\"");
    });
  });

  describe("FormField and FormView Integration", () => {
    it("renders SlugInputField within FormField when field.type is slug", () => {
      const html = renderToString(
        <FormField
          name="slug"
          field={{
            type: "slug",
            label: "Product Slug",
            from: "name",
          }}
          fieldState={{
            value: "my-product-slug",
            errors: [],
          } as any}
          onChange={vi.fn()}
          values={{ name: "My Product Name", slug: "my-product-slug" }}
        />
      );

      expect(html).toContain("Product Slug");
      expect(html).toContain("data-testid=\"slug-input-container\"");
      expect(html).toContain("value=\"my-product-slug\"");
    });

    it("renders slug field inside full FormView schema", () => {
      const products = defineCollection({
        name: "products",
        fields: {
          id: { type: "text" },
          title: { type: "text", label: "Title" },
          slug: f.slug("Slug").from("title"),
        },
      });

      const app = defineApp({
        title: "Catalog",
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
              initialValues={{ title: "Cotton T-Shirt", slug: "cotton-t-shirt" }}
            />
          </AppProvider>
        </QueryClientProvider>
      );

      expect(html).toContain("data-testid=\"slug-input\"");
      expect(html).toContain("value=\"cotton-t-shirt\"");
    });
  });
});
