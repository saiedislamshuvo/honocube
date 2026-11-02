import React from "react";
import {
  ArrowLeft,
  Copy,
  MoreHorizontal,
  Printer,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from "@honocube/ui";
import type { Collection } from "../types/collection.js";
import { getCurrentWorkflowState, getStateMetadata } from "../workflow/engine.js";
import { WorkflowActionBar } from "./workflow-action-bar.js";
import type { DocumentHeaderProps } from "./types.js";

/**
 * Prominent ERP/CRM document header displaying naming series badge, record title,
 * lifecycle status, contextual workflow action buttons, and standard document actions.
 */
export function DocumentHeader<TCollection extends Collection<any>>({
  collection,
  record,
  title,
  identifier,
  subtitle,
  user,
  onBack,
  backHref,
  onTransitionSuccess,
  onTransitionError,
  onAction,
  actions,
  extraActions,
  showWorkflow = true,
  actionsMenuOpen,
  className = "",
}: DocumentHeaderProps<TCollection>): React.JSX.Element {
  const rec = (record || {}) as Record<string, any>;

  // 1. Resolve Identifier (Naming series / Code / ID)
  let resolvedIdentifier: React.ReactNode = identifier;
  if (!resolvedIdentifier) {
    if (collection.identifier?.field && rec[collection.identifier.field]) {
      resolvedIdentifier = String(rec[collection.identifier.field]);
    } else if (rec.namingSeries) {
      resolvedIdentifier = String(rec.namingSeries);
    } else if (rec.code) {
      resolvedIdentifier = String(rec.code);
    } else if (rec.id !== undefined && rec.id !== null) {
      resolvedIdentifier = `#${rec.id}`;
    }
  }

  // 2. Resolve Title
  let resolvedTitle: React.ReactNode = title;
  if (!resolvedTitle) {
    if (collection.identifier?.titleField && rec[collection.identifier.titleField]) {
      resolvedTitle = String(rec[collection.identifier.titleField]);
    } else if (rec.title) {
      resolvedTitle = String(rec.title);
    } else if (rec.name) {
      resolvedTitle = String(rec.name);
    } else if (rec.subject) {
      resolvedTitle = String(rec.subject);
    } else {
      const entityName = collection.singular || collection.label || collection.name;
      resolvedTitle = rec.id ? `${entityName} #${rec.id}` : `New ${entityName}`;
    }
  }

  // 3. Resolve Workflow Status Badge
  let statusBadge: React.ReactNode = null;
  if (collection.workflow) {
    const currentState = getCurrentWorkflowState(collection.workflow, rec);
    const meta = getStateMetadata(collection.workflow, currentState);
    statusBadge = (
      <Badge
        data-testid="document-status-badge"
        variant={meta.variant || "secondary"}
        className="text-xs capitalize"
      >
        {meta.label || currentState}
      </Badge>
    );
  } else if (rec.status) {
    statusBadge = (
      <Badge
        data-testid="document-status-badge"
        variant="secondary"
        className="text-xs capitalize"
      >
        {String(rec.status)}
      </Badge>
    );
  }

  // 4. Default Action Menu Handlers
  const handleAction = (actionKey: string) => {
    if (onAction) {
      onAction(actionKey);
    } else {
      if (actionKey === "print" && typeof window !== "undefined") {
        window.print();
      }
    }
  };

  return (
    <div
      data-testid="document-header"
      className={cn(
        "flex flex-col gap-4 border-b border-border bg-background pb-5 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      {/* Left Column: Back button + Identifier + Title + Status */}
      <div className="flex items-start gap-3">
        {(onBack || backHref) && (
          <div className="pt-0.5">
            {backHref && !onBack ? (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <a href={backHref} aria-label="Back">
                  <ArrowLeft className="h-4 w-4" />
                </a>
              </Button>
            ) : (
              <Button
                data-testid="document-header-back-button"
                variant="ghost"
                size="icon"
                onClick={onBack}
                aria-label="Back"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {resolvedIdentifier && (
              <Badge
                data-testid="document-identifier-badge"
                variant="outline"
                className="font-mono text-xs font-semibold px-2 py-0.5 bg-muted/30"
              >
                {resolvedIdentifier}
              </Badge>
            )}
            {statusBadge}
          </div>

          <h1
            data-testid="document-title"
            className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate"
          >
            {resolvedTitle}
          </h1>

          {subtitle && (
            <div
              data-testid="document-subtitle"
              className="text-xs sm:text-sm text-muted-foreground"
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Workflow Action Buttons + Actions Dropdown */}
      <div className="flex flex-wrap items-center gap-2 sm:self-center">
        {showWorkflow && collection.workflow && (
          <WorkflowActionBar
            collection={collection}
            record={record}
            user={user}
            onTransitionSuccess={onTransitionSuccess}
            onTransitionError={onTransitionError}
          />
        )}

        {extraActions}
        {actions}

        {/* Document Action Menu */}
        <DropdownMenu open={actionsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              data-testid="document-actions-trigger"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-medium"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              data-testid="action-print"
              onClick={() => handleAction("print")}
              className="cursor-pointer text-xs"
            >
              <Printer className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Print PDF</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              data-testid="action-duplicate"
              onClick={() => handleAction("duplicate")}
              className="cursor-pointer text-xs"
            >
              <Copy className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Duplicate</span>
            </DropdownMenuItem>

            {collection.actions && collection.actions.length > 0 && (
              <>
                <DropdownMenuSeparator />
                {collection.actions.map((act) => {
                  if (act.visible && !act.visible({ record, user })) {
                    return null;
                  }
                  return (
                    <DropdownMenuItem
                      key={act.name}
                      data-testid={`action-custom-${act.name}`}
                      onClick={() => {
                        if (act.execute) {
                          act.execute({ record });
                        }
                        handleAction(act.name);
                      }}
                      className="cursor-pointer text-xs"
                    >
                      <span>{act.label}</span>
                    </DropdownMenuItem>
                  );
                })}
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid="action-delete"
              onClick={() => handleAction("delete")}
              className="cursor-pointer text-xs text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4 text-destructive" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
