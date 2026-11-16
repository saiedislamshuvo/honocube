import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  defineApp,
  defineCollection,
  AppProvider,
  FormView,
  FloatingSaveBar,
} from "../src/index.js";

describe("Contextual Floating Save Bar (Issue #116)", () => {
  const sampleCollection = defineCollection({
    name: "profiles",
    label: "User Profiles",
    fields: {
      id: { type: "text", label: "User ID" },
      username: { type: "text", label: "Username", required: true },
      bio: { type: "text", label: "Bio" },
    },
  });

  const app = defineApp({
    title: "App",
    apiBaseUrl: "https://api.example.com",
    collections: [sampleCollection],
  });

  describe("FloatingSaveBar Primitive Component", () => {
    it("returns null when isDirty is false and visible is not set", () => {
      const html = renderToString(
        <FloatingSaveBar isDirty={false} />
      );

      expect(html).toBe("");
    });

    it("returns null when visible is explicitly false even if isDirty is true", () => {
      const html = renderToString(
        <FloatingSaveBar isDirty={true} visible={false} />
      );

      expect(html).toBe("");
    });

    it("renders floating save bar when isDirty is true", () => {
      const html = renderToString(
        <FloatingSaveBar
          isDirty={true}
          saveLabel="Save changes"
          discardLabel="Discard"
        />
      );

      expect(html).toContain('data-testid="floating-save-bar"');
      expect(html).toContain('role="status"');
      expect(html).toContain("You have unsaved changes");
      expect(html).toContain("Save changes");
      expect(html).toContain("Discard");
      expect(html).toContain("Ctrl+S");
    });

    it("renders custom message, save label, and discard label", () => {
      const html = renderToString(
        <FloatingSaveBar
          visible={true}
          message="Unsaved profile edits"
          saveLabel="Apply Profile Changes"
          discardLabel="Revert Edits"
        />
      );

      expect(html).toContain("Unsaved profile edits");
      expect(html).toContain("Apply Profile Changes");
      expect(html).toContain("Revert Edits");
    });

    it("shows loading spinner when isSubmitting is true", () => {
      const html = renderToString(
        <FloatingSaveBar
          visible={true}
          isSubmitting={true}
        />
      );

      expect(html).toContain("Saving...");
      expect(html).toContain("animate-spin");
    });

    it("renders custom actions slot inside the floating bar", () => {
      const html = renderToString(
        <FloatingSaveBar
          visible={true}
          actions={<button id="preview-btn">Preview</button>}
        />
      );

      expect(html).toContain("Preview");
    });

    it("hides discard button when showDiscard is false", () => {
      const html = renderToString(
        <FloatingSaveBar
          visible={true}
          showDiscard={false}
          discardLabel="Discard"
        />
      );

      expect(html).not.toContain("Discard");
      expect(html).toContain("Save changes");
    });
  });

  describe("FormView Integration", () => {
    it("does not render floating save bar when form values are pristine", () => {
      const queryClient = new QueryClient();
      const customClient: any = {
        apiBaseUrl: "https://api.example.com",
        get: vi.fn(),
      };

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <AppProvider app={app} client={customClient}>
            <FormView
              collection={sampleCollection}
              mode="create"
            />
          </AppProvider>
        </QueryClientProvider>
      );

      expect(html).not.toContain('data-testid="floating-save-bar"');
    });

    it("does not render floating save bar when floatingSaveBar is explicitly false", () => {
      const queryClient = new QueryClient();
      const customClient: any = {
        apiBaseUrl: "https://api.example.com",
        get: vi.fn(),
      };

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <AppProvider app={app} client={customClient}>
            <FormView
              collection={sampleCollection}
              mode="create"
              floatingSaveBar={false}
            />
          </AppProvider>
        </QueryClientProvider>
      );

      expect(html).not.toContain('data-testid="floating-save-bar"');
    });
  });
});
