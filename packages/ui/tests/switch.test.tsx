import React from "react";
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Switch } from "../src/index.js";

describe("Switch Component (Issue #148)", () => {
  it("renders with role switch and unchecked state by default", () => {
    const html = renderToString(<Switch aria-label="Toggle active status" />);
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('data-state="unchecked"');
  });

  it("renders with checked state when checked prop is true", () => {
    const html = renderToString(<Switch checked={true} aria-label="Toggle active status" />);
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('data-state="checked"');
    expect(html).toContain("bg-primary");
  });

  it("renders small size variant with sm classes", () => {
    const html = renderToString(<Switch size="sm" checked={true} aria-label="Compact switch" />);
    expect(html).toContain("h-4");
    expect(html).toContain("w-7");
  });

  it("renders disabled state", () => {
    const html = renderToString(<Switch disabled aria-label="Disabled switch" />);
    expect(html).toContain("disabled");
  });
});
