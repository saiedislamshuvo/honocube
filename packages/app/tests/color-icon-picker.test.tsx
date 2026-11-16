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
  ColorPickerField,
  IconPickerField,
  FormField,
  DEFAULT_COLOR_PRESETS,
  DEFAULT_ICON_REGISTRY,
} from "../src/index.js";

describe("Visual Color Picker and Icon Picker Controls (Issue #127)", () => {
  describe("f.color() & f.icon() Fluent Builders", () => {
    it("builds color field with default and custom swatch presets", () => {
      const colorField = f.color("Badge Color")
        .presets(["#EF4444", "#3B82F6", "#10B981"])
        .format("hex")
        .build();

      expect(colorField.type).toBe("color");
      expect(colorField.label).toBe("Badge Color");
      expect(colorField.presets).toEqual(["#EF4444", "#3B82F6", "#10B981"]);
      expect(colorField.format).toBe("hex");
    });

    it("builds icon field with optional custom icon list", () => {
      const iconField = f.icon("Nav Icon")
        .icons(["tag", "folder", "star"])
        .build();

      expect(iconField.type).toBe("icon");
      expect(iconField.label).toBe("Nav Icon");
      expect(iconField.icons).toEqual(["tag", "folder", "star"]);
    });
  });

  describe("ColorPickerField Component", () => {
    it("renders swatch trigger and hex code input", () => {
      const html = renderToString(
        <ColorPickerField
          name="color"
          value="#3B82F6"
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("data-testid=\"color-picker-container\"");
      expect(html).toContain("data-testid=\"color-swatch-trigger\"");
      expect(html).toContain("data-testid=\"color-swatch-preview\"");
      expect(html).toContain("data-testid=\"color-hex-input\"");
      expect(html).toContain("value=\"#3B82F6\"");
      expect(html).toContain("data-testid=\"color-clear-btn\"");
    });

    it("omits clear button when value is empty", () => {
      const html = renderToString(
        <ColorPickerField
          name="color"
          value=""
          onChange={vi.fn()}
        />
      );

      expect(html).not.toContain("data-testid=\"color-clear-btn\"");
    });

    it("includes DEFAULT_COLOR_PRESETS with enterprise swatches", () => {
      expect(DEFAULT_COLOR_PRESETS.length).toBeGreaterThanOrEqual(10);
      expect(DEFAULT_COLOR_PRESETS).toContain("#EF4444");
      expect(DEFAULT_COLOR_PRESETS).toContain("#3B82F6");
      expect(DEFAULT_COLOR_PRESETS).toContain("#10B981");
    });
  });

  describe("IconPickerField Component", () => {
    it("renders trigger button with icon preview and icon name", () => {
      const html = renderToString(
        <IconPickerField
          name="icon"
          value="tag"
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("data-testid=\"icon-picker-container\"");
      expect(html).toContain("data-testid=\"icon-picker-trigger\"");
      expect(html).toContain("tag");
      expect(html).toContain("data-testid=\"icon-clear-btn\"");
    });

    it("renders placeholder when no icon is selected", () => {
      const html = renderToString(
        <IconPickerField
          name="icon"
          value=""
          placeholder="Choose marker icon..."
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("Choose marker icon...");
      expect(html).not.toContain("data-testid=\"icon-clear-btn\"");
    });

    it("includes rich DEFAULT_ICON_REGISTRY with common enterprise icons", () => {
      expect(DEFAULT_ICON_REGISTRY.tag).toBeDefined();
      expect(DEFAULT_ICON_REGISTRY.settings).toBeDefined();
      expect(DEFAULT_ICON_REGISTRY.folder).toBeDefined();
      expect(DEFAULT_ICON_REGISTRY["check-circle"]).toBeDefined();
      expect(DEFAULT_ICON_REGISTRY.bell).toBeDefined();
    });
  });

  describe("FormField & FormView Integration", () => {
    it("renders ColorPickerField and IconPickerField within FormField", () => {
      const colorHtml = renderToString(
        <FormField
          name="color"
          field={{ type: "color", label: "Priority Color" }}
          fieldState={{ value: "#10B981", errors: [] } as any}
          onChange={vi.fn()}
        />
      );

      expect(colorHtml).toContain("Priority Color");
      expect(colorHtml).toContain("data-testid=\"color-picker-container\"");

      const iconHtml = renderToString(
        <FormField
          name="icon"
          field={{ type: "icon", label: "Category Icon" }}
          fieldState={{ value: "folder", errors: [] } as any}
          onChange={vi.fn()}
        />
      );

      expect(iconHtml).toContain("Category Icon");
      expect(iconHtml).toContain("data-testid=\"icon-picker-container\"");
      expect(iconHtml).toContain("folder");
    });

    it("renders color and icon fields inside full FormView schema", () => {
      const categories = defineCollection({
        name: "categories",
        fields: {
          id: { type: "text" },
          name: { type: "text", label: "Category Name" },
          color: f.color("Color Theme").presets(["#3B82F6", "#EF4444"]),
          icon: f.icon("Display Icon"),
        },
      });

      const app = defineApp({
        title: "Category Manager",
        apiBaseUrl: "https://api.example.com",
        collections: [categories],
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
              collection={categories}
              initialValues={{
                name: "High Priority",
                color: "#EF4444",
                icon: "alert-circle",
              }}
            />
          </AppProvider>
        </QueryClientProvider>
      );

      expect(html).toContain("data-testid=\"color-picker-container\"");
      expect(html).toContain("value=\"#EF4444\"");
      expect(html).toContain("data-testid=\"icon-picker-container\"");
      expect(html).toContain("alert-circle");
    });
  });
});
