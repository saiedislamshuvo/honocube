import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  defineApp,
  defineCollection,
  ThemeProvider,
  useTheme,
  ThemeSwitcher,
  WorkspaceTopbar,
} from "../src/index.js";

describe("Theme System & Components", () => {
  const dummyCol = defineCollection({
    name: "items",
    label: "Items",
    fields: { name: { type: "text" } },
  });

  const app = defineApp({
    title: "Theme Test App",
    apiBaseUrl: "https://api.example.com",
    collections: [dummyCol],
    layout: {
      themeToggle: true,
      themePresets: true,
    },
  });

  function ThemeConsumer() {
    const { theme, preset, resolvedTheme } = useTheme();
    return (
      <div data-testid="theme-consumer">
        <span id="theme-mode">{theme}</span>
        <span id="theme-preset">{preset}</span>
        <span id="resolved-theme">{resolvedTheme}</span>
      </div>
    );
  }

  it("provides theme context and default values", () => {
    const html = renderToString(
      <ThemeProvider defaultTheme="dark" defaultPreset="emerald">
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(html).toContain('id="theme-mode">dark<');
    expect(html).toContain('id="theme-preset">emerald<');
  });

  it("provides safe fallback when useTheme is called outside ThemeProvider", () => {
    const html = renderToString(<ThemeConsumer />);
    expect(html).toContain('id="theme-mode">system<');
    expect(html).toContain('id="theme-preset">zinc<');
  });

  it("renders ThemeSwitcher dropdown trigger button", () => {
    const html = renderToString(
      <ThemeProvider defaultTheme="light" defaultPreset="blue">
        <ThemeSwitcher showPresets={true} />
      </ThemeProvider>
    );

    expect(html).toContain('data-testid="theme-switcher-button"');
  });

  it("WorkspaceTopbar automatically renders ThemeSwitcher when no explicit onThemeChange is passed", () => {
    const html = renderToString(
      <ThemeProvider defaultTheme="light" defaultPreset="violet">
        <WorkspaceTopbar app={app} pathname="/" />
      </ThemeProvider>
    );

    expect(html).toContain('data-testid="theme-switcher-button"');
  });
});
