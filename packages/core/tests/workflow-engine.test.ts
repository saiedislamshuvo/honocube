import { describe, it, expect } from "vitest";
import {
  getCurrentWorkflowState,
  isRecordLocked,
  getStateMetadata,
  getAvailableTransitions,
} from "../src/workflow/engine.js";
import type { WorkflowConfig } from "../src/types/workflow.js";

const invoiceWorkflow: WorkflowConfig<any> = {
  field: "status",
  initial: "draft",
  locked: ["submitted", "paid", "cancelled"],
  states: [
    { name: "draft", label: "Draft", variant: "secondary" },
    { name: "submitted", label: "Pending Approval", variant: "default" },
    { name: "paid", label: "Paid in Full", variant: "success", color: "#10b981" },
    { name: "cancelled", label: "Void", variant: "destructive" },
  ],
  transitions: {
    submit: {
      from: "draft",
      to: "submitted",
      label: "Submit for Approval",
      canExecute: ({ record }) => (record.amount || 0) > 0,
    },
    approve: {
      from: "submitted",
      to: "paid",
      label: "Approve & Pay",
      role: "finance_manager",
      variant: "success",
    },
    cancel: {
      from: ["draft", "submitted"],
      to: "cancelled",
      label: "Cancel Invoice",
      variant: "destructive",
      role: ["admin", "finance_manager"],
    },
  },
};

describe("Workflow State Machine Engine (engine.ts)", () => {
  describe("getCurrentWorkflowState", () => {
    it("returns record status or workflow initial fallback", () => {
      expect(getCurrentWorkflowState(invoiceWorkflow, { status: "submitted" })).toBe(
        "submitted"
      );
      expect(getCurrentWorkflowState(invoiceWorkflow, { status: "" })).toBe("draft");
      expect(getCurrentWorkflowState(invoiceWorkflow, {})).toBe("draft");
      expect(getCurrentWorkflowState(undefined, {})).toBe("");
    });
  });

  describe("isRecordLocked", () => {
    it("identifies locked document states", () => {
      expect(isRecordLocked(invoiceWorkflow, { status: "draft" })).toBe(false);
      expect(isRecordLocked(invoiceWorkflow, { status: "submitted" })).toBe(true);
      expect(isRecordLocked(invoiceWorkflow, { status: "paid" })).toBe(true);
      expect(isRecordLocked(invoiceWorkflow, { status: "cancelled" })).toBe(true);
      expect(isRecordLocked(undefined, {})).toBe(false);
    });
  });

  describe("getStateMetadata", () => {
    it("resolves state metadata with human label, variant, and color", () => {
      const paidMeta = getStateMetadata(invoiceWorkflow, "paid");
      expect(paidMeta.name).toBe("paid");
      expect(paidMeta.label).toBe("Paid in Full");
      expect(paidMeta.variant).toBe("success");
      expect(paidMeta.color).toBe("#10b981");
      expect(paidMeta.isLocked).toBe(true);

      const unconfiguredMeta = getStateMetadata(invoiceWorkflow, "custom_state");
      expect(unconfiguredMeta.label).toBe("Custom State");
      expect(unconfiguredMeta.variant).toBe("default");
      expect(unconfiguredMeta.isLocked).toBe(false);
    });
  });

  describe("getAvailableTransitions", () => {
    it("filters transitions by source state", () => {
      // In draft state with amount > 0, user has admin role
      const transitions = getAvailableTransitions(
        invoiceWorkflow,
        { status: "draft", amount: 100 },
        { role: "admin" }
      );

      const names = transitions.map((t) => t.name);
      expect(names).toContain("submit");
      expect(names).toContain("cancel");
      expect(names).not.toContain("approve"); // approve is from "submitted"
    });

    it("evaluates canExecute guards", () => {
      // Amount is 0 -> submit should be blocked by canExecute
      const transitions = getAvailableTransitions(
        invoiceWorkflow,
        { status: "draft", amount: 0 },
        { role: "admin" }
      );

      const names = transitions.map((t) => t.name);
      expect(names).not.toContain("submit");
      expect(names).toContain("cancel");
    });

    it("enforces role-based transition gating", () => {
      // User is staff -> cannot approve or cancel
      const staffTransitions = getAvailableTransitions(
        invoiceWorkflow,
        { status: "submitted" },
        { role: "staff" }
      );
      expect(staffTransitions).toHaveLength(0);

      // User is finance_manager -> can approve and cancel
      const managerTransitions = getAvailableTransitions(
        invoiceWorkflow,
        { status: "submitted" },
        { role: "finance_manager" }
      );
      const names = managerTransitions.map((t) => t.name);
      expect(names).toContain("approve");
      expect(names).toContain("cancel");
    });

    it("supports multi-role user arrays (user.roles)", () => {
      const transitions = getAvailableTransitions(
        invoiceWorkflow,
        { status: "submitted" },
        { roles: ["auditor", "finance_manager"] }
      );
      const names = transitions.map((t) => t.name);
      expect(names).toContain("approve");
    });
  });
});
