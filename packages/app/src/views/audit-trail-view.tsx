import * as React from "react";
import { useState, useMemo } from "react";
import {
  History,
  PlusCircle,
  Pencil,
  Trash2,
  GitCommit,
  Activity,
  User,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Code2,
  Laptop,
  ShieldCheck,
} from "lucide-react";
import { Button, Badge } from "@honocube/ui";
import {
  formatRelativeTime,
  type AuditTrailViewProps,
  type AuditEntry,
  type AuditFieldDiff,
} from "@honocube/core";

export function AuditTrailView({
  entries = [],
  resource,
  recordId,
  onClearAudit,
  isLoading = false,
  className = "",
}: AuditTrailViewProps): React.JSX.Element {
  const [filterAction, setFilterAction] = useState<
    "all" | "create" | "update" | "delete" | "transition"
  >("all");
  const [expandedEntryIds, setExpandedEntryIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedEntryIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredEntries = useMemo(() => {
    let result = entries;

    if (resource) {
      result = result.filter(
        (e: AuditEntry) => e.resource.toLowerCase() === resource.toLowerCase()
      );
    }

    if (recordId !== undefined && recordId !== null) {
      result = result.filter(
        (e: AuditEntry) => String(e.recordId) === String(recordId)
      );
    }

    if (filterAction !== "all") {
      result = result.filter(
        (e: AuditEntry) => e.action.toLowerCase() === filterAction.toLowerCase()
      );
    }

    return result;
  }, [entries, resource, recordId, filterAction]);

  const stats = useMemo(() => {
    const total = entries.length;
    const creates = entries.filter((e: AuditEntry) => e.action === "create").length;
    const updates = entries.filter(
      (e: AuditEntry) => e.action === "update" || e.action === "batch-update"
    ).length;
    const deletes = entries.filter(
      (e: AuditEntry) => e.action === "delete" || e.action === "batch-delete"
    ).length;
    return { total, creates, updates, deletes };
  }, [entries]);

  const getActionBadge = (action: string) => {
    switch (action.toLowerCase()) {
      case "create":
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 flex items-center gap-1 font-medium text-xs"
          >
            <PlusCircle className="h-3 w-3" />
            <span>Create</span>
          </Badge>
        );
      case "update":
      case "batch-update":
        return (
          <Badge
            variant="outline"
            className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800 flex items-center gap-1 font-medium text-xs"
          >
            <Pencil className="h-3 w-3" />
            <span>Update</span>
          </Badge>
        );
      case "delete":
      case "batch-delete":
        return (
          <Badge
            variant="outline"
            className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 flex items-center gap-1 font-medium text-xs"
          >
            <Trash2 className="h-3 w-3" />
            <span>Delete</span>
          </Badge>
        );
      case "transition":
        return (
          <Badge
            variant="outline"
            className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 flex items-center gap-1 font-medium text-xs"
          >
            <GitCommit className="h-3 w-3" />
            <span>Transition</span>
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 flex items-center gap-1 font-medium text-xs capitalize"
          >
            <Activity className="h-3 w-3" />
            <span>{action}</span>
          </Badge>
        );
    }
  };

  const formatValue = (val: unknown): string => {
    if (val === null) return "null";
    if (val === undefined) return "undefined";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  return (
    <div
      className={`border rounded-xl bg-card text-card-foreground shadow-sm overflow-hidden ${className}`}
      data-testid="audit-trail-view"
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b bg-muted/20">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <History className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">
                {recordId
                  ? `Audit Trail for #${String(recordId)}`
                  : "Activity Log & Mutation Audit Trail"}
              </h3>
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {`${filteredEntries.length} ${
                  filteredEntries.length === 1 ? "entry" : "entries"
                }`}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Historical changes, field-level diff tracking, and request actor attribution
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Action filter tabs */}
          <div className="flex items-center bg-muted/50 p-1 rounded-lg border text-xs">
            <button
              type="button"
              onClick={() => setFilterAction("all")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filterAction === "all"
                  ? "bg-background text-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {`All (${stats.total})`}
            </button>
            <button
              type="button"
              onClick={() => setFilterAction("create")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filterAction === "create"
                  ? "bg-background text-emerald-600 font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {`Creates (${stats.creates})`}
            </button>
            <button
              type="button"
              onClick={() => setFilterAction("update")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filterAction === "update"
                  ? "bg-background text-sky-600 font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {`Updates (${stats.updates})`}
            </button>
            <button
              type="button"
              onClick={() => setFilterAction("delete")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filterAction === "delete"
                  ? "bg-background text-rose-600 font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {`Deletes (${stats.deletes})`}
            </button>
          </div>

          {onClearAudit && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearAudit}
              disabled={isLoading || entries.length === 0}
              className="text-xs h-8 text-muted-foreground hover:text-destructive gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Body content */}
      {filteredEntries.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center px-4">
          <div className="p-3 bg-muted rounded-full text-muted-foreground mb-3">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium">No audit entries found</p>
          <p className="text-xs text-muted-foreground max-w-sm mt-1">
            {filterAction === "all"
              ? "Mutations and actor changes will appear here automatically when documents are created, updated, or removed."
              : `No activity records matching "${filterAction}" action were found.`}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {filteredEntries.map((entry: AuditEntry, index: number) => {
            const entryKey = String(entry.id || index);
            const isExpanded = !!expandedEntryIds[entryKey];

            return (
              <div key={entryKey} className="transition-colors hover:bg-muted/30">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpand(entryKey)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleExpand(entryKey);
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
                        toggleExpand(entryKey);
                      }}
                      aria-label={isExpanded ? "Collapse audit details" : "Expand audit details"}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {getActionBadge(entry.action)}
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 font-mono"
                        >
                          {entry.resource}
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground">
                          {`#${String(entry.recordId)}`}
                        </span>
                        {entry.actorId && (
                          <span className="flex items-center gap-1 text-xs text-foreground font-medium">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span>{String(entry.actorId)}</span>
                          </span>
                        )}
                      </div>

                      {/* Field diff inline preview */}
                      {entry.diff && entry.diff.length > 0 ? (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 flex-wrap">
                          <span className="font-medium text-foreground">
                            {`${entry.diff.length} ${
                              entry.diff.length === 1 ? "field changed:" : "fields changed:"
                            }`}
                          </span>
                          {entry.diff.slice(0, 3).map((d: AuditFieldDiff, i: number) => (
                            <span
                              key={i}
                              className="font-mono bg-muted/60 px-1 py-0.5 rounded text-[11px]"
                            >
                              {d.field}
                            </span>
                          ))}
                          {entry.diff.length > 3 && (
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {`+${entry.diff.length - 3} more`}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground mt-1">
                          {entry.action === "create"
                            ? "Created new entity record"
                            : entry.action === "delete"
                            ? "Permanently removed entity record"
                            : "State change or action recorded"}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center text-xs text-muted-foreground">
                    {entry.ip && (
                      <span className="hidden md:flex items-center gap-1 font-mono text-[11px]">
                        <Laptop className="h-3 w-3" />
                        <span>{entry.ip}</span>
                      </span>
                    )}
                    <span>
                      {formatRelativeTime(new Date(entry.timestamp).getTime())}
                    </span>
                    <span className="font-mono">
                      {new Date(entry.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {/* Expanded Field Diffs and Snapshot Inspector */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 bg-muted/10 border-t border-dashed space-y-3">
                    {/* Field-level diff breakdown */}
                    {entry.diff && entry.diff.length > 0 && (
                      <div className="border rounded-lg bg-card p-3 space-y-2">
                        <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] flex items-center justify-between">
                          <span>Field-Level Value Changes</span>
                          <span className="font-mono text-[10px]">
                            {`${entry.diff.length} ${
                              entry.diff.length === 1 ? "diff" : "diffs"
                            }`}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {entry.diff.map((d: AuditFieldDiff, idx: number) => (
                            <div
                              key={idx}
                              className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-md bg-muted/30 border text-xs gap-2"
                            >
                              <span className="font-mono font-medium text-foreground">
                                {d.field}
                              </span>

                              <div className="flex items-center gap-2 font-mono text-[11px] flex-wrap">
                                <span className="bg-rose-500/10 text-rose-700 dark:text-rose-400 px-1.5 py-0.5 rounded border border-rose-200 line-through">
                                  {formatValue(d.from)}
                                </span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold">
                                  {formatValue(d.to)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Snapshots: Old vs New Data */}
                    {(entry.oldData || entry.newData) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {entry.oldData && (
                          <div className="border rounded-lg bg-card p-3 space-y-1.5">
                            <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <Code2 className="h-3 w-3 text-rose-500" />
                                Prior State (Old Data)
                              </span>
                              <span className="font-mono text-[10px]">snapshot</span>
                            </div>
                            <pre className="bg-muted/40 p-2 rounded text-[11px] font-mono overflow-x-auto max-h-48 text-muted-foreground">
                              {JSON.stringify(entry.oldData, null, 2)}
                            </pre>
                          </div>
                        )}

                        {entry.newData && (
                          <div className="border rounded-lg bg-card p-3 space-y-1.5">
                            <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <Code2 className="h-3 w-3 text-emerald-500" />
                                Resulting State (New Data)
                              </span>
                              <span className="font-mono text-[10px]">snapshot</span>
                            </div>
                            <pre className="bg-muted/40 p-2 rounded text-[11px] font-mono overflow-x-auto max-h-48 text-muted-foreground">
                              {JSON.stringify(entry.newData, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Request Context Metadata */}
                    <div className="border rounded-lg bg-card p-2.5 text-xs text-muted-foreground flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        {entry.ip && (
                          <span className="flex items-center gap-1">
                            <Laptop className="h-3 w-3" />
                            <span>{`IP: ${entry.ip}`}</span>
                          </span>
                        )}
                        {entry.userAgent && (
                          <span className="truncate max-w-sm sm:max-w-md" title={entry.userAgent}>
                            {`Agent: ${entry.userAgent}`}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11px]">
                        {new Date(entry.timestamp).toISOString()}
                      </span>
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
