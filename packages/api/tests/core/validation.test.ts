import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  validateWith,
  resolveValidators,
  parseBatchUpdateBody,
  parseBatchDeleteBody,
  partialValidator,
} from "../../src/core/validation.js";
import { ValidationError } from "../../src/utils/errors.js";

describe("Validation & Standard Schema", () => {
  const schema = z.object({
    name: z.string().min(2),
    age: z.number().positive(),
  });

  it("validates successful data", async () => {
    const valid = await validateWith(schema, { name: "Alice", age: 30 });
    expect(valid).toEqual({ name: "Alice", age: 30 });
  });

  it("throws ValidationError with structured issues on failure", async () => {
    try {
      await validateWith(schema, { name: "A", age: -5 });
      expect.fail("Should have thrown ValidationError");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const validationError = err as ValidationError;
      expect(validationError.issues.length).toBeGreaterThanOrEqual(2);
      expect(validationError.issues[0]?.message).toBeDefined();
    }
  });

  it("resolves single, tuple, and object validators", () => {
    const createSchema = z.object({ title: z.string() });
    const updateSchema = z.object({ title: z.string().optional() });

    // Single
    const single = resolveValidators(createSchema);
    expect(single.create).toBe(createSchema);
    expect(single.update).toBeDefined();

    // Tuple with both
    const tuple = resolveValidators([createSchema, updateSchema]);
    expect(tuple.create).toBe(createSchema);
    expect(tuple.update).toBe(updateSchema);

    // Tuple with omitted update (defaults to partialValidator)
    const tupleSingle = resolveValidators([createSchema]);
    expect(tupleSingle.create).toBe(createSchema);
    expect(tupleSingle.update).toBeDefined();

    // Object with both
    const obj = resolveValidators({ create: createSchema, update: updateSchema });
    expect(obj.create).toBe(createSchema);
    expect(obj.update).toBe(updateSchema);

    // Object with omitted update (defaults to partialValidator)
    const objSingle = resolveValidators({ create: createSchema });
    expect(objSingle.create).toBe(createSchema);
    expect(objSingle.update).toBeDefined();

    // Schema without .partial method returns unchanged
    const nonPartialSchema: any = { "~standard": { version: 1, vendor: "custom", validate: () => {} } };
    expect(partialValidator(nonPartialSchema)).toBe(nonPartialSchema);
  });

  it("parses valid and invalid batch update payloads", () => {
    // Valid
    const valid = parseBatchUpdateBody({
      ids: [1, 2, 3],
      data: { status: "active" },
    });
    expect(valid.ids).toEqual([1, 2, 3]);
    expect(valid.data).toEqual({ status: "active" });

    // Missing ids
    expect(() => parseBatchUpdateBody({ data: {} })).toThrow(ValidationError);
    // Empty ids
    expect(() => parseBatchUpdateBody({ ids: [], data: {} })).toThrow(ValidationError);
    // Non-object body
    expect(() => parseBatchUpdateBody("invalid" as any)).toThrow(ValidationError);
    expect(() => parseBatchUpdateBody(null as any)).toThrow(ValidationError);
    expect(() => parseBatchUpdateBody([] as any)).toThrow(ValidationError);

    // Invalid id types inside ids array
    expect(() => parseBatchUpdateBody({ ids: [true, {}] as any, data: {} })).toThrow(ValidationError);
  });

  it("parses valid and invalid batch delete payloads", () => {
    // Valid
    const valid = parseBatchDeleteBody({ ids: [1, 2] });
    expect(valid.ids).toEqual([1, 2]);

    // Missing ids
    expect(() => parseBatchDeleteBody({})).toThrow(ValidationError);
    // Empty ids
    expect(() => parseBatchDeleteBody({ ids: [] })).toThrow(ValidationError);
    // Non-object body
    expect(() => parseBatchDeleteBody(null as any)).toThrow(ValidationError);
    // Invalid id elements
    expect(() => parseBatchDeleteBody({ ids: ["valid", false] as any })).toThrow(ValidationError);
  });
});
