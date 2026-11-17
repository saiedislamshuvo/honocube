import * as React from "react";
import { useState } from "react";
import {
  BellRing,
  Plus,
  Trash2,
  CheckCircle2,
  Sliders,
  Send,
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
  evaluateRule,
  renderNotification,
  type NotificationRule,
  type NotificationCondition,
  type NotificationChannelConfig,
  type NotificationChannelType,
  type NotificationSeverity,
  type ConditionOperator,
  type NotificationRuleDialogProps,
} from "@honocube/core";

export function NotificationRuleDialog({
  open,
  onOpenChange,
  rule: initialRule,
  availableResources = ["orders", "inventory", "customers", "invoices", "tasks"],
  onSaveRule,
  isSaving = false,
}: NotificationRuleDialogProps): React.JSX.Element | null {
  const [name, setName] = useState<string>(initialRule?.name || "");
  const [resource, setResource] = useState<string>(initialRule?.resource || availableResources[0] || "*");
  const [event, setEvent] = useState<string>(initialRule?.event || "create");
  const [matchAll, setMatchAll] = useState<boolean>(initialRule?.matchAll !== false);
  const [conditions, setConditions] = useState<NotificationCondition[]>(
    initialRule?.conditions || []
  );
  const [titleTemplate, setTitleTemplate] = useState<string>(
    initialRule?.template?.title || "Alert: {{id}}"
  );
  const [bodyTemplate, setBodyTemplate] = useState<string>(
    initialRule?.template?.body || "A new event was recorded for {{id}}."
  );
  const [severity, setSeverity] = useState<NotificationSeverity>(
    initialRule?.template?.severity || "info"
  );
  const [channels, setChannels] = useState<NotificationChannelConfig[]>(
    initialRule?.channels || [{ type: "in_app" }]
  );

  // Test evaluator preview state
  const [testPayload, setTestPayload] = useState<string>('{\n  "id": "1001",\n  "total": 1500,\n  "status": "pending"\n}');
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    matched: boolean;
    rendered?: { title: string; body: string; severity: NotificationSeverity };
  } | null>(null);

  const addCondition = () => {
    setConditions((prev) => [
      ...prev,
      { field: "status", operator: "equals", value: "pending" },
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

  const toggleChannel = (type: NotificationChannelType) => {
    const exists = channels.some((c) => c.type === type);
    if (exists) {
      setChannels((prev) => prev.filter((c) => c.type !== type));
    } else {
      setChannels((prev) => [...prev, { type, target: "" }]);
    }
  };

  const updateChannelTarget = (type: NotificationChannelType, target: string) => {
    setChannels((prev) =>
      prev.map((c) => (c.type === type ? { ...c, target } : c))
    );
  };

  const handleTestEvaluation = () => {
    try {
      const parsedData = JSON.parse(testPayload);
      const testRuleObj: NotificationRule = {
        id: initialRule?.id || "temp-test-rule",
        name: name || "Test Rule",
        enabled: true,
        resource,
        event,
        conditions,
        matchAll,
        template: {
          title: titleTemplate,
          body: bodyTemplate,
          severity,
        },
        channels,
      };

      const matched = evaluateRule(testRuleObj, {
        resource,
        type: event,
        data: parsedData,
      });

      if (matched) {
        const rendered = renderNotification(testRuleObj, {
          resource,
          type: event,
          data: parsedData,
        });
        setTestResult({ tested: true, matched: true, rendered });
      } else {
        setTestResult({ tested: true, matched: false });
      }
    } catch {
      setTestResult({ tested: true, matched: false });
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !onSaveRule) return;

    const ruleToSave: NotificationRule = {
      id: initialRule?.id || `rule_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      enabled: true,
      resource,
      event,
      conditions,
      matchAll,
      template: {
        title: titleTemplate,
        body: bodyTemplate,
        severity,
      },
      channels: channels.length > 0 ? channels : [{ type: "in_app" }],
    };

    await onSaveRule(ruleToSave);
    onOpenChange(false);
  };

  // SSR fallback
  if (typeof document === "undefined") {
    if (!open) return null;
    return (
      <div data-testid="notification-rule-dialog" className="hidden">
        <span>{`Notification Rule Builder: ${name || "New Rule"}`}</span>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="notification-rule-dialog" className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <BellRing className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                {initialRule?.id ? "Edit Notification Rule" : "Create Notification Rule"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Define automated triggers, message templates, and multi-channel delivery rules.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2 text-xs">
          {/* Rule Name & Event Selector */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="font-medium text-foreground block mb-1">Rule Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. High Value Order Alert"
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
                onChange={(e) => setEvent(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                data-testid="rule-event-select"
              >
                <option value="*">* (Any Action)</option>
                <option value="create">create (Record Created)</option>
                <option value="update">update (Record Updated)</option>
                <option value="delete">delete (Record Deleted)</option>
                <option value="toggle">toggle (Status Toggled)</option>
              </select>
            </div>
          </div>

          {/* Condition Builder */}
          <div className="rounded-md border p-3 bg-muted/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">Rule Conditions</span>
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
                  <span>Add</span>
                </Button>
              </div>
            </div>

            {conditions.length === 0 ? (
              <p className="text-[11px] text-muted-foreground py-1">
                No conditions set — notification will trigger on every {event} event for {resource}.
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
                      <option value="in">in (comma-sep)</option>
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

          {/* Message Template */}
          <div className="flex flex-col gap-2">
            <span className="font-semibold text-foreground">Notification Template</span>
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-3">
                <label className="text-[11px] text-muted-foreground block mb-0.5">
                  Title Template <span className="font-mono text-[10px] text-primary">{"{{id}}"}</span>
                </label>
                <input
                  type="text"
                  value={titleTemplate}
                  onChange={(e) => setTitleTemplate(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground block mb-0.5">Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as NotificationSeverity)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                  <option value="success">Success</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-muted-foreground block mb-0.5">
                Body Template (Supports <span className="font-mono text-[10px] text-primary">{"{{field}}"}</span> tokens)
              </label>
              <textarea
                value={bodyTemplate}
                onChange={(e) => setBodyTemplate(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-input bg-background p-2 text-xs font-sans"
              />
            </div>
          </div>

          {/* Delivery Channels */}
          <div>
            <span className="font-semibold text-foreground block mb-1.5">Delivery Channels</span>
            <div className="grid grid-cols-3 gap-2">
              {(["in_app", "email", "slack", "webhook", "telegram", "sms"] as NotificationChannelType[]).map(
                (ch) => {
                  const active = channels.some((c) => c.type === ch);
                  const channelConfig = channels.find((c) => c.type === ch);
                  return (
                    <div
                      key={ch}
                      className={`rounded-md border p-2 transition-colors ${
                        active ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => toggleChannel(ch)}
                            className="rounded border-input text-primary"
                          />
                          <span className="uppercase text-[10px] tracking-wider font-semibold">
                            {ch}
                          </span>
                        </label>
                        {active && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1 text-primary">
                            Enabled
                          </Badge>
                        )}
                      </div>
                      {active && ch !== "in_app" && (
                        <input
                          type="text"
                          placeholder={ch === "email" ? "user@example.com" : ch === "slack" ? "#channel or webhook" : "Target URL / number"}
                          value={channelConfig?.target || ""}
                          onChange={(e) => updateChannelTarget(ch, e.target.value)}
                          className="w-full h-6 mt-1.5 rounded border border-input bg-background px-1.5 text-[10px]"
                        />
                      )}
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* Test Evaluation Section */}
          <div className="rounded-md border p-2.5 bg-muted/20">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-medium text-foreground">Rule Test Playground</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestEvaluation}
                className="h-6 text-[11px] px-2 gap-1"
                data-testid="test-rule-button"
              >
                <Send className="h-3 w-3" />
                <span>Test Rule</span>
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
                      <span>Rule Matched! Rendered Output:</span>
                    </div>
                    <div className="mt-1 font-medium">{testResult.rendered?.title}</div>
                    <div className="text-[10px] opacity-90">{testResult.rendered?.body}</div>
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
            disabled={isSaving || !name.trim()}
            data-testid="save-rule-button"
            className="gap-1.5"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Save Rule</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
