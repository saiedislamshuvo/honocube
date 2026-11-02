import React, { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button, cn } from "@honocube/ui";
import type { Collection } from "../types/collection.js";
import { useCollectionWorkflow } from "../workflow/use-workflow.js";
import type { WorkflowActionBarProps } from "./types.js";

/**
 * Contextual workflow transition buttons matching available state transitions.
 */
export function WorkflowActionBar<TCollection extends Collection<any>>({
  collection,
  record,
  user,
  onTransitionSuccess,
  onTransitionError,
  className = "",
}: WorkflowActionBarProps<TCollection>): React.JSX.Element | null {
  if (!collection.workflow) {
    return null;
  }

  const [executingTransition, setExecutingTransition] = useState<string | null>(null);

  const {
    availableTransitions,
    executeTransition,
    isExecuting,
    isLocked,
  } = useCollectionWorkflow(collection, record, {
    user,
    onSuccess: (updatedRecord, transition) => {
      setExecutingTransition(null);
      onTransitionSuccess?.(updatedRecord, transition);
    },
    onError: (err) => {
      setExecutingTransition(null);
      onTransitionError?.(err);
    },
  });

  if (availableTransitions.length === 0) {
    if (isLocked) {
      return (
        <div
          data-testid="workflow-locked-indicator"
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium text-muted-foreground px-2 py-1 rounded border border-dashed border-border bg-muted/40",
            className
          )}
        >
          <Lock className="h-3.5 w-3.5" />
          <span>Locked</span>
        </div>
      );
    }
    return null;
  }

  return (
    <div
      data-testid="workflow-action-bar"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {availableTransitions.map((transition) => {
        const isCurrentExecuting = executingTransition === transition.name && isExecuting;
        const variant = transition.variant || "default";

        // Map variant
        let buttonVariant: "default" | "secondary" | "destructive" | "outline" = "default";
        let extraClasses = "";

        if (variant === "secondary") {
          buttonVariant = "secondary";
        } else if (variant === "destructive") {
          buttonVariant = "destructive";
        } else if (variant === "outline") {
          buttonVariant = "outline";
        } else if (variant === "success") {
          buttonVariant = "default";
          extraClasses = "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm";
        }

        return (
          <Button
            key={transition.name}
            data-testid={`workflow-transition-${transition.name}`}
            variant={buttonVariant}
            size="sm"
            disabled={isExecuting}
            className={cn("gap-1.5 h-8 text-xs font-medium", extraClasses)}
            onClick={async () => {
              setExecutingTransition(transition.name);
              try {
                await executeTransition(transition.name);
              } catch (e) {
                // Caught by onError option in useCollectionWorkflow
              }
            }}
          >
            {isCurrentExecuting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            <span>{transition.label || transition.name}</span>
          </Button>
        );
      })}
    </div>
  );
}
