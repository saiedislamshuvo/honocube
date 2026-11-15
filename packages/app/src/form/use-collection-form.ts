import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import type { Collection, InferRecord } from "../types/collection.js";
import { useCollectionQuery } from "../query/use-query.js";
import { useCollectionMutation } from "../query/use-mutation.js";
import { useApiClient } from "../query/provider.js";
import { getDefaultFormValues } from "./defaults.js";
import { evaluateComputedFields } from "./computed.js";
import { evaluateFieldCapability } from "./capabilities.js";
import { validateField, validateRecord } from "./validation.js";
import { createChildCollectionHelper } from "./child.js";
import { useCollectionWorkflow } from "../workflow/use-workflow.js";
import { toast } from "@honocube/ui";
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
            const res = await mutation.update.mutateAsync({
              id,
              data: currentValues,
            });
            toast.success(
              `Updated ${collection.singular || collection.label || collection.name} successfully`
            );
            onSuccess?.(res.data);
          } else {
            const res = await mutation.create.mutateAsync(currentValues);
            toast.success(
              `Created ${collection.singular || collection.label || collection.name} successfully`
            );
            onSuccess?.(res.data);
          }
        }
      } catch (err: any) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        toast.error(
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
      form,
      user,
      validator,
      setErrors,
      onSubmit,
      isEdit,
      id,
      client,
      mutation.update,
      mutation.create,
      onSuccess,
      onError,
    ]
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
  };
}
