import * as React from "react";
import { useState } from "react";
import {
  Zap,
  Plus,
  Trash2,
  CheckCircle2,
  Send,
  Workflow,
} from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Badge,
} from "@honocube/ui";
import {
  evaluateCondition,
  interpolateTemplate,
  type AutomationRule,
  type AutomationCondition,
  type AutomationActionConfig,
  type AutomationActionType,
  type AutomationTriggerEvent,
  type ConditionOperator,
  type AutomationRuleDialogProps,
} from "@honocube/core";

export function AutomationRuleDialog({
  open,
  onOpenChange,
  rule: initialRule,
  availableResources = ["tickets", "orders", "tasks", "invoices", "customers"],
  onSaveRule,
  isSaving = false,
}: AutomationRuleDialogProps): React.JSX.Element | null {
  const [name, setName] = useState<string>(initialRule?.name || "");
  const [description, setDescription] = useState<string>(initialRule?.description || "");
  const [resource, setResource] = useState<string>(
    initialRule?.resource || availableResources[0] || "*"
  );
  const [event, setEvent] = useState<AutomationTriggerEvent>(initialRule?.event || "create");
  const [matchAll, setMatchAll] = useState<boolean>(initialRule?.matchAll !== false);
  const [conditions, setConditions] = useState<AutomationCondition[]>(
    initialRule?.conditions || []
  );
  const [actions, setActions] = useState<AutomationActionConfig[]>(
    initialRule?.actions || [
      {
        type: "update_field",
        target: "status",
        value: "escalated",
      },
    ]
  );

  // Test run playground state
  const [testPayload, setTestPayload] = useState<string>(
    '{\n  "id": "1001",\n  "priority": "urgent",\n  "status": "open"\n}'
  );
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    matched: boolean;
    actionPreviews?: Array<{ type: string; summary: string }>;
  } | null>(null);

  const addCondition = () => {
    setConditions((prev) => [
      ...prev,
      { field: "priority", operator: "equals", value: "urgent" },
    ]);
  };

  const removeCondition = (index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCondition = (
    index: number,
    field: string,
    operator: ConditionOperator,
    value: any
  ) => {
    setConditions((prev) =>
      prev.map((c, i) => (i === index ? { field, operator, value } : c))
    );
  };

  const addAction = () => {
    setActions((prev) => [
      ...prev,
      {
        type: "send_notification",
        target: "admin",
        value: "Automated alert for {{id}}.",
        options: { title: "Automated Workflow Trigger", severity: "info" },
      },
    ]);
  };

  const removeAction = (index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateActionType = (index: number, newType: AutomationActionType) => {
    setActions((prev) =>
      prev.map((a, i) => {
        if (i !== index) return a;
        switch (newType) {
          case "update_field":
            return { type: newType, target: "status", value: "in_progress" };
          case "send_notification":
            return {
              type: newType,
              target: "admin",
              value: "Alert for {{id}}.",
              options: { title: "Workflow Alert", severity: "info" },
            };
          case "webhook_post":
            return { type: newType, target: "https://example.com/webhook", value: "" };
          case "create_record":
            return { type: newType, target: "tasks", value: { title: "Follow up on {{id}}" } };
          case "log_activity":
            return { type: newType, value: "Action executed for {{id}}." };
          default:
            return { type: newType };
        }
      })
    );
  };

  const updateActionTarget = (index: number, target: string) => {
    setActions((prev) =>
      prev.map((a, i) => (i === index ? { ...a, target } : a))
    );
  };

  const updateActionValue = (index: number, value: any) => {
    setActions((prev) =>
      prev.map((a, i) => (i === index ? { ...a, value } : a))
    );
  };

  const handleTestEvaluation = () => {
    try {
      const record = JSON.parse(testPayload);
      let matched = true;

      if (conditions.length > 0) {
        if (matchAll) {
          matched = conditions.every((cond) => evaluateCondition(record, cond));
        } else {
          matched = conditions.some((cond) => evaluateCondition(record, cond));
        }
      }

      if (matched) {
        const actionPreviews = actions.map((act) => {
          let summary = "";
          if (act.type === "update_field") {
            summary = `Set ${act.target} = "${interpolateTemplate(String(act.value), record)}"`;
          } else if (act.type === "send_notification") {
            summary = `Notify: "${interpolateTemplate(String(act.value), record)}"`;
          } else if (act.type === "webhook_post") {
            summary = `POST to ${act.target}`;
          } else if (act.type === "create_record") {
            summary = `Create in ${act.target}`;
          } else if (act.type === "log_activity") {
            summary = `Log: "${interpolateTemplate(String(act.value), record)}"`;
          }
          return { type: act.type, summary };
        });
        setTestResult({ tested: true, matched: true, actionPreviews });
      } else {
        setTestResult({ tested: true, matched: false });
      }
    } catch {
      setTestResult({ tested: true, matched: false });
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !onSaveRule) return;

    const ruleToSave: AutomationRule = {
      id:
        initialRule?.id ||
        `auto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      description: description.trim() || undefined,
      enabled: true,
      resource,
      event,
      conditions,
      matchAll,
      actions,
    };

    await onSaveRule(ruleToSave);
    onOpenChange(false);
  };

  // SSR fallback
  if (typeof document === "undefined") {
    if (!open) return null;
    return (
      <div data-testid="automation-rule-dialog" className="hidden">
        <span>{`Workflow Automation Builder: ${name || "New Workflow Rule"}`}</span>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="automation-rule-dialog" className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                {initialRule?.id ? "Edit Workflow Automation Rule" : "Create Workflow Automation Rule"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Trigger automated conditional actions (notifications, field updates, webhooks) on entity state changes.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2 text-xs">
          {/* Rule Name, Resource, and Trigger */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="font-medium text-foreground block mb-1">Workflow Name *</label>
              <input
                type="text"
                placeholder="e.g. Escalate Urgent Tickets"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                data-testid="rule-name-input"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Target Resource</label>
              <select
                value={resource}
                onChange={(e) => setResource(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                data-testid="rule-resource-select"
              >
                <option value="*">* (All Resources)</option>
                {availableResources.map((res) => (
                  <option key={res} value={res}>
                    {res}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Trigger Event</label>
              <select
                value={event}
                onChange={(e) => setEvent(e.target.value as AutomationTriggerEvent)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                data-testid="rule-event-select"
              >
                <option value="create">create (Record Created)</option>
                <option value="update">update (Record Updated)</option>
                <option value="delete">delete (Record Deleted)</option>
                <option value="toggle">toggle (Status Toggled)</option>
                <option value="state_change">state_change (State Transition)</option>
                <option value="*">* (Any Event)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-medium text-foreground block mb-1">Description</label>
            <input
              type="text"
              placeholder="Optional summary of this automation rule"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
            />
          </div>

          {/* Condition Builder */}
          <div className="rounded-md border p-3 bg-muted/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">Trigger Conditions</span>
                <span className="text-muted-foreground text-[10px]">
                  ({conditions.length} {conditions.length === 1 ? "condition" : "conditions"})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMatchAll((prev) => !prev)}
                  className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Logic: <span className="font-medium text-primary">{matchAll ? "AND (All)" : "OR (Any)"}</span>
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCondition}
                  className="h-6 text-[11px] px-2 gap-1"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Condition</span>
                </Button>
              </div>
            </div>

            {conditions.length === 0 ? (
              <p className="text-[11px] text-muted-foreground py-1">
                No conditions configured — actions will execute unconditionally whenever {resource}:{event} triggers.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {conditions.map((cond, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="field"
                      value={cond.field}
                      onChange={(e) => updateCondition(idx, e.target.value, cond.operator, cond.value)}
                      className="w-1/3 h-7 rounded border border-input bg-background px-2 text-xs font-mono"
                    />
                    <select
                      value={cond.operator}
                      onChange={(e) => updateCondition(idx, cond.field, e.target.value as ConditionOperator, cond.value)}
                      className="w-1/3 h-7 rounded border border-input bg-background px-1 text-xs"
                    >
                      <option value="equals">equals</option>
                      <option value="not_equals">not_equals</option>
                      <option value="greater_than">greater_than</option>
                      <option value="less_than">less_than</option>
                      <option value="greater_than_or_equal">greater_than_or_equal</option>
                      <option value="less_than_or_equal">less_than_or_equal</option>
                      <option value="contains">contains</option>
                      <option value="in">in</option>
                      <option value="changed">changed</option>
                    </select>
                    <input
                      type="text"
                      placeholder="value"
                      value={cond.value !== undefined ? String(cond.value) : ""}
                      onChange={(e) => updateCondition(idx, cond.field, cond.operator, e.target.value)}
                      className="flex-1 h-7 rounded border border-input bg-background px-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeCondition(idx)}
                      className="text-muted-foreground hover:text-destructive cursor-pointer p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Builder */}
          <div className="rounded-md border p-3 bg-muted/15 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Actions to Execute</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAction}
                className="h-6 text-[11px] px-2 gap-1"
                data-testid="add-action-button"
              >
                <Plus className="h-3 w-3" />
                <span>Add Action</span>
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              {actions.map((act, idx) => (
                <div key={idx} className="rounded border bg-background p-2.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">
                        Step {idx + 1}
                      </Badge>
                      <select
                        value={act.type}
                        onChange={(e) => updateActionType(idx, e.target.value as AutomationActionType)}
                        className="h-7 rounded border border-input bg-background px-2 text-xs font-medium"
                      >
                        <option value="update_field">Update Entity Field</option>
                        <option value="send_notification">Send Notification</option>
                        <option value="webhook_post">Dispatch Webhook</option>
                        <option value="create_record">Create Related Record</option>
                        <option value="log_activity">Log Activity Record</option>
                      </select>
                    </div>
                    {actions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAction(idx)}
                        className="text-muted-foreground hover:text-destructive cursor-pointer p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">
                        {act.type === "update_field"
                          ? "Field to Mutate"
                          : act.type === "webhook_post"
                          ? "Webhook Destination URL"
                          : act.type === "create_record"
                          ? "Target Collection Name"
                          : "Target Channel / Recipient"}
                      </label>
                      <input
                        type="text"
                        value={act.target || ""}
                        placeholder={act.type === "update_field" ? "e.g. status" : act.type === "webhook_post" ? "https://..." : "Target"}
                        onChange={(e) => updateActionTarget(idx, e.target.value)}
                        className="w-full h-7 rounded border border-input bg-background px-2 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">
                        {act.type === "update_field"
                          ? "New Field Value (Supports {{token}})"
                          : "Message / Payload Template"}
                      </label>
                      <input
                        type="text"
                        value={typeof act.value === "string" ? act.value : JSON.stringify(act.value || "")}
                        placeholder="Value or template"
                        onChange={(e) => updateActionValue(idx, e.target.value)}
                        className="w-full h-7 rounded border border-input bg-background px-2 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Test Playground */}
          <div className="rounded-md border p-2.5 bg-muted/20">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-medium text-foreground">Rule Test Playground</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestEvaluation}
                className="h-6 text-[11px] px-2 gap-1"
                data-testid="test-automation-button"
              >
                <Send className="h-3 w-3" />
                <span>Test Execution</span>
              </Button>
            </div>
            <textarea
              value={testPayload}
              onChange={(e) => setTestPayload(e.target.value)}
              rows={2}
              className="w-full rounded border border-input bg-background p-1.5 font-mono text-[10px]"
            />
            {testResult?.tested && (
              <div className="mt-2 text-[11px]">
                {testResult.matched ? (
                  <div className="p-2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    <div className="flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Rule Matched! Actions that would execute:</span>
                    </div>
                    <ul className="mt-1 list-disc list-inside text-[10px] space-y-0.5">
                      {testResult.actionPreviews?.map((ap, i) => (
                        <li key={i}>
                          <span className="font-mono uppercase font-semibold">{ap.type}</span>: {ap.summary}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="p-2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    <span>Conditions did not match the test payload.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !name.trim() || actions.length === 0}
            data-testid="save-automation-button"
            className="gap-1.5"
          >
            <Workflow className="h-3.5 w-3.5" />
            <span>Save Workflow</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
