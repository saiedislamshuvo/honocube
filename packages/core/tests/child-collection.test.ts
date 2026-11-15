import { describe, it, expect } from "vitest";
import { defineCollection } from "../src/core/collection.js";
import { createChildCollectionHelper } from "../src/form/child.js";
import { evaluateComputedFields } from "../src/form/computed.js";

const lineItemCollection = defineCollection({
  name: "invoice_items",
  fields: {
    description: { type: "text", default: "Standard Item" },
    qty: { type: "number", default: 1 },
    rate: { type: "currency", default: 100 },
    amount: {
      type: "computed",
      compute: (row, parent) => {
        const base = (row.qty || 0) * (row.rate || 0);
        const discount = (parent?.globalDiscount as number) || 0;
        return base * (1 - discount / 100);
      },
    },
  },
});

const invoiceCollection = defineCollection({
  name: "invoices",
  fields: {
    title: { type: "text" },
    globalDiscount: { type: "number", default: 0 },
    items: {
      type: "collection",
      collection: lineItemCollection,
      relation: "hasMany",
    },
    subtotal: {
      type: "computed",
      compute: (r) =>
        (r.items || []).reduce((sum: number, item: any) => sum + (item.amount || 0), 0),
    },
    tax: {
      type: "computed",
      compute: (r) => (r.subtotal || 0) * 0.1,
    },
    grandTotal: {
      type: "computed",
      compute: (r) => (r.subtotal || 0) + (r.tax || 0),
    },
  },
});

describe("Child Collections Engine (child.ts)", () => {
  it("provides row-level CRUD operations (add, remove, update, reorder)", () => {
    let mockValues: any = { items: [] };

    const mockParentForm = {
      get values() {
        return mockValues;
      },
      errors: {},
      setFieldValue: (_field: string, val: any) => {
        mockValues = { ...mockValues, items: val };
      },
    };

    const helper = createChildCollectionHelper(
      mockParentForm as any,
      invoiceCollection,
      "items"
    );

    expect(helper.isEmpty).toBe(true);
    expect(helper.count).toBe(0);

    // 1. Add Row
    helper.addRow({ description: "Widget A", qty: 2, rate: 50 });
    expect(helper.count).toBe(1);
    expect(helper.isEmpty).toBe(false);
    expect(helper.rows[0]?.description).toBe("Widget A");
    expect(helper.rows[0]?.qty).toBe(2);
    expect(helper.rows[0]?.rate).toBe(50);

    // 2. Add Second Row with defaults
    helper.addRow();
    expect(helper.count).toBe(2);
    expect(helper.rows[1]?.description).toBe("Standard Item");
    expect(helper.rows[1]?.qty).toBe(1);
    expect(helper.rows[1]?.rate).toBe(100);

    // 3. Update Row
    helper.updateRow(0, { qty: 10 });
    expect(helper.rows[0]?.qty).toBe(10);

    // 4. Reorder Rows
    helper.reorderRows(0, 1);
    expect(helper.rows[0]?.description).toBe("Standard Item");
    expect(helper.rows[1]?.description).toBe("Widget A");

    // 5. Remove Row
    helper.removeRow(0);
    expect(helper.count).toBe(1);
    expect(helper.rows[0]?.description).toBe("Widget A");

    // 6. Clear Rows
    helper.clearRows();
    expect(helper.count).toBe(0);
    expect(helper.isEmpty).toBe(true);
  });

  it("extracts row-specific validation errors via getRowErrors", () => {
    const mockParentForm = {
      values: { items: [{ qty: 0 }, { qty: 5 }] },
      errors: {
        "items[0].qty": ["Qty must be at least 1"],
        "items[0].rate": ["Rate is required"],
        "items[1].rate": ["Rate is required"],
        title: ["Title is required"],
      },
      setFieldValue: () => {},
    };

    const helper = createChildCollectionHelper(
      mockParentForm as any,
      invoiceCollection,
      "items"
    );

    const row0Errors = helper.getRowErrors(0);
    expect(row0Errors).toEqual({
      qty: ["Qty must be at least 1"],
      rate: ["Rate is required"],
    });

    const row1Errors = helper.getRowErrors(1);
    expect(row1Errors).toEqual({
      rate: ["Rate is required"],
    });

    const row2Errors = helper.getRowErrors(2);
    expect(row2Errors).toEqual({});
  });

  it("recursively recalculates child row formulas and parent rollups", () => {
    const initialRecord = {
      globalDiscount: 0,
      items: [
        { qty: 2, rate: 50 }, // base 100
        { qty: 1, rate: 200 }, // base 200
      ],
    };

    const evaluated = evaluateComputedFields(invoiceCollection.fields, initialRecord);

    // Child rows computed amount
    expect(evaluated.items[0].amount).toBe(100);
    expect(evaluated.items[1].amount).toBe(200);

    // Parent rollups
    expect(evaluated.subtotal).toBe(300);
    expect(evaluated.tax).toBe(30);
    expect(evaluated.grandTotal).toBe(330);
  });

  it("propagates parent field changes into child formulas and re-rolls up", () => {
    const record = {
      globalDiscount: 20, // 20% discount
      items: [
        { qty: 2, rate: 50 }, // base 100 - 20% = 80
        { qty: 1, rate: 100 }, // base 100 - 20% = 80
      ],
    };

    const evaluated = evaluateComputedFields(invoiceCollection.fields, record);

    expect(evaluated.items[0].amount).toBe(80);
    expect(evaluated.items[1].amount).toBe(80);
    expect(evaluated.subtotal).toBe(160);
    expect(evaluated.tax).toBe(16);
    expect(evaluated.grandTotal).toBe(176);
  });
});
