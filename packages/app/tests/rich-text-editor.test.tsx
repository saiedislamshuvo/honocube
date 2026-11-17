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
  RichTextEditor,
} from "../src/index.js";

describe("Rich Text & WYSIWYG Content Editor Field (Issue #119)", () => {
  describe("f.richText() Fluent Builder", () => {
    it("builds a rich text field config with default properties", () => {
      const field = f.richText("Product Description").build();

      expect(field.type).toBe("richtext");
      expect(field.label).toBe("Product Description");
      expect(field.minHeight).toBe(180);
      expect(field.format).toBe("html");
    });

    it("supports fluent chaining of toolbar tools, heights, and format", () => {
      const field = f
        .richText("Article Body")
        .toolbar(["headings", "bold", "italic", "bulletList", "link"])
        .minHeight(250)
        .maxHeight(600)
        .format("markdown")
        .build();

      expect(field.toolbar).toEqual(["headings", "bold", "italic", "bulletList", "link"]);
      expect(field.minHeight).toBe(250);
      expect(field.maxHeight).toBe(600);
      expect(field.format).toBe("markdown");
    });

    it("supports f.richtext alias", () => {
      const field = f.richtext("Terms & Conditions").minHeight(300).build();

      expect(field.type).toBe("richtext");
      expect(field.minHeight).toBe(300);
    });
  });

  describe("RichTextEditor Component Rendering", () => {
    it("renders formatting toolbar buttons and content editable area", () => {
      const html = renderToString(
        <RichTextEditor
          name="content"
          placeholder="Start typing your article..."
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("Start typing your article...");
      expect(html.toLowerCase()).toContain('contenteditable="true"');
      expect(html).toContain("role=\"textbox\"");
      expect(html).toContain("aria-multiline=\"true\"");
      // Toolbar action buttons
      expect(html).toContain("Bold (Ctrl+B)");
      expect(html).toContain("Italic (Ctrl+I)");
      expect(html).toContain("Underline (Ctrl+U)");
      expect(html).toContain("Bullet List");
      expect(html).toContain("Numbered List");
      expect(html).toContain("Link");
      expect(html).toContain("Clear");
      // Mode switches
      expect(html).toContain("Visual");
      expect(html).toContain("HTML");
    });

    it("renders initial formatted HTML inside the editor and computes word/char counts", () => {
      const initialContent = "<h2>Welcome</h2><p>This is a <strong>rich text</strong> test.</p>";
      const html = renderToString(
        <RichTextEditor
          name="content"
          value={initialContent}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("<h2>Welcome</h2><p>This is a <strong>rich text</strong> test.</p>");
      expect(html).toContain("words");
      expect(html).toContain("chars");
    });

    it("renders read-only preview mode with prose typography", () => {
      const initialContent = "<p>Legal terms and <em>confidentiality</em> agreements.</p>";
      const html = renderToString(
        <RichTextEditor
          name="content"
          value={initialContent}
          readOnly={true}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("Legal terms and <em>confidentiality</em> agreements.");
      expect(html).toContain("prose");
      expect(html).not.toContain("Bold (Ctrl+B)");
      expect(html).not.toContain("contenteditable=\"true\"");
    });

    it("applies error outline styling when hasError is true", () => {
      const html = renderToString(
        <RichTextEditor name="content" hasError={true} onChange={vi.fn()} />
      );

      expect(html).toContain("border-destructive");
      expect(html).toContain("ring-destructive");
    });
  });

  describe("FormField Integration in FormView", () => {
    it("renders rich text editor field inside FormView with initial HTML values", () => {
      const articles = defineCollection({
        name: "articles",
        fields: {
          title: f.text("Article Title").required(),
          body: f.richText("Body Content").minHeight(220),
        },
      });

      const app = defineApp({
        title: "CMS Publishing App",
        apiBaseUrl: "/api",
        collections: [articles],
      });

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <AppProvider app={app}>
            <FormView
              collection={articles}
              initialValues={{
                title: "Announcing HonoCube 2.0",
                body: "<h3>Next Gen Framework</h3><p>Features <strong>zero config</strong> admin dashboards.</p>",
              }}
            />
          </AppProvider>
        </QueryClientProvider>
      );

      expect(html).toContain("Announcing HonoCube 2.0");
      expect(html).toContain("Body Content");
      expect(html).toContain("<h3>Next Gen Framework</h3><p>Features <strong>zero config</strong> admin dashboards.</p>");
      expect(html.toLowerCase()).toContain('contenteditable="true"');
      expect(html).toContain("Bold (Ctrl+B)");
    });
  });
});
