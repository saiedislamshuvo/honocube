export type NotificationSeverity = "info" | "warning" | "error" | "success";

export type NotificationChannelType =
  | "in_app"
  | "email"
  | "webhook"
  | "slack"
  | "telegram"
  | "sms";

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equal"
  | "less_than_or_equal"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "in"
  | "not_in"
  | "is_empty"
  | "is_not_empty"
  | "changed";

export interface NotificationCondition {
  field: string;
  operator: ConditionOperator;
  value?: any;
}

export interface NotificationChannelConfig {
  type: NotificationChannelType;
  target?: string;
  options?: Record<string, any>;
}

export interface NotificationTemplate {
  title: string;
  body: string;
  severity?: NotificationSeverity;
}

export interface NotificationRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  resource: string; // e.g. "orders", "inventory", or "*"
  event?: string; // e.g. "create", "update", "delete", "toggle", or "*"
  conditions?: NotificationCondition[];
  matchAll?: boolean; // true = AND, false = OR (default true)
  template: NotificationTemplate;
  channels: NotificationChannelConfig[];
  tenantId?: string;
}

export interface InAppNotification {
  id: string;
  ruleId?: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  resource?: string;
  recordId?: string | number;
  data?: any;
  read: boolean;
  createdAt: number;
  tenantId?: string;
}

export interface DispatchedNotification {
  id: string;
  ruleId: string;
  channel: NotificationChannelConfig;
  title: string;
  body: string;
  severity: NotificationSeverity;
  event: any;
  timestamp: number;
  tenantId?: string;
}

/**
 * Safely resolves a dot-delimited property path on an object (e.g. "customer.name" or "items.0.sku").
 */
export function getNestedValue(obj: any, path: string): any {
  if (obj === undefined || obj === null || !path) return undefined;
  if (path in obj) return obj[path];

  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Interpolates template strings containing {{token}} or {{nested.token}} with values from data object.
 * Example:
 * interpolateTemplate("Order #{{id}} for ${{total}}", { id: 101, total: 250 })
 * -> "Order #101 for $250"
 */
export function interpolateTemplate(template: string, data: Record<string, any> = {}): string {
  if (!template) return "";

  // Prepare context supporting root, data, record, and meta aliases
  const context: Record<string, any> = {
    ...data,
    record: data.data || data.record || data,
    event: data,
  };

  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_match, token) => {
    // 1. Direct or nested lookup in data
    let val = getNestedValue(data, token);
    if (val !== undefined && val !== null) {
      return String(val);
    }

    // 2. Lookup in record/data child
    val = getNestedValue(context.record, token);
    if (val !== undefined && val !== null) {
      return String(val);
    }

    // 3. Fallback to empty string
    return "";
  });
}

/**
 * Evaluates whether a single condition holds true for a record.
 */
export function evaluateCondition(
  record: any,
  condition: NotificationCondition,
  previousRecord?: any
): boolean {
  if (!record || typeof record !== "object") return false;

  const actualValue = getNestedValue(record, condition.field);
  const targetValue = condition.value;

  switch (condition.operator) {
    case "equals":
      return String(actualValue) === String(targetValue);

    case "not_equals":
      return String(actualValue) !== String(targetValue);

    case "greater_than": {
      const a = Number(actualValue);
      const b = Number(targetValue);
      return !isNaN(a) && !isNaN(b) && a > b;
    }

    case "less_than": {
      const a = Number(actualValue);
      const b = Number(targetValue);
      return !isNaN(a) && !isNaN(b) && a < b;
    }

    case "greater_than_or_equal": {
      const a = Number(actualValue);
      const b = Number(targetValue);
      return !isNaN(a) && !isNaN(b) && a >= b;
    }

    case "less_than_or_equal": {
      const a = Number(actualValue);
      const b = Number(targetValue);
      return !isNaN(a) && !isNaN(b) && a <= b;
    }

    case "contains":
      if (actualValue === undefined || actualValue === null) return false;
      return String(actualValue)
        .toLowerCase()
        .includes(String(targetValue).toLowerCase());

    case "starts_with":
      if (actualValue === undefined || actualValue === null) return false;
      return String(actualValue)
        .toLowerCase()
        .startsWith(String(targetValue).toLowerCase());

    case "ends_with":
      if (actualValue === undefined || actualValue === null) return false;
      return String(actualValue)
        .toLowerCase()
        .endsWith(String(targetValue).toLowerCase());

    case "in":
      if (Array.isArray(targetValue)) {
        return targetValue.some((item) => String(item) === String(actualValue));
      }
      return false;

    case "not_in":
      if (Array.isArray(targetValue)) {
        return !targetValue.some((item) => String(item) === String(actualValue));
      }
      return true;

    case "is_empty":
      return (
        actualValue === undefined ||
        actualValue === null ||
        actualValue === "" ||
        (Array.isArray(actualValue) && actualValue.length === 0)
      );

    case "is_not_empty":
      return (
        actualValue !== undefined &&
        actualValue !== null &&
        actualValue !== "" &&
        (!Array.isArray(actualValue) || actualValue.length > 0)
      );

    case "changed": {
      if (!previousRecord) return true;
      const prevVal = getNestedValue(previousRecord, condition.field);
      return String(actualValue) !== String(prevVal);
    }

    default:
      return false;
  }
}

/**
 * Evaluates whether a NotificationRule matches an incoming event.
 */
export function evaluateRule(
  rule: NotificationRule,
  event: {
    resource: string;
    type: string;
    data?: any;
    previousData?: any;
    tenantId?: string;
  }
): boolean {
  if (!rule.enabled) return false;

  // 1. Check resource match
  if (rule.resource !== "*" && rule.resource !== event.resource) {
    return false;
  }

  // 2. Check event type match
  if (rule.event && rule.event !== "*" && rule.event !== event.type) {
    return false;
  }

  // 3. Check tenant match
  if (rule.tenantId && event.tenantId && rule.tenantId !== event.tenantId) {
    return false;
  }

  // 4. Check conditions
  const conditions = rule.conditions || [];
  if (conditions.length === 0) return true;

  const record = event.data || {};
  const matchAll = rule.matchAll !== false; // Default AND

  if (matchAll) {
    return conditions.every((cond) => evaluateCondition(record, cond, event.previousData));
  } else {
    return conditions.some((cond) => evaluateCondition(record, cond, event.previousData));
  }
}

/**
 * Renders notification title, body, and severity from rule template and event data.
 */
export function renderNotification(
  rule: NotificationRule,
  event: {
    resource: string;
    type: string;
    data?: any;
    [key: string]: any;
  }
): { title: string; body: string; severity: NotificationSeverity } {
  const data = event.data || event;
  const title = interpolateTemplate(rule.template.title, data);
  const body = interpolateTemplate(rule.template.body, data);
  const severity = rule.template.severity || "info";

  return { title, body, severity };
}

/**
 * Returns a human-readable relative time string (e.g. "Just now", "5m ago", "2h ago", "Yesterday").
 */
export function formatRelativeTime(timestamp: number | string | Date): string {
  const date = typeof timestamp === "object" ? timestamp.getTime() : new Date(timestamp).getTime();
  if (isNaN(date)) return "";

  const now = Date.now();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 45) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;

  return new Date(date).toLocaleDateString();
}
