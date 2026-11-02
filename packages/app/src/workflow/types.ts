import type { WorkflowState, WorkflowTransition, WorkflowVariant } from "../types/workflow.js";

export interface AvailableTransition<TRecord = Record<string, unknown>>
  extends WorkflowTransition<TRecord> {
  name: string;
  label: string;
  variant: WorkflowVariant;
}

export interface WorkflowStateMeta extends WorkflowState {
  isLocked: boolean;
}

export interface UseWorkflowOptions<TRecord = Record<string, unknown>> {
  id?: string | number;
  user?: Record<string, unknown>;
  onSuccess?: (updatedRecord: TRecord, transition: AvailableTransition<TRecord>) => void;
  onError?: (error: Error) => void;
}

export interface UseWorkflowReturn<TRecord = Record<string, unknown>> {
  /**
   * Current document workflow state value (e.g. "draft", "submitted", "approved").
   */
  currentState: string;

  /**
   * Resolved metadata for the current state (label, badge color/variant, isLocked).
   */
  stateMeta: WorkflowStateMeta;

  /**
   * Whether the document is in a locked state where editing is frozen.
   */
  isLocked: boolean;

  /**
   * Available transitions from the current state, filtered by role and execution guards.
   */
  availableTransitions: AvailableTransition<TRecord>[];

  /**
   * Fast check if transition to a given target state is currently available.
   */
  canTransitionTo: (targetState: string) => boolean;

  /**
   * Dispatches transition mutation to the backend and updates cache.
   */
  executeTransition: (
    actionOrTarget: string,
    patch?: Partial<TRecord>
  ) => Promise<TRecord>;

  /**
   * Whether a transition API call is currently in flight.
   */
  isExecuting: boolean;
}
