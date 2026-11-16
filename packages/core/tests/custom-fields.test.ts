import { describe, it, expect } from "vitest";
import { defineCollection, f } from "../src/index.js";
import {
  injectCustomFieldsIntoCollection,
  extractCustomFields,
  mergeCustomFieldsWithRecord,
  type CustomFieldDefinition,
} from "../src/custom-fields/runtime.js";
import { generateColumnsFromCollection } from "../src/table/columns.js";

describe("Runtime Custom Fields in Collections (Issue #141)", () => {
  const baseCollection = defineCollection({
    name: "orders",
    label: "Orders",
    fields: {
      orderNumber: f.text({ label: "Order #" }),
      totalAmount: f.number({ label: "Total Amount" }),
    },
  });

  const customFields: CustomFieldDefinition[] = [
    {
      id: "cf-serial",
      collection: "orders",
      name: "serialNumber",
      label: "Device Serial Number",
      type: "text",
      required: true,
      placeholder: "e.g. SN-12345",
    },
    {
      id: "cf-warranty",
      collection: "orders",
      name: "warrantyMonths",
      label: "Warranty Period (Months)",
      type: "number",
      defaultValue: 12,
    },
    {
      id: "cf-tier",
      collection: "orders",
      name: "customerTier",
      label: "Customer Tier",
      type: "select",
      options: ["Silver", "Gold", "Platinum"],
    },
  ];

  it("injects custom fields dynamically into a collection", () => {
    const augmented = injectCustomFieldsIntoCollection(baseCollection, customFields);

    const keys = augmented.getFieldKeys();
    expect(keys).toContain("orderNumber");
    expect(keys).toContain("totalAmount");
    expect(keys).toContain("serialNumber");
    expect(keys).toContain("warrantyMonths");
    expect(keys).toContain("customerTier");

    // Check synthesized field config
    const serialField = augmented.getField("serialNumber");
    expect(serialField).toBeDefined();
    expect(serialField?.type).toBe("text");
    expect(serialField?.label).toBe("Device Serial Number");
    expect(serialField?.required).toBe(true);
    expect(serialField?.placeholder).toBe("e.g. SN-12345");
    expect(serialField?.metadata?.isCustomField).toBe(true);

    const tierField = augmented.getField("customerTier");
    expect(tierField?.type).toBe("select");
    expect(tierField?.options).toEqual([
      { label: "Silver", value: "Silver" },
      { label: "Gold", value: "Gold" },
      { label: "Platinum", value: "Platinum" },
    ]);
  });

  it("generates table columns including runtime custom fields", () => {
    const augmented = injectCustomFieldsIntoCollection(baseCollection, customFields);
    const columns = generateColumnsFromCollection(augmented);

    const colIds = columns.map((c) => c.id);
    expect(colIds).toContain("orderNumber");
    expect(colIds).toContain("totalAmount");
    expect(colIds).toContain("serialNumber");
    expect(colIds).toContain("warrantyMonths");
    expect(colIds).toContain("customerTier");
  });

  it("extracts and merges custom field values from records", () => {
    const recordNested = {
      id: "101",
      orderNumber: "ORD-99",
      customFields: {
        serialNumber: "SN-8877",
        customerTier: "Gold",
      },
    };

    const extracted = extractCustomFields(recordNested, customFields);
    expect(extracted.serialNumber).toBe("SN-8877");
    expect(extracted.customerTier).toBe("Gold");
    // Default value used when absent
    expect(extracted.warrantyMonths).toBe(12);

    // Merge in nested mode
    const merged = mergeCustomFieldsWithRecord(
      { id: "102", orderNumber: "ORD-100" },
      { serialNumber: "SN-9999" },
      "nested"
    );
    expect(merged.customFields?.serialNumber).toBe("SN-9999");

    // Merge in flat mode
    const mergedFlat = mergeCustomFieldsWithRecord(
      { id: "103", orderNumber: "ORD-101" },
      { serialNumber: "SN-1111" },
      "flat"
    );
    expect(mergedFlat.serialNumber).toBe("SN-1111");
  });
});
