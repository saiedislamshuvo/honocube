import {
  evaluateCondition,
  interpolateTemplate,
  getNestedValue,
  type ConditionOperator,
} from "../notifications/rules.js";
import type { EventBus, RealtimeEvent } from "../types.js";

export type AutomationTriggerEvent =
  | "create"
  | "update"
  | "delete"
  | "toggle"
  | "state_change"
  | "*";

export type AutomationActionType =
  | "update_field"
  | "send_notification"
  | "webhook_post"
  | "create_record"
  | "log_activity";

export interface AutomationCondition {
  field: string;
  operator: ConditionOperator;
  value?: any;
}

export interface AutomationActionConfig {
  type: AutomationActionType;
  target?: string; // Field name for update_field, webhook URL, target collection for create_record
  value?: any; // New value, or JSON payload template
  options?: Record<string, any>;
}

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  resource: string; // Target resource or "*"
  event: AutomationTriggerEvent;
  fromState?: string;
  toState?: string;
  conditions?: AutomationCondition[];
  matchAll?: boolean; // default true (AND)
  actions: AutomationActionConfig[];
  tenantId?: string;
}

export interface AutomationActionResult {
  action: AutomationActionConfig;
  status: "success" | "failure";
  result?: any;
  error?: string;
}

export interface AutomationExecutionResult {
  id: string;
  ruleId: string;
  ruleName: string;
  triggerEvent: string;
  resource: string;
  recordId?: string | number;
  status: "success" | "failure" | "skipped";
  timestamp: number;
  actionsExecuted: number;
  actionDetails: AutomationActionResult[];
  tenantId?: string;
}

export type ActionHandler = (
  action: AutomationActionConfig,
  context: {
    event: RealtimeEvent;
    record: any;
    rule: AutomationRule;
  }
) => Promise<any> | any;

export interface AutomationEngineOptions {
  eventBus?: EventBus;
  notificationEngine?: any;
  initialRules?: AutomationRule[];
  actionHandlers?: Record<string, ActionHandler>;
  maxLogsLimit?: number;
}

export interface AutomationEngine {
  addRule(rule: AutomationRule): AutomationRule;
  getRules(resource?: string): AutomationRule[];
  getRule(id: string): AutomationRule | undefined;
  updateRule(id: string, updates: Partial<AutomationRule>): AutomationRule | undefined;
  removeRule(id: string): boolean;
  registerActionHandler(type: AutomationActionType | string, handler: ActionHandler): void;
  getExecutionLogs(limit?: number): AutomationExecutionResult[];
  clearExecutionLogs(): void;
  processEvent(event: RealtimeEvent): Promise<AutomationExecutionResult[]>;
  testRule(
    rule: AutomationRule,
    mockPayload: any
  ): {
    matched: boolean;
    actionsToRun: Array<{ action: AutomationActionConfig; preview?: any }>;
  };
}

/**
 * Creates a low-code workflow automation engine for conditional trigger-condition-action execution.
 */
export function createAutomationEngine(
  options: AutomationEngineOptions = {}
): AutomationEngine {
  const rules = new Map<string, AutomationRule>();
  const actionHandlers = new Map<string, ActionHandler>();
  const executionLogs: AutomationExecutionResult[] = [];
  const maxLogs = options.maxLogsLimit || 500;
  const eventBus = options.eventBus;
  const notificationEngine = options.notificationEngine;

  // 1. Default Handler: update_field
  actionHandlers.set("update_field", async (action, { record }) => {
    if (!action.target) return { updated: false, reason: "No target field specified" };
    let finalValue = action.value;
    if (typeof finalValue === "string") {
      finalValue = interpolateTemplate(finalValue, record);
    }
    record[action.target] = finalValue;
    return { field: action.target, value: finalValue };
  });

  // 2. Default Handler: send_notification
  actionHandlers.set("send_notification", async (action, { record, event }) => {
    const titleTemplate = action.options?.title || "Workflow Alert: {{id}}";
    const bodyTemplate = typeof action.value === "string" ? action.value : action.options?.body || "Automated action executed for {{id}}.";
    const severity = action.options?.severity || "info";

    const title = interpolateTemplate(titleTemplate, record);
    const body = interpolateTemplate(bodyTemplate, record);

    if (notificationEngine && notificationEngine.store) {
      notificationEngine.store.add({
        id: `notif_auto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title,
        body,
        severity,
        resource: event.resource,
        recordId: record?.id,
        read: false,
        createdAt: Date.now(),
        tenantId: event.tenantId,
      });
    }

    if (eventBus) {
      eventBus.publish({
        type: "notification:received",
        resource: "notifications",
        data: { title, body, severity, recordId: record?.id },
        tenantId: event.tenantId,
      });
    }

    return { sent: true, title, body, severity };
  });

  // 3. Default Handler: webhook_post
  actionHandlers.set("webhook_post", async (action, { record, event }) => {
    const url = action.target;
    if (!url) return { dispatched: false, reason: "No webhook URL provided" };

    const payload = typeof action.value === "object"
      ? action.value
      : { event: event.type, resource: event.resource, data: record, timestamp: Date.now() };

    return { dispatched: true, url, payload };
  });

  // 4. Default Handler: create_record
  actionHandlers.set("create_record", async (action, { record }) => {
    const targetCollection = action.target;
    const initialData = typeof action.value === "object" ? { ...action.value } : {};

    // Interpolate string fields in initialData
    for (const [k, v] of Object.entries(initialData)) {
      if (typeof v === "string") {
        initialData[k] = interpolateTemplate(v, record);
      }
    }

    return { created: true, collection: targetCollection, data: initialData };
  });

  // 5. Default Handler: log_activity
  actionHandlers.set("log_activity", async (action, { record, event, rule }) => {
    const messageTemplate = typeof action.value === "string" ? action.value : `Workflow '${rule.name}' triggered on ${event.resource}`;
    const message = interpolateTemplate(messageTemplate, record);
    return { logged: true, message, timestamp: Date.now() };
  });

  // Register user custom handlers
  if (options.actionHandlers) {
    for (const [type, handler] of Object.entries(options.actionHandlers)) {
      actionHandlers.set(type, handler);
    }
  }

  // Register initial rules
  if (options.initialRules) {
    for (const rule of options.initialRules) {
      rules.set(rule.id, rule);
    }
  }

  const engine: AutomationEngine = {
    addRule(rule) {
      rules.set(rule.id, rule);
      return rule;
    },

    getRules(resource) {
      const all = Array.from(rules.values());
      if (resource && resource !== "*") {
        return all.filter((r) => r.resource === "*" || r.resource === resource);
      }
      return all;
    },

    getRule(id) {
      return rules.get(id);
    },

    updateRule(id, updates) {
      const existing = rules.get(id);
      if (!existing) return undefined;
      const updated = { ...existing, ...updates };
      rules.set(id, updated);
      return updated;
    },

    removeRule(id) {
      return rules.delete(id);
    },

    registerActionHandler(type, handler) {
      actionHandlers.set(type, handler);
    },

    getExecutionLogs(limit = 100) {
      return executionLogs.slice(0, limit);
    },

    clearExecutionLogs() {
      executionLogs.length = 0;
    },

    async processEvent(event) {
      const record = event.data || {};
      const results: AutomationExecutionResult[] = [];

      for (const rule of rules.values()) {
        if (!rule.enabled) continue;

        // 1. Resource match
        if (rule.resource !== "*" && rule.resource !== event.resource) {
          continue;
        }

        // 2. Trigger event match
        if (rule.event !== "*" && rule.event !== event.type) {
          // Special state_change check
          if (rule.event === "state_change") {
            const statusVal = record.status || record.state;
            const prevStatusVal = getNestedValue(event.meta, "previousStatus");
            if (rule.fromState && prevStatusVal !== rule.fromState) continue;
            if (rule.toState && statusVal !== rule.toState) continue;
          } else {
            continue;
          }
        }

        // 3. Tenant match
        if (rule.tenantId && event.tenantId && rule.tenantId !== event.tenantId) {
          continue;
        }

        // 4. Conditions check
        const conditions = rule.conditions || [];
        const matchAll = rule.matchAll !== false; // Default AND
        let conditionsPassed = true;

        if (conditions.length > 0) {
          if (matchAll) {
            conditionsPassed = conditions.every((cond) =>
              evaluateCondition(record, cond, event.meta?.previousData)
            );
          } else {
            conditionsPassed = conditions.some((cond) =>
              evaluateCondition(record, cond, event.meta?.previousData)
            );
          }
        }

        if (!conditionsPassed) {
          continue;
        }

        // 5. Execute Actions
        const actionDetails: AutomationActionResult[] = [];
        let hasFailure = false;

        for (const action of rule.actions) {
          const handler = actionHandlers.get(action.type);
          if (handler) {
            try {
              const res = await handler(action, { event, record, rule });
              actionDetails.push({ action, status: "success", result: res });
            } catch (err: any) {
              hasFailure = true;
              actionDetails.push({
                action,
                status: "failure",
                error: err?.message || String(err),
              });
            }
          } else {
            actionDetails.push({
              action,
              status: "failure",
              error: `No handler registered for action type '${action.type}'`,
            });
            hasFailure = true;
          }
        }

        const executionLog: AutomationExecutionResult = {
          id: `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          ruleId: rule.id,
          ruleName: rule.name,
          triggerEvent: event.type,
          resource: event.resource,
          recordId: record.id,
          status: hasFailure ? "failure" : "success",
          timestamp: Date.now(),
          actionsExecuted: actionDetails.filter((a) => a.status === "success").length,
          actionDetails,
          tenantId: event.tenantId,
        };

        executionLogs.unshift(executionLog);
        if (executionLogs.length > maxLogs) {
          executionLogs.pop();
        }

        results.push(executionLog);
      }

      return results;
    },

    testRule(rule, mockPayload) {
      const record = mockPayload?.data || mockPayload || {};
      const conditions = rule.conditions || [];
      const matchAll = rule.matchAll !== false;

      let matched = true;
      if (conditions.length > 0) {
        if (matchAll) {
          matched = conditions.every((cond) =>
            evaluateCondition(record, cond, mockPayload?.previousData)
          );
        } else {
          matched = conditions.some((cond) =>
            evaluateCondition(record, cond, mockPayload?.previousData)
          );
        }
      }

      const actionsToRun = rule.actions.map((a) => {
        let preview = a.value;
        if (typeof a.value === "string") {
          preview = interpolateTemplate(a.value, record);
        }
        return { action: a, preview };
      });

      return { matched, actionsToRun };
    },
  };

  // Auto-subscribe to EventBus if provided
  if (eventBus) {
    eventBus.subscribe("*", (event) => {
      // Don't recurse on internal events
      if (event.resource === "notifications" || event.resource === "automations") return;
      engine.processEvent(event);
    });
  }

  return engine;
}
