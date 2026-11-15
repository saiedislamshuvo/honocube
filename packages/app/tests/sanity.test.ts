import { describe, expect, it } from "vitest";
import * as app from "../src/index.js";
import * as headless from "../src/headless.js";

describe("@honocube/app scaffold", () => {
  it("exports package version matching 2.0.2", () => {
    expect(app.VERSION).toBe("2.0.2");
  });

  it("re-exports all headless primitives from @honocube/core", () => {
    expect(typeof app.defineCollection).toBe("function");
    expect(typeof app.defineApp).toBe("function");
    expect(typeof app.createApiClient).toBe("function");
    expect(typeof app.ApiClientError).toBe("function");
    expect(typeof app.queryKeys).toBe("object");
    expect(typeof app.AppProvider).toBe("function");
    expect(typeof app.useApp).toBe("function");
    expect(typeof app.useApiClient).toBe("function");
    expect(typeof app.useCollectionQuery).toBe("function");
    expect(typeof app.useCollectionMutation).toBe("function");
    expect(typeof app.useCollectionList).toBe("function");
    expect(typeof app.useCollectionForm).toBe("function");
    expect(typeof app.useCollectionWorkflow).toBe("function");
    expect(typeof app.resolveWorkspaceRoute).toBe("function");
    expect(typeof app.createTheme).toBe("function");
  });

  it("exports turnkey presentation UI components", () => {
    expect(typeof app.TableView).toBe("function");
    expect(typeof app.FormView).toBe("function");
    expect(typeof app.FormDialog).toBe("function");
    expect(typeof app.FormSheet).toBe("function");
    expect(typeof app.FormPage).toBe("function");
    expect(typeof app.ChildTable).toBe("function");
    expect(typeof app.KanbanView).toBe("function");
    expect(typeof app.CalendarView).toBe("function");
    expect(typeof app.ListView).toBe("function");
    expect(typeof app.GridView).toBe("function");
    expect(typeof app.CollectionMultiView).toBe("function");
    expect(typeof app.WorkspaceShell).toBe("function");
    expect(typeof app.WorkspacePage).toBe("function");
    expect(typeof app.defaultTheme).toBe("object");
  });

  it("@honocube/app/headless re-exports all headless core APIs", () => {
    expect(typeof headless.defineCollection).toBe("function");
    expect(typeof headless.defineApp).toBe("function");
    expect(typeof headless.createApiClient).toBe("function");
    expect(typeof headless.useCollectionList).toBe("function");
    expect(typeof headless.useCollectionForm).toBe("function");
    expect(typeof headless.useCollectionWorkflow).toBe("function");
  });
});
