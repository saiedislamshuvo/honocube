import * as React from "react";
import { useState, useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Trash2,
  ChevronDown,
  ChevronRight,
  Workflow,
  ArrowRight,
  Layers,
  Sparkles,
} from "lucide-react";
import { Button, Badge } from "@honocube/ui";
import {
  formatRelativeTime,
  type AutomationHistoryViewProps,
  type AutomationExecutionResult,
} from "@honocube/core";

export function AutomationHistoryView({
  logs = [],
  onClearLogs,
  isLoading = false,
  className = "",
}: AutomationHistoryViewProps): React.JSX.Element {
  const [filter, setFilter] = useState<"all" | "success" | "failure" | "skipped">("all");
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedLogIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredLogs = useMemo(() => {
    if (filter === "all") return logs;
    return logs.filter((log) => log.status === filter);
  }, [logs, filter]);

  const stats = useMemo(() => {
    const total = logs.length;
    const success = logs.filter((l) => l.status === "success").length;
    const failure = logs.filter((l) => l.status === "failure").length;
    const skipped = logs.filter((l) => l.status === "skipped").length;
    return { total, success, failure, skipped };
  }, [logs]);

  const getStatusBadge = (status: AutomationExecutionResult["status"]) => {
    switch (status) {
      case "success":
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 flex items-center gap-1 font-medium"
          >
            <CheckCircle2 className="h-3 w-3" />
            Success
          </Badge>
        );
      case "failure":
        return (
          <Badge
            variant="outline"
            className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 flex items-center gap-1 font-medium"
          >
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      case "skipped":
        return (
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 flex items-center gap-1 font-medium"
          >
            <AlertCircle className="h-3 w-3" />
            Skipped
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div
      className={`border rounded-xl bg-card text-card-foreground shadow-sm overflow-hidden ${className}`}
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b bg-muted/20">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Workflow className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Automation History</h3>
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {`${stats.total} ${stats.total === 1 ? "run" : "runs"}`}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live execution logs and trigger conditions for automated workflows
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter tabs */}
          <div className="flex items-center bg-muted/50 p-1 rounded-lg border text-xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === "all"
                  ? "bg-background text-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setFilter("success")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === "success"
                  ? "bg-background text-emerald-600 font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Success ({stats.success})
            </button>
            <button
              type="button"
              onClick={() => setFilter("failure")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === "failure"
                  ? "bg-background text-rose-600 font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Failed ({stats.failure})
            </button>
          </div>

          {onClearLogs && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearLogs}
              disabled={isLoading || logs.length === 0}
              className="text-xs h-8 text-muted-foreground hover:text-destructive gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Body content */}
      {filteredLogs.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center px-4">
          <div className="p-3 bg-muted rounded-full text-muted-foreground mb-3">
            <Clock className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium">No execution logs found</p>
          <p className="text-xs text-muted-foreground max-w-sm mt-1">
            {filter === "all"
              ? "Automated workflow executions and action logs will appear here when events match your configured rules."
              : `No automation runs with "${filter}" status were recorded.`}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {filteredLogs.map((log) => {
            const isExpanded = !!expandedLogIds[log.id];

            return (
              <div key={log.id} className="transition-colors hover:bg-muted/30">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpand(log.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleExpand(log.id);
                    }
                  }}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:px-4 cursor-pointer gap-2"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <button
                      type="button"
                      className="mt-0.5 sm:mt-0 text-muted-foreground hover:text-foreground p-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(log.id);
                      }}
                      aria-label={isExpanded ? "Collapse log details" : "Expand log details"}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{log.ruleName}</span>
                        {getStatusBadge(log.status)}
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                          {log.resource}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase tracking-wider text-muted-foreground">
                          {log.triggerEvent}
                        </Badge>
                        {log.recordId !== undefined && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {`#${String(log.recordId)}`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          {log.actionsExecuted} {log.actionsExecuted === 1 ? "action" : "actions"} executed
                        </span>
                        <span>•</span>
                        <span>{formatRelativeTime(log.timestamp)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground text-right sm:self-center font-mono pl-7 sm:pl-0">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </div>
                </div>

                {/* Expanded Action Step Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 bg-muted/10 border-t border-dashed">
                    <div className="mt-2 space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        Executed Action Sequence
                      </div>

                      {log.actionDetails && log.actionDetails.length > 0 ? (
                        <div className="space-y-1.5 pl-2 border-l-2 border-border ml-1">
                          {log.actionDetails.map((detail, idx) => (
                            <div
                              key={idx}
                              className="bg-card p-2.5 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs"
                            >
                              <div className="flex items-center gap-2">
                                {detail.status === "success" ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                                )}
                                <span className="font-mono font-medium text-foreground">
                                  {detail.action.type}
                                </span>
                                {detail.action.target && (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <ArrowRight className="h-3 w-3" />
                                    <span className="font-mono bg-muted px-1 rounded text-[11px]">
                                      {detail.action.target}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="text-right">
                                {detail.error ? (
                                  <span className="text-rose-500 font-mono text-[11px]">
                                    {detail.error}
                                  </span>
                                ) : detail.result ? (
                                  <span className="text-muted-foreground font-mono text-[11px] truncate max-w-xs inline-block">
                                    {typeof detail.result === "object"
                                      ? JSON.stringify(detail.result)
                                      : String(detail.result)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-[11px]">
                                    Completed
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground italic pl-2">
                          No actions were dispatched (rule was skipped or conditions did not match).
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
