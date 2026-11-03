import { z } from "zod";
import { createApp, DrizzleAdapter, defineApi } from "@honocube/api";
import { db, ensureDbInitialized } from "./db";
import * as schema from "./schema";

const adapter = new DrizzleAdapter(db, { dialect: "sqlite", schema });
const { defineResource } = createApp({ adapter });

export const dealsResource = defineResource({
  name: "deals",
  table: schema.deals,
  timestamps: true,
  validator: z.object({
    title: z.string().min(1),
    company: z.string().min(1),
    amount: z.number().default(0),
    stage: z.enum(["lead", "qualified", "proposal", "negotiation", "won", "lost"]).default("lead"),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    contactName: z.string().optional().nullable(),
    contactEmail: z.string().email().optional().nullable(),
    closeDate: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  }),
});

export const contactsResource = defineResource({
  name: "contacts",
  table: schema.contacts,
  timestamps: true,
  validator: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    company: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    status: z.enum(["lead", "active", "churned"]).default("lead"),
  }),
});

export const invoicesResource = defineResource({
  name: "invoices",
  table: schema.invoices,
  timestamps: true,
  validator: z.object({
    invoiceNumber: z.string().min(1),
    customerName: z.string().min(1),
    issueDate: z.string().min(1),
    dueDate: z.string().min(1),
    currency: z.string().default("USD"),
    status: z.enum(["draft", "submitted", "approved", "paid", "cancelled"]).default("draft"),
    subtotal: z.number().default(0),
    tax: z.number().default(0),
    grandTotal: z.number().default(0),
    notes: z.string().optional().nullable(),
  }),
});

export const invoiceItemsResource = defineResource({
  name: "invoice-items",
  table: schema.invoiceItems,
  validator: z.object({
    invoiceId: z.number(),
    description: z.string().min(1),
    quantity: z.number().default(1),
    unitPrice: z.number().default(0),
    amount: z.number().default(0),
  }),
});

export const api = defineApi(
  {
    deals: dealsResource,
    contacts: contactsResource,
    invoices: invoicesResource,
    "invoice-items": invoiceItemsResource,
  },
  {
    docs: {
      enabled: true,
      title: "Showcase CRM API",
      version: "2.0.2",
    },
  }
);

export { ensureDbInitialized };
