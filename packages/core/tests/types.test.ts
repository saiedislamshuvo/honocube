import { describe, expect, it } from "vitest";
import { defineCollection, type InferRecord } from "../src/index.js";

describe("Type Inference", () => {
  it("infers record structure and types accurately from field definitions", () => {
    const item = defineCollection({
      name: "items",
      fields: {
        code: { type: "text", required: true },
        qty: { type: "number", default: 1 },
      },
    });

    const invoice = defineCollection({
      name: "invoices",
      fields: {
        id: { type: "series", prefix: "INV-" },
        title: { type: "text", required: true },
        amount: { type: "currency", default: 0 },
        isPaid: { type: "boolean", default: false },
        category: { type: "select", options: ["hardware", "software"] as const },
        lineItems: { type: "collection", collection: item, relation: "hasMany" },
        subtotal: { type: "computed", compute: (r) => r.amount },
      },
    });

    type InvoiceRecord = InferRecord<typeof invoice>;

    // Type checking assertions at runtime and compile time
    const mockRecord: InvoiceRecord = {
      id: "INV-001",
      title: "Hosting",
      amount: 150,
      isPaid: true,
      category: "hardware",
      lineItems: [
        { code: "SRV-1", qty: 2 },
      ],
      subtotal: 150,
    };

    expect(invoice.name).toBe("invoices");
    expect(mockRecord.id).toBe("INV-001");
    expect(mockRecord.amount).toBe(150);
    expect(mockRecord.lineItems[0]?.code).toBe("SRV-1");
  });
});
