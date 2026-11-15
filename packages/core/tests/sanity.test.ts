import { describe, it, expect } from "vitest";
import * as core from "../src/index.js";

describe("@honocube/core exports", () => {
  it("exports package version and core schema definitions", () => {
    expect(core.VERSION).toBe("2.0.2");
    expect(typeof core.defineCollection).toBe("function");
    expect(typeof core.defineApp).toBe("function");
  });

  it("exports API client and error classes", () => {
    expect(typeof core.createApiClient).toBe("function");
    expect(typeof core.ApiClientError).toBe("function");
  });

  it("exports query keys, provider, and hooks", () => {
    expect(typeof core.queryKeys).toBe("object");
    expect(typeof core.AppProvider).toBe("function");
    expect(typeof core.useApp).toBe("function");
    expect(typeof core.useApiClient).toBe("function");
    expect(typeof core.useCollectionQuery).toBe("function");
    expect(typeof core.useCollectionMutation).toBe("function");
  });

  it("exports table engine functions", () => {
    expect(typeof core.useCollectionList).toBe("function");
    expect(typeof core.generateColumnsFromCollection).toBe("function");
    expect(typeof core.parseTableStateFromUrl).toBe("function");
    expect(typeof core.serializeTableStateToUrl).toBe("function");
    expect(typeof core.syncUrlState).toBe("function");
  });

  it("exports form engine functions", () => {
    expect(typeof core.useCollectionForm).toBe("function");
    expect(typeof core.createChildCollectionHelper).toBe("function");
    expect(typeof core.useChildCollection).toBe("function");
    expect(typeof core.evaluateComputedFields).toBe("function");
    expect(typeof core.evaluateFieldCapability).toBe("function");
    expect(typeof core.validateField).toBe("function");
    expect(typeof core.validateRecord).toBe("function");
    expect(typeof core.getDefaultFormValues).toBe("function");
  });

  it("exports workflow engine functions", () => {
    expect(typeof core.useCollectionWorkflow).toBe("function");
    expect(typeof core.getCurrentWorkflowState).toBe("function");
    expect(typeof core.getStateMetadata).toBe("function");
    expect(typeof core.isRecordLocked).toBe("function");
    expect(typeof core.getAvailableTransitions).toBe("function");
  });

  it("exports route resolver functions", () => {
    expect(typeof core.resolveWorkspaceRoute).toBe("function");
  });

  it("exports theme contract functions", () => {
    expect(typeof core.createTheme).toBe("function");
    expect(typeof core.isHonoCubeTheme).toBe("function");
    expect(typeof core.resolveTheme).toBe("function");
  });

  it("exports format utilities", () => {
    expect(typeof core.toHumanLabel).toBe("function");
    expect(typeof core.formatCellValue).toBe("function");
    expect(typeof core.formatFileSize).toBe("function");
  });
});
