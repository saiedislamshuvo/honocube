import { describe, it, expect } from "vitest";
import { defineCollection, f, field, isFieldBuilder, unwrapFieldConfig } from "../src/index.js";
import type { InferRecord } from "../src/index.js";

describe("Fluent Field Builder API (`f` / `field`)", () => {
  it("exports `f` and `field` as equivalent builders", () => {
    expect(field).toBe(f);
    expect(typeof f.text).toBe("function");
    expect(typeof f.number).toBe("function");
    expect(typeof f.currency).toBe("function");
    expect(typeof f.select).toBe("function");
    expect(typeof f.date).toBe("function");
    expect(typeof f.datetime).toBe("function");
    expect(typeof f.boolean).toBe("function");
    expect(typeof f.relation).toBe("function");
    expect(typeof f.computed).toBe("function");
    expect(typeof f.json).toBe("function");
    expect(typeof f.series).toBe("function");
    expect(typeof f.collection).toBe("function");
    expect(typeof f.custom).toBe("function");
  });

  it("builds text and textarea fields with chaining modifiers", () => {
    const titleBuilder = f
      .text("Deal Title")
      .required()
      .placeholder("e.g. Acme Deal")
      .pattern("^[A-Z].*")
      .readOnly();

    expect(isFieldBuilder(titleBuilder)).toBe(true);
    expect(titleBuilder.type).toBe("text");

    const built = titleBuilder.build();
    expect(built).toEqual({
      type: "text",
      label: "Deal Title",
      required: true,
      placeholder: "e.g. Acme Deal",
      pattern: "^[A-Z].*",
      readOnly: true,
    });

    const textarea = f.textarea("Notes").placeholder("Add notes...").build();
    expect(textarea).toEqual({
      type: "textarea",
      label: "Notes",
      placeholder: "Add notes...",
    });

    // Switching .textarea() on text builder
    const converted = f.text("Comments").textarea().build();
    expect(converted.type).toBe("textarea");
  });

  it("builds number and currency fields with min, max, step, format, and currencyCode", () => {
    const age = f.number("Age").min(0).max(120).step(1).default(18).build();
    expect(age).toEqual({
      type: "number",
      label: "Age",
      min: 0,
      max: 120,
      step: 1,
      default: 18,
    });

    const price = f
      .currency("Price")
      .min(0)
      .max(1000000)
      .currencyCode("EUR")
      .default(0)
      .build();

    expect(price).toEqual({
      type: "currency",
      label: "Price",
      format: "currency",
      currencyCode: "EUR",
      min: 0,
      max: 1000000,
      default: 0,
    });

    // Default currency settings
    const defaultCurrency = f.currency({ min: 10 }).build();
    expect(defaultCurrency).toEqual({
      type: "currency",
      format: "currency",
      currencyCode: "USD",
      min: 10,
    });
  });

  it("builds select fields with string options, objects, and type-safe defaults", () => {
    // Array first
    const stage = f
      .select(["lead", "qualified", "proposal", "won", "lost"])
      .default("lead")
      .required()
      .build();

    expect(stage).toEqual({
      type: "select",
      options: ["lead", "qualified", "proposal", "won", "lost"],
      default: "lead",
      required: true,
    });

    // Label first
    const priority = f
      .select("Priority Level", [
        { value: "low", label: "Low" },
        { value: "high", label: "High" },
      ])
      .addOption({ value: "critical", label: "Critical" });

    expect(priority.getOptions()).toHaveLength(3);
    expect(priority.build()).toEqual({
      type: "select",
      label: "Priority Level",
      options: [
        { value: "low", label: "Low" },
        { value: "high", label: "High" },
        { value: "critical", label: "Critical" },
      ],
    });
  });

  it("builds date and datetime fields", () => {
    const targetDate = f.date("Target Close Date").optional().format("YYYY-MM-DD").build();
    expect(targetDate).toEqual({
      type: "date",
      label: "Target Close Date",
      required: false,
      format: "YYYY-MM-DD",
    });

    const createdAt = f.datetime("Created At").readOnly().build();
    expect(createdAt).toEqual({
      type: "datetime",
      label: "Created At",
      readOnly: true,
    });
  });

  it("builds boolean toggle fields with dynamic rules", () => {
    const isVisibleRule = () => true;
    const activeCustomer = f
      .boolean("Active Customer")
      .default(true)
      .visible(isVisibleRule)
      .build();

    expect(activeCustomer).toEqual({
      type: "boolean",
      label: "Active Customer",
      default: true,
      visible: isVisibleRule,
    });
  });

  it("builds relation fields with keys, searchability, and target retrieval", () => {
    const contact = f
      .relation("contacts", "Primary Contact")
      .valueKey("id")
      .labelKey("fullName")
      .searchable()
      .optional();

    expect(contact.getTarget()).toBe("contacts");
    expect(contact.build()).toEqual({
      type: "relation",
      target: "contacts",
      label: "Primary Contact",
      valueKey: "id",
      labelKey: "fullName",
      searchable: true,
      required: false,
    });
  });

  it("builds computed, json, and series fields", () => {
    const computeFn = (r: any) => (r.price || 0) * (r.qty || 0);
    const total = f.computed("Total Amount", computeFn).build();
    expect(total).toEqual({
      type: "computed",
      label: "Total Amount",
      compute: computeFn,
    });

    const metadata = f.json("Metadata").default(() => ({})).build();
    expect(metadata.type).toBe("json");
    expect(metadata.label).toBe("Metadata");
    expect(typeof metadata.default).toBe("function");

    const invoiceSeries = f.series("INV-", "Invoice Number").readOnly().build();
    expect(invoiceSeries).toEqual({
      type: "series",
      prefix: "INV-",
      label: "Invoice Number",
      readOnly: true,
    });
  });

  it("supports cloning builders to prevent cross-contamination", () => {
    const base = f.text().required().placeholder("Standard");
    const variantA = base.clone().label("Field A").placeholder("A");
    const variantB = base.clone().label("Field B").placeholder("B");

    expect(variantA.build().label).toBe("Field A");
    expect(variantA.build().placeholder).toBe("A");
    expect(variantB.build().label).toBe("Field B");
    expect(variantB.build().placeholder).toBe("B");
    expect(base.build().label).toBeUndefined();
    expect(base.build().placeholder).toBe("Standard");
  });

  it("supports callable `f(config)` custom builder wrapper", () => {
    const custom = f({
      type: "text",
      label: "Custom",
      pattern: "^[0-9]+$",
    }).required();

    expect(isFieldBuilder(custom)).toBe(true);
    expect(unwrapFieldConfig(custom)).toEqual({
      type: "text",
      label: "Custom",
      pattern: "^[0-9]+$",
      required: true,
    });
  });

  it("implements the exact specification and smart label inference from Issue #108", () => {
    const dealsCollection = defineCollection({
      name: "deals",
      fields: {
        // Label "Deal Title" explicitly set, required, with placeholder
        title: f.text("Deal Title").required().placeholder("e.g. Acme Deal"),

        // Label auto-inferred as "Deal Value", formatted as currency
        dealValue: f.currency({ min: 0 }).default(0),

        // Inferred label "Stage", typed enum options
        stage: f.select(["lead", "qualified", "proposal", "won", "lost"]).default("lead"),

        // Inferred label "Target Close Date"
        targetCloseDate: f.date().optional(),

        // Inferred label "Active Customer", boolean toggle
        activeCustomer: f.boolean().default(true),

        // Inferred label "Contact", relational picker
        contactId: f.relation("contacts").optional(),
      },
    });

    expect(dealsCollection._isCollection).toBe(true);
    expect(dealsCollection.name).toBe("deals");
    expect(dealsCollection.label).toBe("Deals");

    // Check all fields
    const fields = dealsCollection.fields;

    // 1. Explicit label preserved
    expect(fields.title.type).toBe("text");
    expect(fields.title.label).toBe("Deal Title");
    expect(fields.title.required).toBe(true);
    expect(fields.title.placeholder).toBe("e.g. Acme Deal");

    // 2. camelCase auto-inferred as "Deal Value"
    expect(fields.dealValue.type).toBe("currency");
    expect(fields.dealValue.label).toBe("Deal Value");
    expect(fields.dealValue.min).toBe(0);
    expect(fields.dealValue.default).toBe(0);
    expect(fields.dealValue.format).toBe("currency");

    // 3. Stage auto-inferred as "Stage"
    expect(fields.stage.type).toBe("select");
    expect(fields.stage.label).toBe("Stage");
    expect(fields.stage.options).toEqual(["lead", "qualified", "proposal", "won", "lost"]);
    expect(fields.stage.default).toBe("lead");

    // 4. targetCloseDate auto-inferred as "Target Close Date"
    expect(fields.targetCloseDate.type).toBe("date");
    expect(fields.targetCloseDate.label).toBe("Target Close Date");
    expect(fields.targetCloseDate.required).toBe(false);

    // 5. activeCustomer auto-inferred as "Active Customer"
    expect(fields.activeCustomer.type).toBe("boolean");
    expect(fields.activeCustomer.label).toBe("Active Customer");
    expect(fields.activeCustomer.default).toBe(true);

    // 6. contactId relational picker auto-inferred as "Contact" (stripping Id)
    expect(fields.contactId.type).toBe("relation");
    expect(fields.contactId.label).toBe("Contact");
    expect(fields.contactId.target).toBe("contacts");
    expect(fields.contactId.required).toBe(false);

    // Helper methods getFieldKeys and getField
    expect(dealsCollection.getFieldKeys()).toEqual([
      "title",
      "dealValue",
      "stage",
      "targetCloseDate",
      "activeCustomer",
      "contactId",
    ]);

    expect(dealsCollection.getField("contactId")?.label).toBe("Contact");
    expect(dealsCollection.getField("dealValue")?.label).toBe("Deal Value");
  });

  it("auto-infers human labels for snake_case and relation suffixes", () => {
    const collection = defineCollection({
      name: "accounts",
      fields: {
        company_name: f.text().required(),
        billing_address: f.textarea(),
        organization_id: f.relation("organizations"),
        parent_account_id: f.relation("accounts"),
        assigned_user_id: f.relation("users", "Account Owner"), // explicit label preserved
      },
    });

    expect(collection.fields.company_name.label).toBe("Company Name");
    expect(collection.fields.billing_address.label).toBe("Billing Address");
    expect(collection.fields.organization_id.label).toBe("Organization");
    expect(collection.fields.parent_account_id.label).toBe("Parent Account");
    expect(collection.fields.assigned_user_id.label).toBe("Account Owner");
  });

  it("verifies type-level InferRecord mapping with field builders", () => {
    const collection = defineCollection({
      name: "sample",
      fields: {
        textCol: f.text().required(),
        numCol: f.currency().default(10),
        statusCol: f.select(["pending", "done"] as const).default("pending"),
        activeCol: f.boolean().default(true),
      },
    });

    expect(collection.name).toBe("sample");
    type SampleRecord = InferRecord<typeof collection>;

    const testRecord: SampleRecord = {
      textCol: "Hello",
      numCol: 42,
      statusCol: "done",
      activeCol: false,
    };

    expect(testRecord.textCol).toBe("Hello");
    expect(testRecord.statusCol).toBe("done");
  });
});
