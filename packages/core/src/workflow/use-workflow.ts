import { useState, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Collection, InferRecord } from "../types/collection.js";
import { useApiClient } from "../query/provider.js";
import { queryKeys } from "../query/keys.js";
import {
  getCurrentWorkflowState,
  getStateMetadata,
  isRecordLocked,
  getAvailableTransitions,
} from "./engine.js";
import type {
  UseWorkflowOptions,
  UseWorkflowReturn,
  WorkflowStateMeta,
} from "./types.js";

/**
 * Headless hook to manage document workflow states, locked state checking,
 * role-gated transitions, and transition mutation execution.
 */
export function useCollectionWorkflow<
  TCollection extends Collection<any>,
  TRecord = InferRecord<TCollection>
>(
  collection: TCollection,
  record: TRecord,
  options: UseWorkflowOptions<TRecord> = {}
): UseWorkflowReturn<TRecord> {
  const { id: explicitId, user, onSuccess, onError } = options;
  const client = useApiClient();
  const queryClient = useQueryClient();

  const workflow = collection.workflow;
  const [isExecuting, setIsExecuting] = useState(false);

  // 1. Current State & Metadata
  const currentState = useMemo(() => {
    return getCurrentWorkflowState(workflow, record as Record<string, any>);
  }, [workflow, record]);

  const stateMeta: WorkflowStateMeta = useMemo(() => {
    return getStateMetadata(workflow, currentState);
  }, [workflow, currentState]);

  const isLocked = useMemo(() => {
    return isRecordLocked(workflow, record as Record<string, any>);
  }, [workflow, record]);

  // 2. Available Transitions
  const availableTransitions = useMemo(() => {
    return getAvailableTransitions<TRecord>(workflow as any, record as Record<string, any>, user);
  }, [workflow, record, user]);

  const canTransitionTo = useCallback(
    (targetState: string): boolean => {
      return availableTransitions.some((t) => t.to === targetState || t.name === targetState);
    },
    [availableTransitions]
  );

  // 3. Execute Transition Mutation
  const executeTransition = useCallback(
    async (
      actionOrTarget: string,
      patch?: Partial<TRecord>
    ): Promise<TRecord> => {
      if (!workflow) {
        throw new Error(`Collection '${collection.name}' does not have a workflow defined.`);
      }

      const matching = availableTransitions.find(
        (t) => t.name === actionOrTarget || t.to === actionOrTarget
      );

      if (!matching) {
        throw new Error(
          `Transition '${actionOrTarget}' is not available from current state '${currentState}'.`
        );
      }

      const recordId = explicitId ?? (record as any)?.id;
      if (recordId === undefined || recordId === null || recordId === "") {
        throw new Error(`Cannot execute workflow transition on an unpersisted record without an ID.`);
      }

      const endpoint = collection.endpoint || `/api/${collection.name}`;
      const payload = {
        [workflow.field]: matching.to,
        ...patch,
      };

      setIsExecuting(true);
      try {
        const res = await client.patch<TRecord>(`${endpoint}/${recordId}`, payload);
        const updated = res.data;

        // Invalidate collection queries in cache
        queryClient.invalidateQueries({
          queryKey: queryKeys.collection.all(collection.name),
        });

        onSuccess?.(updated, matching);
        return updated;
      } catch (err: any) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        onError?.(errorObj);
        throw errorObj;
      } finally {
        setIsExecuting(false);
      }
    },
    [
      workflow,
      availableTransitions,
      explicitId,
      record,
      collection.endpoint,
      collection.name,
      currentState,
      client,
      queryClient,
      onSuccess,
      onError,
    ]
  );

  return {
    currentState,
    stateMeta,
    isLocked,
    availableTransitions,
    canTransitionTo,
    executeTransition,
    isExecuting,
  };
}
