import { describe, expect, it, beforeAll } from "vitest";
import { resolveWorkspaceRoute, getAvailableTransitions, getStateMetadata, evaluateComputedFields } from "@honocube/app";
import { api, ensureDbInitialized } from "../lib/cube.api";
import { app, invoicesCollection } from "../lib/cube.app";

describe("Showcase CRM App Verification", () => {
  beforeAll(async () => {
    await ensureDbInitialized();
  });

  describe("HonoCube Backend API Route Handlers", () => {
    it("returns seeded deals with Kanban pipeline stages", async () => {
      const res = await api.request("/deals");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(6);

      const stages = json.data.map((d: any) => d.stage);
      expect(stages).toContain("proposal");
      expect(stages).toContain("negotiation");
      expect(stages).toContain("lead");
      expect(stages).toContain("won");
    });

    it("returns seeded contacts directory", async () => {
      const res = await api.request("/contacts");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(5);
      expect(json.data[0].email).toBeDefined();
    });

    it("returns seeded invoices with ERP workflow status", async () => {
      const res = await api.request("/invoices");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(3);

      const invoice = json.data[0];
      expect(invoice.invoiceNumber).toMatch(/^INV-/);
      expect(invoice.grandTotal).toBeGreaterThan(0);
    });

    it("supports creating new deal via POST /deals", async () => {
      const res = await api.request("/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Venture Deal",
          company: "Umbrella Corp",
          amount: 85000,
          stage: "qualified",
          priority: "high",
          contactName: "Albert Wesker",
          contactEmail: "albert@umbrella.com",
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.title).toBe("New Venture Deal");
      expect(json.data.amount).toBe(85000);
    });
  });

  describe("Workspace Routing & App Architecture", () => {
    it("resolves home dashboard route when slug is empty", () => {
      const route = resolveWorkspaceRoute(app, []);
      expect(route.type).toBe("home");
    });

    it("resolves collection list / kanban view for /deals", () => {
      const route = resolveWorkspaceRoute(app, ["deals"]);
      expect(route.type).toBe("list");
      expect(route.collectionName).toBe("deals");
      expect(route.collection?.defaultView).toBe("kanban");
    });

    it("resolves create record route for /deals/new", () => {
      const route = resolveWorkspaceRoute(app, ["deals", "new"]);
      expect(route.type).toBe("create");
      expect(route.collectionName).toBe("deals");
    });

    it("resolves detail record route for /invoices/1", () => {
      const route = resolveWorkspaceRoute(app, ["invoices", "1"]);
      expect(route.type).toBe("detail");
      expect(route.collectionName).toBe("invoices");
      expect(route.recordId).toBe("1");
    });

    it("resolves 404 not-found route for non-existent collections", () => {
      const route = resolveWorkspaceRoute(app, ["non-existent-xyz"]);
      expect(route.type).toBe("not-found");
      expect(route.collectionName).toBe("non-existent-xyz");
    });
  });

  describe("Workflow State Machine Engine on Invoices with RBAC Roles", () => {
    const adminUser = { role: "admin" };
    const salesUser = { role: "sales" };

    it("provides correct draft state transitions for admin", () => {
      const draftRecord = { status: "draft", invoiceNumber: "INV-2026-0001" };
      const transitions = getAvailableTransitions(invoicesCollection.workflow, draftRecord, adminUser);
      expect(transitions.length).toBeGreaterThan(0);

      const targetStates = transitions.map((t) => t.to);
      expect(targetStates).toContain("submitted");
      expect(targetStates).toContain("cancelled");
    });

    it("enforces role permissions: admin can approve invoice, sales cannot", () => {
      const submittedRecord = { status: "submitted", invoiceNumber: "INV-2026-0001" };

      // Admin has permission to approve
      const adminTransitions = getAvailableTransitions(invoicesCollection.workflow, submittedRecord, adminUser);
      const adminTargets = adminTransitions.map((t) => t.to);
      expect(adminTargets).toContain("approved");
      expect(adminTargets).toContain("draft");
      expect(adminTargets).toContain("cancelled");

      // Sales rep can only submit or return, NOT approve
      const salesTransitions = getAvailableTransitions(invoicesCollection.workflow, submittedRecord, salesUser);
      const salesTargets = salesTransitions.map((t) => t.to);
      expect(salesTargets).not.toContain("approved");
    });

    it("locks records in paid state with no further transitions", () => {
      const paidRecord = { status: "paid", invoiceNumber: "INV-2026-0002" };
      const transitions = getAvailableTransitions(invoicesCollection.workflow, paidRecord, adminUser);
      expect(transitions.length).toBe(0);

      const stateMeta = getStateMetadata(invoicesCollection.workflow, "paid");
      expect(stateMeta.label).toBe("Paid");
      expect(stateMeta.isLocked).toBe(true);
    });
  });
  describe("Invoice Child Line Items & Formulas", () => {
    it("defines items collection field in invoicesCollection and includes it in form section", () => {
      const itemsField = invoicesCollection.getField("items");
      expect(itemsField).toBeDefined();
      expect(itemsField?.type).toBe("collection");

      const formSections = invoicesCollection.form?.tabs?.[0]?.sections || [];
      const lineItemSection = formSections.find((s) => s.title === "Line Items");
      expect(lineItemSection).toBeDefined();
      expect(lineItemSection?.fields).toContain("items");
    });

    it("evaluates live subtotal, tax, and grand total rollups from child line items", () => {
      const record = {
        items: [
          { description: "Item 1", quantity: 2, unitPrice: 100 },
          { description: "Item 2", quantity: 1, unitPrice: 50 },
        ],
      };

      const evaluated = evaluateComputedFields(invoicesCollection.fields, record) as any;
      expect(evaluated.items[0].amount).toBe(200);
      expect(evaluated.items[1].amount).toBe(50);
      expect(evaluated.subtotal).toBe(250);
      expect(evaluated.tax).toBe(25);
      expect(evaluated.grandTotal).toBe(275);
    });
  });
});
