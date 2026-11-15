import { describe, it, expect } from "vitest";
import { evaluateFieldCapability } from "../src/form/capabilities.js";
import type { FieldConfig } from "../src/types/fields.js";

describe("evaluateFieldCapability", () => {
  it("evaluates static visibility and disabled flags", () => {
    const field: FieldConfig<any> = {
      type: "text",
      visible: false,
      disabled: true,
      required: true,
    };

    const capability = evaluateFieldCapability(field, {});
    expect(capability.visible).toBe(false);
    expect(capability.disabled).toBe(true);
    expect(capability.required).toBe(true);
    expect(capability.readOnly).toBe(false);
  });

  it("evaluates dynamic visibility based on record state", () => {
    const field: FieldConfig<any> = {
      type: "text",
      visible: ({ record }) => record.hasDiscount === true,
    };

    expect(evaluateFieldCapability(field, { hasDiscount: false }).visible).toBe(false);
    expect(evaluateFieldCapability(field, { hasDiscount: true }).visible).toBe(true);
  });

  it("evaluates dynamic disabled rule based on status or user role", () => {
    const field: FieldConfig<any> = {
      type: "currency",
      disabled: ({ record, user }) => {
        if (record.status === "posted") return true;
        return user?.role !== "manager";
      },
    };

    // User is manager, status is draft -> enabled
    expect(
      evaluateFieldCapability(field, { status: "draft" }, { role: "manager" }).disabled
    ).toBe(false);

    // User is staff -> disabled
    expect(
      evaluateFieldCapability(field, { status: "draft" }, { role: "staff" }).disabled
    ).toBe(true);

    // Status is posted -> disabled even for manager
    expect(
      evaluateFieldCapability(field, { status: "posted" }, { role: "manager" }).disabled
    ).toBe(true);
  });

  it("marks computed fields as readOnly and disabled", () => {
    const field: FieldConfig<any> = {
      type: "computed",
      compute: (r) => r.a + r.b,
    };

    const capability = evaluateFieldCapability(field, { a: 1, b: 2 });
    expect(capability.readOnly).toBe(true);
    expect(capability.disabled).toBe(true);
  });

  it("returns default capability state when field is undefined", () => {
    const capability = evaluateFieldCapability(undefined, {});
    expect(capability.visible).toBe(true);
    expect(capability.disabled).toBe(false);
    expect(capability.readOnly).toBe(false);
    expect(capability.required).toBe(false);
  });
});
