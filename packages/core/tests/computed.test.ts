import { describe, it, expect } from "vitest";
import { evaluateComputedFields } from "../src/form/computed.js";
import type { FieldConfig } from "../src/types/fields.js";

describe("evaluateComputedFields", () => {
  it("evaluates a single row-level computed field", () => {
    const fields: Record<string, FieldConfig<any>> = {
      qty: { type: "number", default: 2 },
      rate: { type: "currency", default: 50 },
      amount: {
        type: "computed",
        compute: (rec) => (rec.qty || 0) * (rec.rate || 0),
      },
    };

    const initial = { qty: 3, rate: 25 };
    const result = evaluateComputedFields(fields, initial);

    expect(result.amount).toBe(75);
  });

  it("evaluates chained multi-level computed fields to convergence", () => {
    const fields: Record<string, FieldConfig<any>> = {
      qty: { type: "number", default: 1 },
      rate: { type: "currency", default: 100 },
      // Level 1: depends on qty & rate
      subtotal: {
        type: "computed",
        compute: (rec) => (rec.qty || 0) * (rec.rate || 0),
      },
      // Level 2: depends on subtotal
      tax: {
        type: "computed",
        compute: (rec) => (rec.subtotal || 0) * 0.15,
      },
      // Level 3: depends on subtotal & tax
      total: {
        type: "computed",
        compute: (rec) => (rec.subtotal || 0) + (rec.tax || 0),
      },
    };

    const record = { qty: 4, rate: 50 };
    const evaluated = evaluateComputedFields(fields, record);

    expect(evaluated.subtotal).toBe(200);
    expect(evaluated.tax).toBe(30);
    expect(evaluated.total).toBe(230);
  });

  it("computes rollups across nested child line items", () => {
    const fields: Record<string, FieldConfig<any>> = {
      items: {
        type: "collection",
        collection: {
          name: "items",
          fields: {},
        } as any,
      },
      grandTotal: {
        type: "computed",
        compute: (rec) =>
          (rec.items || []).reduce(
            (sum: number, item: any) => sum + (item.amount || 0),
            0
          ),
      },
    };

    const record = {
      items: [{ amount: 100 }, { amount: 250 }, { amount: 50 }],
    };

    const evaluated = evaluateComputedFields(fields, record);
    expect(evaluated.grandTotal).toBe(400);
  });

  it("handles parentRecord context for nested line items", () => {
    const fields: Record<string, FieldConfig<any>> = {
      amount: { type: "number" },
      discountedAmount: {
        type: "computed",
        compute: (rec, parent) => {
          const discountPct = (parent?.globalDiscount as number) || 0;
          return (rec.amount || 0) * (1 - discountPct / 100);
        },
      },
    };

    const record = { amount: 200 };
    const parentRecord = { globalDiscount: 20 };

    const evaluated = evaluateComputedFields(fields, record, parentRecord);
    expect(evaluated.discountedAmount).toBe(160);
  });

  it("safely handles exceptions thrown inside user compute functions", () => {
    const fields: Record<string, FieldConfig<any>> = {
      faulty: {
        type: "computed",
        compute: (rec) => {
          // Access non-existent nested object property
          return rec.nonExistent.subProp;
        },
      },
      normal: {
        type: "computed",
        compute: () => 42,
      },
    };

    const initial = { faulty: "initial" };
    const evaluated = evaluateComputedFields(fields, initial);

    // Faulty computed preserved initial value without crashing
    expect(evaluated.faulty).toBe("initial");
    expect(evaluated.normal).toBe(42);
  });
});
