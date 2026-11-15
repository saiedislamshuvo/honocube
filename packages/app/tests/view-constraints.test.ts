import { describe, it, expect } from "vitest";
import { expectTypeOf } from "vitest";
import {
  defineCollection,
  f,
  type SelectableFieldKeys,
  type DateFieldKeys,
  type NumericFieldKeys,
  type TextFieldKeys,
} from "../src/index.js";

describe("Strict Schema Key Autocomplete & Compile-Time View Constraints (Issue #109)", () => {
  it("enforces keyof TFields on table.columns, table.search, and table.filters", () => {
    const collection = defineCollection({
      name: "deals",
      fields: {
        title: f.text().required(),
        amount: f.currency().default(0),
        stage: f.select(["lead", "won"]),
      },
      table: {
        // Valid field keys compile cleanly
        columns: ["title", "amount", "stage"],
        search: ["title"],
        filters: ["stage"],
      },
    });

    expect(collection.table?.columns).toEqual(["title", "amount", "stage"]);
    expect(collection.table?.search).toEqual(["title"]);
    expect(collection.table?.filters).toEqual(["stage"]);

    defineCollection({
      name: "invalid_table",
      fields: {
        title: { type: "text" },
        amount: { type: "number" },
      },
      table: {
        // @ts-expect-error - 'titl' is a typo and not in 'title' | 'amount'
        columns: ["titl", "amount"],
        // @ts-expect-error - 'unknown' is not a valid field key
        search: ["unknown"],
        // @ts-expect-error - 'not_found' is not a valid field key
        filters: ["not_found"],
      },
    });
  });

  it("enforces keyof TFields across form sections and tabs", () => {
    const collection = defineCollection({
      name: "contacts",
      fields: {
        firstName: f.text().required(),
        lastName: f.text().required(),
        email: f.text().required(),
        phone: f.text().optional(),
      },
      form: {
        sections: [
          {
            title: "General",
            fields: ["firstName", "lastName"],
          },
          {
            title: "Contact Info",
            fields: ["email", "phone"],
          },
        ],
        tabs: [
          {
            label: "Main",
            fields: ["firstName", "email"],
          },
        ],
      },
    });

    expect(collection.form?.sections?.[0]?.fields).toEqual(["firstName", "lastName"]);

    defineCollection({
      name: "invalid_form",
      fields: {
        firstName: { type: "text" },
        lastName: { type: "text" },
      },
      form: {
        sections: [
          {
            title: "Invalid Section",
            // @ts-expect-error - 'email' does not exist in schema
            fields: ["firstName", "email"],
          },
        ],
        tabs: [
          {
            label: "Invalid Tab",
            // @ts-expect-error - 'phone' does not exist in schema
            fields: ["phone"],
          },
        ],
      },
    });
  });

  it("enforces semantic view constraints: kanban.groupBy only accepts selectable/enum fields", () => {
    const validKanban = defineCollection({
      name: "deals",
      fields: {
        title: f.text(),
        amount: f.number(),
        stage: f.select(["lead", "qualified", "won"]),
      },
      kanban: {
        groupBy: "stage",
        card: {
          title: "title",
          value: "amount",
        },
      },
    });

    expect(validKanban.kanban?.groupBy).toBe("stage");

    defineCollection({
      name: "invalid_kanban",
      fields: {
        title: { type: "text" },
        amount: { type: "number" },
        stage: { type: "select", options: ["lead", "won"] },
      },
      kanban: {
        // @ts-expect-error - 'amount' is number, not selectable/enum (expected field with type: 'select')
        groupBy: "amount",
        card: {
          // @ts-expect-error - 'nonexistent' does not exist in schema
          title: "nonexistent",
        },
      },
    });
  });

  it("enforces semantic view constraints: calendar.dateField and calendar.start only accept date fields", () => {
    const validCalendar = defineCollection({
      name: "events",
      fields: {
        name: f.text(),
        eventDate: f.date(),
        createdAt: f.datetime(),
      },
      calendar: {
        title: "name",
        start: "eventDate",
        end: "createdAt",
        dateField: "eventDate",
      },
    });

    expect(validCalendar.calendar?.start).toBe("eventDate");

    defineCollection({
      name: "invalid_calendar",
      fields: {
        name: { type: "text" },
        amount: { type: "number" },
        eventDate: { type: "date" },
      },
      calendar: {
        // @ts-expect-error - 'name' is text, not date/datetime
        start: "name",
        // @ts-expect-error - 'amount' is number, not date/datetime
        dateField: "amount",
      },
    });
  });

  it("enforces keyof TFields in list, grid, and identifier configurations", () => {
    const collection = defineCollection({
      name: "products",
      fields: {
        sku: f.text(),
        name: f.text(),
        price: f.currency(),
        photo: f.text(),
      },
      identifier: {
        field: "sku",
        titleField: "name",
      },
      list: {
        title: "name",
        subtitle: "sku",
        trailing: "price",
      },
      grid: {
        title: "name",
        image: "photo",
      },
    });

    expect(collection.identifier?.field).toBe("sku");
    expect(collection.list?.title).toBe("name");
    expect(collection.grid?.image).toBe("photo");

    defineCollection({
      name: "invalid_misc_views",
      fields: {
        name: { type: "text" },
      },
      identifier: {
        // @ts-expect-error - 'sku' does not exist in schema
        field: "sku",
        // @ts-expect-error - 'description' does not exist in schema
        titleField: "description",
      },
      list: {
        // @ts-expect-error - 'price' does not exist in schema
        title: "price",
      },
      grid: {
        // @ts-expect-error - 'photo' does not exist in schema
        image: "photo",
      },
    });
  });

  it("verifies type utility helpers SelectableFieldKeys, DateFieldKeys, NumericFieldKeys, TextFieldKeys", () => {
    type TestSchema = {
      id: { type: "number" };
      title: { type: "text" };
      stage: { type: "select"; options: ["a", "b"] };
      dueDate: { type: "date" };
      updatedAt: { type: "datetime" };
      price: { type: "currency" };
    };

    expectTypeOf<SelectableFieldKeys<TestSchema>>().toEqualTypeOf<"stage">();
    expectTypeOf<DateFieldKeys<TestSchema>>().toEqualTypeOf<"dueDate" | "updatedAt">();
    expectTypeOf<NumericFieldKeys<TestSchema>>().toEqualTypeOf<"id" | "price">();
    expectTypeOf<TextFieldKeys<TestSchema>>().toEqualTypeOf<"title">();
  });

  it("matches the exact compile-time and runtime behavior from Issue #109", () => {
    const dealsCollection = defineCollection({
      name: "deals",
      fields: {
        title: { type: "text" },
        amount: { type: "number" },
        stage: { type: "select", options: ["lead", "won"] },
      },
      table: {
        columns: ["title", "amount"],
      },
      kanban: {
        groupBy: "stage",
      },
    });

    expect(dealsCollection.table?.columns).toEqual(["title", "amount"]);
    expect(dealsCollection.kanban?.groupBy).toBe("stage");
  });
});
