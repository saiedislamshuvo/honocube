import { describe, it, expect } from "vitest";
import { validateField, validateRecord } from "../src/form/validation.js";
import type { FieldConfig } from "../src/types/fields.js";

describe("validateField", () => {
  it("enforces required fields for empty strings, null, undefined, and empty arrays", () => {
    const field: FieldConfig<any> = {
      type: "text",
      label: "Customer Name",
      required: true,
    };

    expect(validateField(field, "")).toEqual(["Customer Name is required"]);
    expect(validateField(field, null)).toEqual(["Customer Name is required"]);
    expect(validateField(field, undefined)).toEqual(["Customer Name is required"]);
    expect(validateField(field, "Acme Corp")).toEqual([]);
  });

  it("skips required validation when field is hidden or disabled", () => {
    const hiddenField: FieldConfig<any> = {
      type: "text",
      required: true,
      visible: false,
    };
    expect(validateField(hiddenField, "")).toEqual([]);

    const disabledField: FieldConfig<any> = {
      type: "text",
      required: true,
      disabled: true,
    };
    expect(validateField(disabledField, "")).toEqual([]);
  });

  it("validates number and currency min/max constraints", () => {
    const field: FieldConfig<any> = {
      type: "number",
      min: 10,
      max: 100,
    };

    expect(validateField(field, 5)).toEqual(["Must be at least 10"]);
    expect(validateField(field, 150)).toEqual(["Must be at most 100"]);
    expect(validateField(field, 50)).toEqual([]);
    expect(validateField(field, "not-a-number")).toEqual(["Must be a valid number"]);
  });

  it("validates text pattern regex", () => {
    const field: FieldConfig<any> = {
      type: "text",
      pattern: "^[A-Z]{3}-\\d{4}$",
    };

    expect(validateField(field, "ABC-1234")).toEqual([]);
    expect(validateField(field, "abc-1234")).toEqual(["Invalid format"]);
    expect(validateField(field, "123-ABCD")).toEqual(["Invalid format"]);
  });
});

describe("validateRecord", () => {
  it("validates record against collection fields", async () => {
    const fields: Record<string, FieldConfig<any>> = {
      title: { type: "text", required: true, label: "Title" },
      price: { type: "currency", min: 1, required: true },
    };

    const record = { title: "", price: 0 };
    const errors = await validateRecord(fields, record);

    expect(errors.title).toEqual(["Title is required"]);
    expect(errors.price).toEqual(["Must be at least 1"]);
  });

  it("integrates with Standard Schema validator (~standard)", async () => {
    const fields: Record<string, FieldConfig<any>> = {
      code: { type: "text" },
    };

    // Standard Schema compliant validator mock
    const standardValidator = {
      "~standard": {
        validate: async (record: any) => {
          if (!record.code?.startsWith("HONO-")) {
            return {
              issues: [
                {
                  path: ["code"],
                  message: "Code must start with HONO-",
                },
              ],
            };
          }
          return { value: record };
        },
      },
    };

    const errors = await validateRecord(fields, { code: "TEST" }, undefined, standardValidator);
    expect(errors.code).toEqual(["Code must start with HONO-"]);

    const validErrors = await validateRecord(fields, { code: "HONO-123" }, undefined, standardValidator);
    expect(validErrors.code).toBeUndefined();
  });

  it("integrates with custom function validator", async () => {
    const fields: Record<string, FieldConfig<any>> = {
      email: { type: "text" },
    };

    const customValidator = (record: any) => {
      if (!record.email?.includes("@")) {
        return { email: ["Invalid email format"] };
      }
      return {};
    };

    const errors = await validateRecord(fields, { email: "invalid-email" }, undefined, customValidator);
    expect(errors.email).toEqual(["Invalid email format"]);
  });
});
