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
  TagsInputField,
  FormField,
} from "../src/index.js";

describe("Tags Input and Multi-Select Chip Control (Issue #126)", () => {
  describe("f.tags() Fluent Builder", () => {
    it("builds a tags field config with default properties", () => {
      const tagsField = f.tags("Article Tags").build();

      expect(tagsField.type).toBe("tags");
      expect(tagsField.label).toBe("Article Tags");
    });

    it("supports chained builder methods", () => {
      const customTags = f.tags("Skill Badges")
        .maxTags(5)
        .suggestions(["React", "TypeScript", "Node.js"])
        .delimiters([",", ";", "Enter"])
        .allowDuplicates(false)
        .build();

      expect(customTags.type).toBe("tags");
      expect(customTags.maxTags).toBe(5);
      expect(customTags.suggestions).toEqual(["React", "TypeScript", "Node.js"]);
      expect(customTags.delimiters).toEqual([",", ";", "Enter"]);
      expect(customTags.allowDuplicates).toBe(false);
    });
  });

  describe("TagsInputField Component", () => {
    it("renders active tag badges and inline input", () => {
      const html = renderToString(
        <TagsInputField
          name="tags"
          value={["frontend", "react", "ui"]}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("data-testid=\"tags-input-container\"");
      expect(html).toContain("frontend");
      expect(html).toContain("react");
      expect(html).toContain("ui");
      expect(html).toContain("data-testid=\"tag-badge-0\"");
      expect(html).toContain("data-testid=\"remove-tag-btn-0\"");
      expect(html).toContain("data-testid=\"tags-input\"");
    });

    it("parses comma-separated string value into tags", () => {
      const html = renderToString(
        <TagsInputField
          name="tags"
          value="finance, accounting, tax"
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("finance");
      expect(html).toContain("accounting");
      expect(html).toContain("tax");
    });

    it("renders placeholder when tag list is empty", () => {
      const html = renderToString(
        <TagsInputField
          name="tags"
          value={[]}
          placeholder="Enter skills..."
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("placeholder=\"Enter skills...\"");
    });

    it("renders clickable suggestion chips when suggestions are provided", () => {
      const html = renderToString(
        <TagsInputField
          name="tags"
          value={["react"]}
          suggestions={["react", "vue", "angular", "svelte"]}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("Suggestions:");
      expect(html).toContain("data-testid=\"suggestion-chip-vue\"");
      expect(html).toContain("data-testid=\"suggestion-chip-angular\"");
      expect(html).toContain("data-testid=\"suggestion-chip-svelte\"");
      // Already selected suggestion should not appear as unselected suggestion
      expect(html).not.toContain("data-testid=\"suggestion-chip-react\"");
    });

    it("hides inline input when maxTags limit is reached", () => {
      const html = renderToString(
        <TagsInputField
          name="tags"
          value={["one", "two", "three"]}
          maxTags={3}
          onChange={vi.fn()}
        />
      );

      expect(html).not.toContain("data-testid=\"tags-input\"");
    });

    it("omits remove buttons and disables input when disabled", () => {
      const html = renderToString(
        <TagsInputField
          name="tags"
          value={["alpha", "beta"]}
          disabled={true}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("alpha");
      expect(html).toContain("beta");
      expect(html).not.toContain("data-testid=\"remove-tag-btn-0\"");
      expect(html).not.toContain("data-testid=\"tags-input\"");
    });
  });

  describe("FormField and FormView Integration", () => {
    it("renders TagsInputField within FormField when field.type is tags", () => {
      const html = renderToString(
        <FormField
          name="skills"
          field={{
            type: "tags",
            label: "Developer Skills",
            suggestions: ["TypeScript", "Rust"],
          }}
          fieldState={{
            value: ["TypeScript"],
            errors: [],
          } as any}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("Developer Skills");
      expect(html).toContain("data-testid=\"tags-input-container\"");
      expect(html).toContain("TypeScript");
      expect(html).toContain("data-testid=\"suggestion-chip-Rust\"");
    });

    it("renders tags field properly in full FormView schema", () => {
      const articles = defineCollection({
        name: "articles",
        fields: {
          id: { type: "text" },
          title: { type: "text", label: "Title" },
          keywords: f.tags("Keywords").suggestions(["News", "Tech", "Security"]),
        },
      });

      const app = defineApp({
        title: "Newsroom",
        apiBaseUrl: "https://api.example.com",
        collections: [articles],
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
              collection={articles}
              initialValues={{
                title: "Cybersecurity Brief",
                keywords: ["Security", "Tech"],
              }}
            />
          </AppProvider>
        </QueryClientProvider>
      );

      expect(html).toContain("data-testid=\"tags-input-container\"");
      expect(html).toContain("Security");
      expect(html).toContain("Tech");
      expect(html).toContain("data-testid=\"suggestion-chip-News\"");
    });
  });
});
