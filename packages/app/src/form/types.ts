import type { FormApi } from "@tanstack/react-form";
import type { Collection, InferRecord } from "../types/collection.js";
import type { UseWorkflowReturn } from "../workflow/types.js";

export interface FieldCapabilityState {
  visible: boolean;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
}

export interface FormFieldState<TValue = unknown> extends FieldCapabilityState {
  value: TValue;
  error?: string;
  errors: string[];
  isTouched: boolean;
  isDirty: boolean;
}

export type FormMode = "create" | "edit" | "view";

export interface ChildCollectionHelper<TChild = Record<string, unknown>> {
  /**
   * The list of child records in this collection.
   */
  rows: TChild[];

  /**
   * Total number of child rows.
   */
  count: number;

  /**
   * Whether the child collection has no rows.
   */
  isEmpty: boolean;

  /**
   * Appends a new child row with default values merged with optional initial data.
   */
  addRow: (initialData?: Partial<TChild>) => void;

  /**
   * Removes a child row at the specified index.
   */
  removeRow: (index: number) => void;

  /**
   * Updates fields for a specific child row and recalculates formulas.
   */
  updateRow: (index: number, patch: Partial<TChild>) => void;

  /**
   * Reorders rows from one index to another.
   */
  reorderRows: (fromIndex: number, toIndex: number) => void;

  /**
   * Clears all rows from the child collection.
   */
  clearRows: () => void;

  /**
   * Retrieves validation errors for a specific row index.
   */
  getRowErrors: (index: number) => Record<string, string[]>;

  /**
   * The resolved child collection definition if available.
   */
  childCollection?: Collection<any>;
}

export interface CollectionFormOptions<TCollection extends Collection<any>> {
  /**
   * Record ID if editing or viewing an existing record.
   * If omitted, the form runs in "create" mode.
   */
  id?: string | number;

  /**
   * Initial values to seed or override default values.
   */
  initialValues?: Partial<InferRecord<TCollection>>;

  /**
   * User context for evaluating dynamic capabilities (disabled, visible).
   */
  user?: Record<string, unknown>;

  /**
   * Parent record context if this form is an inline child collection form.
   */
  parentRecord?: Record<string, unknown>;

  /**
   * Explicit mode override ("create" | "edit" | "view").
   * Defaults to "edit" if `id` is provided, otherwise "create".
   */
  mode?: FormMode;

  /**
   * Whether to automatically fetch existing record when `id` is provided.
   * Defaults to `true`.
   */
  autoFetch?: boolean;

  /**
   * Custom submission handler. If not provided, defaults to
   * dispatching `create` (POST) or `update` (PATCH) mutation via ApiClient.
   */
  onSubmit?: (
    values: InferRecord<TCollection>,
    context: { id?: string | number; api: any }
  ) => Promise<void> | void;

  /**
   * Callback invoked on successful creation or update.
   */
  onSuccess?: (record: InferRecord<TCollection>) => void;

  /**
   * Callback invoked when submission fails.
   */
  onError?: (error: Error) => void;

  /**
   * Custom validator or Standard Schema validator.
   */
  validator?:
    | ((values: InferRecord<TCollection>) => Record<string, string[]> | Promise<Record<string, string[]>>)
    | { "~standard": { validate: (values: unknown) => Promise<any> | any } };
}

export interface CollectionFormReturn<TCollection extends Collection<any>> {
  /**
   * Underlying TanStack Form instance.
   */
  form: FormApi<InferRecord<TCollection>>;

  /**
   * Current reactive form values.
   */
  values: InferRecord<TCollection>;

  /**
   * Current field error map (field name -> array of error messages).
   */
  errors: Record<string, string[]>;

  /**
   * Whether any field has been modified from its initial value.
   */
  isDirty: boolean;

  /**
   * Whether the form is currently in submission.
   */
  isSubmitting: boolean;

  /**
   * Whether existing record data is currently loading from the API.
   */
  isLoading: boolean;

  /**
   * Whether the current form state is valid.
   */
  isValid: boolean;

  /**
   * Active form mode ("create" | "edit" | "view").
   */
  mode: FormMode;

  /**
   * Fetched server record if editing an existing record.
   */
  record?: InferRecord<TCollection>;

  /**
   * Updates a single field value and recalculates dependent computed formulas.
   */
  setFieldValue: <K extends Extract<keyof InferRecord<TCollection>, string>>(
    field: K,
    value: InferRecord<TCollection>[K]
  ) => void;

  /**
   * Batch updates multiple field values and recalculates dependent computed formulas.
   */
  setValues: (values: Partial<InferRecord<TCollection>>) => void;

  /**
   * Returns current capability and validation state for a specific field.
   */
  getFieldState: (field: Extract<keyof InferRecord<TCollection>, string> | string) => FormFieldState;

  /**
   * Accesses a child collection helper for embedded line items.
   */
  child: <K extends Extract<keyof InferRecord<TCollection>, string>>(
    fieldName: K
  ) => ChildCollectionHelper<any>;

  /**
   * Workflow state machine helper for documents with lifecycle transitions and locks.
   */
  workflow?: UseWorkflowReturn<InferRecord<TCollection>>;

  /**
   * Validates and submits the form.
   */
  handleSubmit: (e?: React.FormEvent) => Promise<void>;

  /**
   * Resets form to initial or loaded server values.
   */
  reset: () => void;
}
