import { describe, it, expect } from "vitest";
import { z } from "zod";
import { defineApi, defineResource } from "../../src/core/factory.js";
import {
  createCustomFieldsStore,
  validateCustomFields,
  type CustomFieldDefinition,
} from "../../src/custom-fields/store.js";
import { createTestDb, posts } from "../fixtures/db.js";

describe("Runtime User-Defined Custom Fields Subsystem (Issue #141)", () => {
  it("stores, filters, and validates custom field definitions", () => {
    const store = createCustomFieldsStore();

    const def1: CustomFieldDefinition = {
      id: "cf-serial",
      collection: "products",
      name: "serialNumber",
      label: "Serial Number",
      type: "text",
      required: true,
    };

    const def2: CustomFieldDefinition = {
      id: "cf-warranty",
      collection: "products",
      name: "warrantyMonths",
      label: "Warranty (Months)",
      type: "number",
      required: false,
    };

    const def3: CustomFieldDefinition = {
      id: "cf-category",
      collection: "products",
      name: "categoryTier",
      label: "Category Tier",
      type: "select",
      options: ["Standard", "Premium", "Enterprise"],
      required: true,
    };

    const defOrder: CustomFieldDefinition = {
      id: "cf-delivery-date",
      collection: "orders",
      name: "expectedDelivery",
      label: "Expected Delivery",
      type: "date",
      required: false,
    };

    store.create(def1);
    store.create(def2);
    store.create(def3);
    store.create(defOrder);

    // List by collection
    const productFields = store.list("products");
    expect(productFields).toHaveLength(3);
    const orderFields = store.list("orders");
    expect(orderFields).toHaveLength(1);
    expect(orderFields[0]?.name).toBe("expectedDelivery");

    // Validation checks
    const valResult1 = validateCustomFields(productFields, {
      serialNumber: "SN-998822",
      warrantyMonths: 12,
      categoryTier: "Premium",
    });
    expect(valResult1.valid).toBe(true);

    // Validation errors: missing required and invalid select option
    const valResult2 = validateCustomFields(productFields, {
      warrantyMonths: "not-a-number",
      categoryTier: "InvalidTier",
    });
    expect(valResult2.valid).toBe(false);
    expect(valResult2.errors.serialNumber).toBe("Serial Number is required.");
    expect(valResult2.errors.warrantyMonths).toBe("Warranty (Months) must be a valid number.");
    expect(valResult2.errors.categoryTier).toContain("must be one of: Standard, Premium, Enterprise");

    // Update definition
    const updated = store.update("cf-warranty", { label: "Warranty Duration (Months)" });
    expect(updated?.label).toBe("Warranty Duration (Months)");

    // Delete definition
    const deleted = store.delete("cf-serial");
    expect(deleted).toBe(true);
    expect(store.list("products")).toHaveLength(2);
  });

  it("exposes REST endpoints for managing custom fields and payload validation", async () => {
    const { adapter } = await createTestDb();

    const postsResource = defineResource({
      name: "posts",
      table: posts,
      adapter,
      validator: z.object({
        title: z.string(),
      }),
    });

    const initialDef: CustomFieldDefinition = {
      id: "cf-reading-time",
      collection: "posts",
      name: "readingTime",
      label: "Reading Time (Minutes)",
      type: "number",
      required: false,
    };

    const app = defineApi(
      { posts: postsResource },
      {
        customFields: {
          enabled: true,
          definitions: [initialDef],
        },
      }
    );

    // 1. GET /custom-fields
    const getRes = await app.request("/custom-fields?collection=posts");
    expect(getRes.status).toBe(200);
    const getJson: any = await getRes.json();
    expect(getJson.data).toHaveLength(1);
    expect(getJson.data[0].name).toBe("readingTime");

    // 2. POST /custom-fields (Create new custom field)
    const postRes = await app.request("/custom-fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "cf-topic",
        collection: "posts",
        name: "topicVertical",
        label: "Topic Vertical",
        type: "select",
        options: ["Technology", "Business", "Design"],
        required: true,
      }),
    });
    expect(postRes.status).toBe(201);
    const postJson: any = await postRes.json();
    expect(postJson.data.id).toBe("cf-topic");

    // 3. GET /custom-fields/:id
    const getSingleRes = await app.request("/custom-fields/cf-topic");
    expect(getSingleRes.status).toBe(200);
    const getSingleJson: any = await getSingleRes.json();
    expect(getSingleJson.data.label).toBe("Topic Vertical");

    // 4. PUT /custom-fields/:id
    const putRes = await app.request("/custom-fields/cf-topic", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: "Content Topic Vertical",
      }),
    });
    expect(putRes.status).toBe(200);

    // 5. POST /custom-fields/validate
    const validateRes = await app.request("/custom-fields/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collection: "posts",
        values: {
          readingTime: 5,
          topicVertical: "Technology",
        },
      }),
    });
    expect(validateRes.status).toBe(200);
    const validateJson: any = await validateRes.json();
    expect(validateJson.valid).toBe(true);

    // 6. DELETE /custom-fields/:id
    const deleteRes = await app.request("/custom-fields/cf-topic", {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(200);

    const afterDeleteRes = await app.request("/custom-fields?collection=posts");
    const afterDeleteJson: any = await afterDeleteRes.json();
    expect(afterDeleteJson.data).toHaveLength(1);
  });
});
