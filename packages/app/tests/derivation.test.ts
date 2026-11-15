import { describe, it, expect } from "vitest";
import { z } from "zod";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import {
  pgTable,
  varchar,
  serial,
  integer as pgInteger,
  boolean as pgBoolean,
  timestamp,
  json,
} from "drizzle-orm/pg-core";
import {
  defineCollection,
  fromResource,
  fromDrizzleTable,
  deriveFieldsFromDrizzleTable,
  deriveFieldsFromZod,
  deriveFieldsFromResource,
  isDrizzleTable,
  getDrizzleTableName,
} from "../src/index.js";

describe("Single-Source-of-Truth Collection Derivation", () => {
  describe("1. Drizzle Table Derivation", () => {
    it("derives fields from SQLite table columns", () => {
      const dealsTable = sqliteTable("deals", {
        id: integer("id").primaryKey({ autoIncrement: true }),
        title: text("title").notNull(),
        amount: integer("amount").notNull().default(0),
        stage: text("stage").notNull().default("lead"),
        closeDate: text("close_date"),
        notes: text("notes"),
      });

      expect(isDrizzleTable(dealsTable)).toBe(true);
      expect(getDrizzleTableName(dealsTable)).toBe("deals");

      const fields = deriveFieldsFromDrizzleTable(dealsTable);

      // Primary key auto-increment
      expect(fields.id).toMatchObject({
        type: "number",
        label: "Id",
        readOnly: true,
      });

      // Required text
      expect(fields.title).toMatchObject({
        type: "text",
        label: "Title",
        required: true,
      });

      // Number with default
      expect(fields.amount).toMatchObject({
        type: "number",
        label: "Amount",
        default: 0,
      });

      // Optional text
      expect(fields.notes).toMatchObject({
        type: "text",
        label: "Notes",
        required: false,
      });
    });

    it("derives fields across various PostgreSQL column types", () => {
      const usersTable = pgTable("users", {
        id: serial("id").primaryKey(),
        fullName: varchar("full_name", { length: 255 }).notNull(),
        age: pgInteger("age"),
        isActive: pgBoolean("is_active").notNull().default(true),
        metadata: json("metadata"),
        createdAt: timestamp("created_at"),
      });

      const fields = deriveFieldsFromDrizzleTable(usersTable);

      expect(fields.id?.type).toBe("number");
      expect(fields.id?.readOnly).toBe(true);

      expect(fields.fullName?.type).toBe("text");
      expect(fields.fullName?.required).toBe(true);
      expect(fields.fullName?.label).toBe("Full Name");

      expect(fields.age?.type).toBe("number");
      expect(fields.age?.required).toBe(false);

      expect(fields.isActive?.type).toBe("boolean");
      expect(fields.isActive?.default).toBe(true);

      expect(fields.metadata?.type).toBe("json");
      expect(fields.createdAt?.type).toBe("date");
    });
  });

  describe("2. Zod Validator Derivation", () => {
    it("derives enums to select fields with options", () => {
      const validator = z.object({
        stage: z.enum(["lead", "qualified", "proposal", "won", "lost"]).default("lead"),
        priority: z.enum(["low", "medium", "high"]),
      });

      const fields = deriveFieldsFromZod(validator);

      expect(fields.stage).toMatchObject({
        type: "select",
        label: "Stage",
        options: ["lead", "qualified", "proposal", "won", "lost"],
        default: "lead",
        required: true,
      });

      expect(fields.priority).toMatchObject({
        type: "select",
        label: "Priority",
        options: ["low", "medium", "high"],
        required: true,
      });
    });

    it("extracts min, max, regex patterns, and nullability", () => {
      const validator = z.object({
        code: z.string().regex(/^[A-Z]{3}-\d+$/),
        score: z.number().min(0).max(100).default(50),
        optionalRemark: z.string().optional(),
        nullableScore: z.number().nullable(),
      });

      const fields = deriveFieldsFromZod(validator);

      expect(fields.code?.type).toBe("text");
      expect(fields.code?.pattern).toBe("^[A-Z]{3}-\\d+$");
      expect(fields.code?.required).toBe(true);

      expect(fields.score?.type).toBe("number");
      expect(fields.score?.min).toBe(0);
      expect(fields.score?.max).toBe(100);
      expect(fields.score?.default).toBe(50);

      expect(fields.optionalRemark?.required).toBe(false);
      expect(fields.nullableScore?.required).toBe(false);
    });

    it("unwraps validator arrays and { create, update } wrappers", () => {
      const createValidator = z.object({
        title: z.string().min(1),
        category: z.enum(["tech", "finance"]),
      });
      const updateValidator = createValidator.partial();

      // Array format: [createValidator, updateValidator]
      const arrayFields = deriveFieldsFromZod([createValidator, updateValidator]);
      expect(arrayFields.title?.type).toBe("text");
      expect(arrayFields.category?.type).toBe("select");

      // Object format: { create, update }
      const objectFields = deriveFieldsFromZod({ create: createValidator, update: updateValidator });
      expect(objectFields.title?.type).toBe("text");
      expect(objectFields.category?.options).toEqual(["tech", "finance"]);
    });
  });

  describe("3. Combined Resource Derivation & Field Precedence", () => {
    it("refines Drizzle table columns with Zod validation rules", () => {
      const dealsTable = sqliteTable("deals", {
        id: integer("id").primaryKey({ autoIncrement: true }),
        title: text("title").notNull(),
        amount: integer("amount").notNull().default(0),
        stage: text("stage").notNull().default("lead"),
        contactEmail: text("contact_email"),
      });

      const dealsResource = {
        name: "deals",
        table: dealsTable,
        validator: z.object({
          title: z.string().min(1),
          amount: z.number().min(0).default(0),
          stage: z.enum(["lead", "qualified", "proposal", "won"]).default("lead"),
          contactEmail: z.string().email().optional().nullable(),
        }),
      };

      const fields = deriveFieldsFromResource(dealsResource);

      // Elevated stage from text to select with options
      expect(fields.stage?.type).toBe("select");
      expect((fields.stage as any)?.options).toEqual(["lead", "qualified", "proposal", "won"]);
      expect(fields.stage?.default).toBe("lead");

      // Amount inherits min: 0 from Zod
      expect(fields.amount?.type).toBe("number");
      expect((fields.amount as any)?.min).toBe(0);

      // contactEmail is optional/nullable in Zod
      expect(fields.contactEmail?.required).toBe(false);
    });

    it("applies UI overrides cleanly over derived fields", () => {
      const dealsTable = sqliteTable("deals", {
        id: integer("id").primaryKey({ autoIncrement: true }),
        amount: integer("amount").notNull().default(0),
        notes: text("notes"),
      });

      const dealsResource = {
        name: "deals",
        table: dealsTable,
        validator: z.object({
          amount: z.number().min(0).default(0),
          notes: z.string().optional(),
        }),
      };

      const fields = deriveFieldsFromResource(dealsResource, {
        amount: {
          format: "currency",
          label: "Deal Value (USD)",
        },
        notes: {
          type: "textarea",
          placeholder: "Add internal sales notes...",
        },
        customComputed: {
          type: "computed",
          label: "Commission ($)",
          compute: (row: any) => (row.amount || 0) * 0.1,
        },
      });

      // amount merged format and label while keeping number type and min
      expect(fields.amount).toMatchObject({
        type: "number",
        label: "Deal Value (USD)",
        format: "currency",
        min: 0,
        default: 0,
      });

      // notes overridden to textarea with custom placeholder
      expect(fields.notes).toMatchObject({
        type: "textarea",
        placeholder: "Add internal sales notes...",
      });

      // customComputed added
      expect(fields.customComputed?.type).toBe("computed");
      expect(typeof (fields.customComputed as any)?.compute).toBe("function");
    });
  });

  describe("4. First-Class defineCollection({ resource, ... }) Integration", () => {
    it("defines a collection directly from an API resource with concise UI overrides", () => {
      const dealsTable = sqliteTable("deals", {
        id: integer("id").primaryKey({ autoIncrement: true }),
        title: text("title").notNull(),
        amount: integer("amount").notNull().default(0),
        stage: text("stage").notNull().default("lead"),
      });

      const dealsResource = {
        name: "deals",
        table: dealsTable,
        validator: z.object({
          title: z.string().min(1),
          amount: z.number().min(0).default(0),
          stage: z.enum(["lead", "qualified", "won"]).default("lead"),
        }),
      };

      const collection = defineCollection({
        resource: dealsResource,
        icon: "Briefcase",
        defaultView: "kanban",
        fields: {
          amount: { format: "currency", label: "Deal Value ($)" },
          stage: {
            options: [
              { value: "lead", label: "Lead In" },
              { value: "qualified", label: "Qualified Deal" },
              { value: "won", label: "Closed Won" },
            ],
          },
        },
        table: {
          columns: ["title", "amount", "stage"],
        },
        kanban: {
          groupBy: "stage",
        },
      });

      expect(collection.name).toBe("deals");
      expect(collection.endpoint).toBe("/api/deals");
      expect(collection.label).toBe("Deals");
      expect(collection.icon).toBe("Briefcase");
      expect(collection.defaultView).toBe("kanban");
      expect(collection._isCollection).toBe(true);

      // Auto identifier detected
      expect(collection.identifier).toEqual({
        field: "id",
        titleField: "title",
      });

      // Field inspection
      expect(collection.getField("title")).toMatchObject({
        type: "text",
        required: true,
      });

      expect(collection.getField("amount")).toMatchObject({
        type: "number",
        format: "currency",
        label: "Deal Value ($)",
        min: 0,
        default: 0,
      });

      expect((collection.getField("stage") as any)?.options).toEqual([
        { value: "lead", label: "Lead In" },
        { value: "qualified", label: "Qualified Deal" },
        { value: "won", label: "Closed Won" },
      ]);

      // TableViewConfig preserved
      expect(collection.table?.columns).toEqual(["title", "amount", "stage"]);
      expect(collection.getFieldKeys()).toContain("title");
      expect(collection.getFieldKeys()).toContain("amount");
      expect(collection.getFieldKeys()).toContain("stage");
    });

    it("defines a collection directly from a Drizzle table", () => {
      const contactsTable = sqliteTable("contacts", {
        id: integer("id").primaryKey({ autoIncrement: true }),
        name: text("name").notNull(),
        email: text("email").notNull(),
      });

      const collection = defineCollection({
        table: contactsTable,
        fields: {
          email: { placeholder: "user@example.com" },
        },
      });

      expect(collection.name).toBe("contacts");
      expect(collection.endpoint).toBe("/api/contacts");
      expect(collection.getField("name")?.required).toBe(true);
      expect((collection.getField("email") as any)?.placeholder).toBe("user@example.com");
    });
  });

  describe("5. Standalone fromResource & fromDrizzleTable Helpers", () => {
    it("fromResource returns clean collection metadata and fields", () => {
      const itemsTable = sqliteTable("line_items", {
        id: integer("id").primaryKey({ autoIncrement: true }),
        description: text("description").notNull(),
        quantity: integer("quantity").notNull().default(1),
      });

      const resource = {
        name: "line-items",
        table: itemsTable,
        validator: z.object({
          description: z.string().min(1),
          quantity: z.number().min(1).default(1),
        }),
      };

      const result = fromResource(resource, {
        quantity: { label: "Qty" },
      });

      expect(result.name).toBe("line-items");
      expect(result.endpoint).toBe("/api/line-items");
      expect(result.label).toBe("Line Items");
      expect(result.fields.description?.required).toBe(true);
      expect(result.fields.quantity?.label).toBe("Qty");

      // Can be spread directly into defineCollection
      const collection = defineCollection({
        ...result,
        icon: "List",
      });

      expect(collection.name).toBe("line-items");
      expect(collection.icon).toBe("List");
      expect(collection.getField("quantity")?.label).toBe("Qty");
    });

    it("fromDrizzleTable returns clean table metadata and fields", () => {
      const table = sqliteTable("invoices", {
        id: integer("id").primaryKey(),
        invoiceNumber: text("invoice_number").notNull(),
      });

      const result = fromDrizzleTable(table);
      expect(result.name).toBe("invoices");
      expect(result.endpoint).toBe("/api/invoices");
      expect(result.fields.invoiceNumber?.type).toBe("text");
    });
  });
});
