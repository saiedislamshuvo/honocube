import { useState, useMemo, useEffect, useCallback, useRef, useContext } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import type { Collection, InferRecord } from "../types/collection.js";
import { useCollectionQuery } from "../query/use-query.js";
import { useCollectionMutation } from "../query/use-mutation.js";
import { useApiClient, AppContext } from "../query/provider.js";
import { getDefaultFormValues } from "./defaults.js";
import { evaluateComputedFields } from "./computed.js";
import { evaluateFieldCapability } from "./capabilities.js";
import { validateField, validateRecord } from "./validation.js";
import { createChildCollectionHelper } from "./child.js";
import { useCollectionWorkflow } from "../workflow/use-workflow.js";
import { extractConflictDetails } from "../concurrency/etag.js";
import type { RevisionConflict, ConflictResolutionAction } from "../concurrency/types.js";
import type {
  CollectionFormOptions,
  CollectionFormReturn,
  FormFieldState,
  FormMode,
  ChildCollectionHelper,
} from "./types.js";

export function useCollectionForm<TCollection extends Collection<any>>(
  collection: TCollection,
  options: CollectionFormOptions<TCollection> = {}
): CollectionFormReturn<TCollection> {
  const {
    id,
    initialValues,
    user,
    parentRecord,
    mode: explicitMode,
    autoFetch = true,
    onSubmit,
    onSuccess,
    onError,
    validator,
  } = options;

  const client = useApiClient();
  const appContext = useContext(AppContext);
  const notify = options.notify ?? appContext?.notify;
  const mutation = useCollectionMutation(collection);

  const mode: FormMode = useMemo(() => {
    if (explicitMode) return explicitMode;
    return id !== undefined && id !== null && id !== "" && id !== "new"
      ? "edit"
      : "create";
  }, [explicitMode, id]);

  const isEdit = mode === "edit" || (mode === "view" && id !== undefined);

  // 1. Fetch Existing Record if in Edit Mode
  const query = useCollectionQuery({
    collection,
    id: isEdit ? (id as string | number) : "__honocube_disabled_query__",
    queryOptions: {
      enabled: Boolean(isEdit && autoFetch),
    },
  });

  const serverRecord = isEdit ? (query.data?.data as InferRecord<TCollection> | undefined) : undefined;

  // 2. Initial Values Resolution (incorporates pre-fetched server record for SSR hydration)
  const defaultValues = useMemo(() => {
    const base = serverRecord ? { ...serverRecord, ...initialValues } : initialValues;
    return getDefaultFormValues(collection, base, parentRecord);
  }, [collection, serverRecord, initialValues, parentRecord]);

  // 3. TanStack Form Instance
  const form = useForm<InferRecord<TCollection>>({
    defaultValues,
  });

  // Ensure form derived store is mounted (vital for SSR & unit tests where layout effects don't fire)
  const isMountedRef = useRef(false);
  if (!isMountedRef.current) {
    form.mount();
    isMountedRef.current = true;
  }

  // Track submission & validation errors with synchronous ref + reactive state
  const [internalSubmitting, setInternalSubmitting] = useState(false);
  const errorsRef = useRef<Record<string, string[]>>({});
  const [, setErrorsState] = useState<Record<string, string[]>>({});

  const setErrors = useCallback((nextErrors: Record<string, string[]>) => {
    errorsRef.current = nextErrors;
    setErrorsState(nextErrors);
  }, []);

  // Track optimistic concurrency control (OCC) revision conflict state
  const [conflict, setConflictState] = useState<RevisionConflict<InferRecord<TCollection>> | null>(null);
  const conflictRef = useRef<RevisionConflict<InferRecord<TCollection>> | null>(null);

  const setConflict = useCallback((val: RevisionConflict<InferRecord<TCollection>> | null) => {
    conflictRef.current = val;
    setConflictState(val);
  }, []);

  const versionField = useMemo(() => {
    if (typeof collection.versionControl === "object" && collection.versionControl?.field) {
      return collection.versionControl.field;
    }
    return "version";
  }, [collection.versionControl]);

  const recordVersionRef = useRef<string | number | undefined>(undefined);

  useEffect(() => {
    if (serverRecord) {
      const v = (serverRecord as any)?.[versionField] ?? (serverRecord as any)?._version;
      if (v !== undefined) {
        recordVersionRef.current = v;
      }
    }
  }, [serverRecord, versionField]);

  useEffect(() => {
    const initialV = (initialValues as any)?.[versionField] ?? (initialValues as any)?._version;
    if (initialV !== undefined && recordVersionRef.current === undefined) {
      recordVersionRef.current = initialV;
    }
  }, [initialValues, versionField]);

  // Reset form when server record arrives for the specific ID
  const lastLoadedIdRef = useRef<string | number | undefined>(undefined);
  useEffect(() => {
    if (serverRecord && lastLoadedIdRef.current !== id) {
      lastLoadedIdRef.current = id;
      const combined = evaluateComputedFields(
        collection.fields,
        { ...serverRecord, ...initialValues },
        parentRecord
      );
      form.reset(combined);
      setErrors({});
    }
  }, [serverRecord, id, collection.fields, initialValues, parentRecord, form, setErrors]);

  // Reactive subscription for hook consumers
  useStore(form.store, (state) => state.values);

  // 4. Reactive Field Updates with Computed Formula Recalculation
  const setFieldValue = useCallback(
    <K extends Extract<keyof InferRecord<TCollection>, string>>(
      field: K,
      value: InferRecord<TCollection>[K]
    ) => {
      // Re-evaluate dependent formula fields and child rows
      const currentValues = { ...form.state.values, [field]: value };
      const recomputed = evaluateComputedFields(
        collection.fields,
        currentValues,
        parentRecord
      );

      // Set the field value (using recomputed value if enriched, e.g. child collection formulas)
      form.setFieldValue(
        field as any,
        (recomputed[field] !== undefined ? recomputed[field] : value) as any
      );

      for (const [k, v] of Object.entries(recomputed)) {
        if (k !== field && !Object.is(currentValues[k], v)) {
          form.setFieldValue(k as any, v as any);
        }
      }

      // Re-validate field if it previously had validation errors
      if (errorsRef.current[field]) {
        const nextFieldErrors = validateField(
          collection.getField(field),
          value,
          recomputed,
          user
        );
        const updated = { ...errorsRef.current };
        if (nextFieldErrors.length === 0) {
          delete updated[field];
        } else {
          updated[field] = nextFieldErrors;
        }
        setErrors(updated);
      }
    },
    [collection, form, parentRecord, user, setErrors]
  );

  const setValues = useCallback(
    (patch: Partial<InferRecord<TCollection>>) => {
      const merged = { ...form.state.values, ...patch };
      const recomputed = evaluateComputedFields(
        collection.fields,
        merged,
        parentRecord
      );

      for (const [k, v] of Object.entries(recomputed)) {
        form.setFieldValue(k as any, v as any);
      }
    },
    [collection.fields, parentRecord, form]
  );

  // 5. Capability & Field State Provider
  const getFieldState = useCallback(
    (fieldName: Extract<keyof InferRecord<TCollection>, string> | string): FormFieldState => {
      const field = collection.getField(fieldName);
      const capability = evaluateFieldCapability(
        field,
        form.state.values,
        user,
        collection.workflow
      );
      const fieldErrors = errorsRef.current[fieldName] || [];
      const meta = form.getFieldMeta(fieldName as any);
      const val = (form.state.values as any)?.[fieldName];

      return {
        ...capability,
        value: val,
        error: fieldErrors[0],
        errors: fieldErrors,
        isTouched: Boolean(meta?.isTouched),
        isDirty: meta?.isDirty ?? false,
      };
    },
    [collection, form, user]
  );

  // 6. Child Collection Accessor
  const child = useCallback(
    <K extends Extract<keyof InferRecord<TCollection>, string>>(
      fieldName: K
    ): ChildCollectionHelper<any> => {
      return createChildCollectionHelper(
        {
          get values() {
            return form.state.values;
          },
          get errors() {
            return errorsRef.current;
          },
          setFieldValue,
        },
        collection,
        fieldName
      );
    },
    [collection, form, setFieldValue]
  );

  // 7. Workflow State Machine Helper
  const workflowHelper = useCollectionWorkflow(
    collection,
    form.state.values as InferRecord<TCollection>,
    { id, user }
  );

  // 8. Reset Handler
  const reset = useCallback(() => {
    const defaults = serverRecord
      ? evaluateComputedFields(
          collection.fields,
          { ...serverRecord, ...initialValues },
          parentRecord
        )
      : getDefaultFormValues(collection, initialValues, parentRecord);

    form.reset(defaults);
    setErrors({});
  }, [serverRecord, collection, initialValues, parentRecord, form, setErrors]);

  // 9. Submit Handler
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e && typeof e.preventDefault === "function") {
        e.preventDefault();
      }

      // Validate all fields and Standard Schema
      const validationErrors = await validateRecord(
        collection.fields,
        form.state.values,
        user,
        validator
      );

      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }
      setErrors({});

      setInternalSubmitting(true);
      try {
        const currentValues = form.state.values;
        if (onSubmit) {
          await onSubmit(currentValues, { id, api: client });
        } else {
          if (isEdit && id !== undefined) {
            const isOCC = Boolean(collection.versionControl || recordVersionRef.current !== undefined);
            const updatePayload: any = { ...currentValues };
            if (isOCC && recordVersionRef.current !== undefined && updatePayload[versionField] === undefined) {
              updatePayload[versionField] = recordVersionRef.current;
            }

            const res = await mutation.update.mutateAsync({
              id,
              data: updatePayload,
              ifMatch: isOCC ? recordVersionRef.current : undefined,
            });

            const newVersion = (res.data as any)?.[versionField] ?? (res.data as any)?._version;
            if (newVersion !== undefined) {
              recordVersionRef.current = newVersion;
            }
            setConflict(null);
            notify?.success?.(
              `Updated ${collection.singular || collection.label || collection.name} successfully`
            );
            onSuccess?.(res.data);
          } else {
            const res = await mutation.create.mutateAsync(currentValues);
            notify?.success?.(
              `Created ${collection.singular || collection.label || collection.name} successfully`
            );
            onSuccess?.(res.data);
          }
        }
      } catch (err: any) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        const conflictDetails = extractConflictDetails<InferRecord<TCollection>>(
          err,
          id,
          form.state.values
        );

        if (conflictDetails) {
          setConflict(conflictDetails);
          if (options.onConflict) {
            await options.onConflict(conflictDetails);
          }
          notify?.error?.(
            "Revision conflict: This record was modified by another transaction."
          );
          onError?.(errorObj);
          return;
        }

        notify?.error?.(
          errorObj.message ||
            `Failed to save ${collection.singular || collection.label || collection.name}`
        );
        onError?.(errorObj);
        throw errorObj;
      } finally {
        setInternalSubmitting(false);
      }
    },
    [
      collection.fields,
      collection.versionControl,
      collection.singular,
      collection.label,
      collection.name,
      form,
      user,
      validator,
      setErrors,
      onSubmit,
      isEdit,
      id,
      client,
      notify,
      mutation.update,
      mutation.create,
      onSuccess,
      onError,
      versionField,
      options,
    ]
  );

  const resolveConflict = useCallback(
    async (
      action: ConflictResolutionAction,
      mergedValues?: Partial<InferRecord<TCollection>>
    ) => {
      const activeConflict = conflictRef.current || conflict;
      if (!activeConflict) return;

      if (action === "cancel") {
        setConflict(null);
        return;
      }

      if (action === "reload") {
        setConflict(null);
        if (activeConflict.serverRecord) {
          form.reset(activeConflict.serverRecord as InferRecord<TCollection>);
          const serverV = (activeConflict.serverRecord as any)?.[versionField];
          if (serverV !== undefined) recordVersionRef.current = serverV;
        } else {
          await query.refetch();
        }
        return;
      }

      if (action === "overwrite") {
        setConflict(null);
        const latestVersion = activeConflict.currentVersion ?? recordVersionRef.current;
        if (latestVersion !== undefined) {
          recordVersionRef.current = latestVersion;
        }
        const currentVals: any = { ...form.state.values };
        if (latestVersion !== undefined) {
          currentVals[versionField] = latestVersion;
        }
        await mutation.update.mutateAsync({
          id: id!,
          data: currentVals,
          ifMatch: latestVersion,
        });
        const res = await query.refetch();
        if (res.data?.data) {
          const newV = (res.data.data as any)?.[versionField];
          if (newV !== undefined) recordVersionRef.current = newV;
        }
        notify?.success?.(
          `Overwritten ${collection.singular || collection.label || collection.name} successfully`
        );
        onSuccess?.(form.state.values);
        return;
      }

      if (action === "merge") {
        setConflict(null);
        const latestVersion = activeConflict.currentVersion ?? recordVersionRef.current;
        const combined: any = { ...form.state.values, ...(mergedValues || {}) };
        if (latestVersion !== undefined) {
          recordVersionRef.current = latestVersion;
          combined[versionField] = latestVersion;
        }
        form.reset(combined as InferRecord<TCollection>);
        await mutation.update.mutateAsync({
          id: id!,
          data: combined,
          ifMatch: latestVersion,
        });
        const res = await query.refetch();
        if (res.data?.data) {
          const newV = (res.data.data as any)?.[versionField];
          if (newV !== undefined) recordVersionRef.current = newV;
        }
        notify?.success?.(
          `Merged & updated ${collection.singular || collection.label || collection.name} successfully`
        );
        onSuccess?.(combined as InferRecord<TCollection>);
      }
    },
    [conflict, form, versionField, query, mutation.update, id, notify, collection, onSuccess, setConflict]
  );

  return {
    form,
    get values() {
      return form.state.values;
    },
    get errors() {
      return errorsRef.current;
    },
    get isDirty() {
      return form.state.isDirty;
    },
    get isSubmitting() {
      return form.state.isSubmitting || internalSubmitting;
    },
    isLoading: Boolean(isEdit && autoFetch && query.isLoading),
    get isValid() {
      return Object.keys(errorsRef.current).length === 0;
    },
    mode,
    record: serverRecord,
    setFieldValue,
    setValues,
    getFieldState,
    child,
    workflow: collection.workflow ? workflowHelper : undefined,
    handleSubmit,
    reset,
    get conflict() {
      return conflictRef.current;
    },
    resolveConflict,
  };
}
