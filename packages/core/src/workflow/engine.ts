import type { WorkflowConfig, WorkflowState } from "../types/workflow.js";
import type { AvailableTransition, WorkflowStateMeta } from "./types.js";
import { toHumanLabel } from "../utils/format.js";

/**
 * Resolves current workflow state string from record or workflow initial fallback.
 */
export function getCurrentWorkflowState(
  workflow: WorkflowConfig<any> | undefined,
  record: Record<string, any>
): string {
  if (!workflow) return "";
  const val = record?.[workflow.field];
  if (typeof val === "string" && val.trim() !== "") {
    return val;
  }
  return workflow.initial || "draft";
}

/**
 * Checks whether the record is currently in a locked state where editing is prevented.
 */
export function isRecordLocked(
  workflow: WorkflowConfig<any> | undefined,
  record: Record<string, any>
): boolean {
  if (!workflow || !workflow.locked || !Array.isArray(workflow.locked)) {
    return false;
  }
  const current = getCurrentWorkflowState(workflow, record);
  return workflow.locked.includes(current);
}

/**
 * Resolves metadata (label, styling, locked flag) for a given workflow state.
 */
export function getStateMetadata(
  workflow: WorkflowConfig<any> | undefined,
  stateName: string
): WorkflowStateMeta {
  const isLocked = Boolean(workflow?.locked?.includes(stateName));
  const fallbackLabel = stateName ? toHumanLabel(stateName) : "Draft";

  if (!workflow?.states || !Array.isArray(workflow.states)) {
    return {
      name: stateName,
      label: fallbackLabel,
      variant: "default",
      isLocked,
    };
  }

  const found = workflow.states.find((s) =>
    typeof s === "string" ? s === stateName : s?.name === stateName
  );

  if (typeof found === "object" && found !== null) {
    const s = found as WorkflowState;
    return {
      name: s.name,
      label: s.label || toHumanLabel(s.name),
      color: s.color,
      variant: s.variant || "default",
      isLocked,
    };
  }

  return {
    name: stateName,
    label: fallbackLabel,
    variant: "default",
    isLocked,
  };
}

/**
 * Computes all currently executable workflow transitions from current record state,
 * filtered by role permissions and custom execution preconditions.
 */
export function getAvailableTransitions<TRecord = Record<string, unknown>>(
  workflow: WorkflowConfig<TRecord> | undefined,
  record: Record<string, any>,
  user?: Record<string, unknown>
): AvailableTransition<TRecord>[] {
  if (!workflow || !workflow.transitions) {
    return [];
  }

  const current = getCurrentWorkflowState(workflow, record);
  const result: AvailableTransition<TRecord>[] = [];

  for (const [key, transition] of Object.entries(workflow.transitions)) {
    // 1. Source state matching
    const fromList = Array.isArray(transition.from)
      ? transition.from
      : [transition.from];
    const fromMatches = fromList.includes(current) || fromList.includes("*");
    if (!fromMatches) {
      continue;
    }

    // 2. Role permission check
    if (transition.role) {
      const allowedRoles = Array.isArray(transition.role)
        ? transition.role
        : [transition.role];

      const userRoles: string[] = [];
      if (user?.role) userRoles.push(String(user.role));
      if (Array.isArray(user?.roles)) {
        userRoles.push(...user.roles.map(String));
      }

      const hasRole = allowedRoles.some((r) => userRoles.includes(r));
      if (!hasRole) {
        continue;
      }
    }

    // 3. Execution precondition guard
    if (typeof transition.canExecute === "function") {
      try {
        const allowed = transition.canExecute({
          record: record as TRecord,
          user,
        });
        if (!allowed) {
          continue;
        }
      } catch {
        continue;
      }
    }

    result.push({
      name: key,
      to: transition.to,
      from: transition.from,
      label: transition.label || toHumanLabel(key || transition.to),
      variant: transition.variant || "default",
      role: transition.role,
      canExecute: transition.canExecute,
    });
  }

  return result;
}
