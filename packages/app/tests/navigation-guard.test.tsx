import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  defineApp,
  defineCollection,
  AppProvider,
  FormView,
  WorkspacePage,
  UnsavedChangesDialog,
  NavigationGuardProvider,
  useNavigationGuard,
  useUnsavedChangesGuard,
} from "../src/index.js";

describe("Unsaved Changes Navigation Guard & BeforeUnload Prompt (Issue #117)", () => {
  const sampleCollection = defineCollection({
    name: "articles",
    label: "Articles",
    fields: {
      id: { type: "text", label: "Article ID" },
      title: { type: "text", label: "Title", required: true },
      content: { type: "text", label: "Content" },
    },
  });

  const app = defineApp({
    title: "CMS App",
    apiBaseUrl: "https://api.example.com",
    collections: [sampleCollection],
  });

  describe("UnsavedChangesDialog", () => {
    it("renders dialog contents when open is true", () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      const html = renderToString(
        <UnsavedChangesDialog
          open={true}
          title="Custom Discard Warning"
          description="Are you certain you want to exit without saving?"
          confirmLabel="Yes, Leave"
          cancelLabel="No, Stay"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      expect(html).toContain("data-testid=\"unsaved-changes-dialog\"");
      expect(html).toContain("Custom Discard Warning");
      expect(html).toContain("Are you certain you want to exit without saving?");
      expect(html).toContain("Yes, Leave");
      expect(html).toContain("No, Stay");
    });
  });

  describe("NavigationGuardProvider & useNavigationGuard", () => {
    function TestConsumer({
      isDirty,
      targetHref = "/other-page",
    }: {
      isDirty: boolean;
      targetHref?: string;
    }) {
      const navGuard = useNavigationGuard();
      useUnsavedChangesGuard({ isDirty, enabled: true });

      return (
        <div>
          <span data-testid="guarded-status">
            {navGuard?.isGuarded ? "guarded" : "clean"}
          </span>
          <button
            data-testid="nav-btn"
            onClick={() => navGuard?.guardedNavigate(targetHref)}
          >
            Navigate
          </button>
        </div>
      );
    }

    it("renders correctly with NavigationGuardProvider", () => {
      const html = renderToString(
        <NavigationGuardProvider>
          <TestConsumer isDirty={false} />
        </NavigationGuardProvider>
      );

      expect(html).toContain("clean");
      expect(html).not.toContain("data-testid=\"unsaved-changes-dialog\"");
    });

    it("detects guarded state and triggers dialog when dirty", () => {
      let registeredGuard: any = null;
      function TestHookProvider() {
        const navGuard = useNavigationGuard();
        registeredGuard = navGuard;
        return (
          <button
            onClick={() => {
              navGuard?.registerGuard("form-1", true, "Unsaved changes detected");
            }}
          >
            Trigger Dirty
          </button>
        );
      }

      renderToString(
        <NavigationGuardProvider>
          <TestHookProvider />
        </NavigationGuardProvider>
      );

      expect(registeredGuard).toBeDefined();
      expect(typeof registeredGuard.guardedNavigate).toBe("function");
    });
  });

  describe("Window beforeunload listener", () => {
    let mockEvents: Record<string, ((...args: any[]) => void)[]> = {};

    beforeEach(() => {
      mockEvents = {};
      (global as any).window = {
        addEventListener: vi.fn((event: string, handler: (...args: any[]) => void) => {
          if (!mockEvents[event]) mockEvents[event] = [];
          mockEvents[event].push(handler);
        }),
        removeEventListener: vi.fn((event: string, handler: (...args: any[]) => void) => {
          if (mockEvents[event]) {
            mockEvents[event] = mockEvents[event].filter((h) => h !== handler);
          }
        }),
        history: {
          pushState: vi.fn(),
        },
        location: {
          href: "https://example.com/form",
        },
      };
    });

    afterEach(() => {
      delete (global as any).window;
    });

    it("attaches beforeunload listener when dirty", () => {
      function HookComponent() {
        useUnsavedChangesGuard({
          isDirty: true,
          enabled: true,
          message: "Unsaved modifications!",
        });
        return <div>Editing...</div>;
      }

      const html = renderToString(<HookComponent />);
      expect(html).toContain("Editing...");
    });
  });

  describe("FormView Integration", () => {
    it("renders FormView with unsavedChangesGuard enabled by default", () => {
      const queryClient = new QueryClient();
      const mockClient: any = {
        apiBaseUrl: "https://api.example.com",
        get: vi.fn().mockResolvedValue({ data: { id: "1", title: "Test Article" } }),
      };

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <AppProvider app={app} client={mockClient}>
            <FormView collection={sampleCollection} />
          </AppProvider>
        </QueryClientProvider>
      );

      expect(html).toContain("data-testid=\"form-view\"");
    });

    it("allows disabling unsavedChangesGuard explicitly", () => {
      const queryClient = new QueryClient();
      const mockClient: any = {
        apiBaseUrl: "https://api.example.com",
        get: vi.fn().mockResolvedValue({ data: { id: "1", title: "Test Article" } }),
      };

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <AppProvider app={app} client={mockClient}>
            <FormView
              collection={sampleCollection}
              unsavedChangesGuard={false}
            />
          </AppProvider>
        </QueryClientProvider>
      );

      expect(html).toContain("data-testid=\"form-view\"");
    });
  });

  describe("WorkspacePage Integration", () => {
    it("renders WorkspacePage wrapped with NavigationGuardProvider", () => {
      const queryClient = new QueryClient();
      const mockClient: any = {
        apiBaseUrl: "https://api.example.com",
        get: vi.fn().mockResolvedValue({ data: [] }),
      };

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <AppProvider app={app} client={mockClient}>
            <WorkspacePage app={app} params={{ slug: [] }} />
          </AppProvider>
        </QueryClientProvider>
      );

      expect(html).toContain("data-testid=\"workspace-page\"");
    });
  });
});
