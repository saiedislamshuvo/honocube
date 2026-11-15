import { describe, it, expect } from "vitest";
import {
  createTheme,
  isHonoCubeTheme,
  resolveTheme,
  type HonoCubeTheme,
} from "../src/index.js";

describe("Theme Contract & Specification (@honocube/core)", () => {
  it("validates theme with isHonoCubeTheme", () => {
    expect(isHonoCubeTheme({ name: "custom" })).toBe(true);
    expect(isHonoCubeTheme(null)).toBe(false);
    expect(isHonoCubeTheme({})).toBe(false);
    expect(isHonoCubeTheme("theme")).toBe(false);
    expect(isHonoCubeTheme({ name: 123 })).toBe(false);
  });

  it("creates custom themes with createTheme", () => {
    const CustomTable = () => null;

    const customTheme = createTheme({
      name: "modern-crm",
      version: "1.0.0",
      description: "Custom modern CRM theme",
      defaultMode: "dark",
      defaultPreset: "violet",
      components: {
        views: {
          table: CustomTable as any,
        },
      },
    });

    expect(customTheme.name).toBe("modern-crm");
    expect(customTheme.version).toBe("1.0.0");
    expect(customTheme.description).toBe("Custom modern CRM theme");
    expect(customTheme.defaultMode).toBe("dark");
    expect(customTheme.defaultPreset).toBe("violet");
    expect(customTheme.components?.views?.table).toBe(CustomTable);
  });

  it("resolveTheme handles undefined inputs gracefully", () => {
    expect(resolveTheme(undefined, undefined)).toBeUndefined();

    const baseTheme: HonoCubeTheme = {
      name: "base",
      defaultMode: "light",
    };
    expect(resolveTheme(undefined, baseTheme)).toEqual(baseTheme);

    const customTheme: HonoCubeTheme = {
      name: "custom",
      defaultMode: "dark",
    };
    expect(resolveTheme(customTheme, undefined)).toEqual(customTheme);
  });

  it("resolveTheme merges custom overrides with base theme defaults", () => {
    const CustomDashboard = () => null;
    const BaseTable = () => null;
    const BaseForm = () => null;

    const baseTheme: HonoCubeTheme = {
      name: "base-theme",
      defaultMode: "light",
      defaultPreset: "zinc",
      components: {
        views: {
          table: BaseTable as any,
          form: BaseForm as any,
        },
      },
    };

    const partialTheme = createTheme({
      name: "partial",
      defaultMode: "dark",
      components: {
        Dashboard: CustomDashboard as any,
      },
    });

    const merged = resolveTheme(partialTheme, baseTheme);
    expect(merged).toBeDefined();
    expect(merged?.defaultMode).toBe("dark");
    expect(merged?.components?.Dashboard).toBe(CustomDashboard);
    // Should fallback to base views for unspecified slots
    expect(merged?.components?.views?.table).toBe(BaseTable);
    expect(merged?.components?.views?.form).toBe(BaseForm);
  });
});
