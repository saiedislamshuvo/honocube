import type React from "react";
import type { Collection, InferRecord, BulkAction } from "../types/collection.js";
import type { CollectionListOptions } from "../table/types.js";
import type { FormMode, FormFieldState, ChildCollectionHelper } from "../form/types.js";
import type { FieldConfig, SubCollectionFieldConfig } from "../types/fields.js";
import type { ViewType } from "../types/views.js";

export interface TableViewProps<TCollection extends Collection<any>> {
  /**
   * The collection schema definition to render.
   */
  collection: TCollection;

  /**
   * Options passed to the headless collection list engine (initialPage, defaultLimit, etc.).
   */
  options?: CollectionListOptions<TCollection>;

  /**
   * Callback invoked when a user clicks on a table row.
   */
  onRowClick?: (record: InferRecord<TCollection>) => void;

  /**
   * Whether to display the search bar in the toolbar. Defaults to true.
   */
  showSearch?: boolean;

  /**
   * Whether to display the filter pill bar and add filter dropdown. Defaults to true.
   */
  showFilters?: boolean;

  /**
   * Whether to display the column visibility selector. Defaults to true.
   */
  showColumnSelector?: boolean;

  /**
   * Whether to enable row selection checkboxes and bulk action bar. Defaults to true.
   */
  enableRowSelection?: boolean;

  /**
   * Custom bulk actions available when rows are selected (overrides or supplements collection.bulkActions).
   */
  bulkActions?: BulkAction[];

  /**
   * Custom actions or buttons to display on the right side of the toolbar (e.g. "+ New Record").
   */
  actions?: React.ReactNode;

  /**
   * Custom CSS class name for the root container.
   */
  className?: string;

  /**
   * Custom message to show when no records are found. Defaults to "No records found."
   */
  emptyText?: string;

  /**
   * Custom message to show while loading. Defaults to "Loading..."
   */
  loadingText?: string;
}

export interface FormViewProps<TCollection extends Collection<any>> {
  /**
   * The collection schema definition to render.
   */
  collection: TCollection;

  /**
   * Record ID if editing an existing record.
   */
  id?: string | number;

  /**
   * Initial values to seed the form.
   */
  initialValues?: Partial<InferRecord<TCollection>>;

  /**
   * Explicit form mode override ("create" | "edit" | "view").
   */
  mode?: FormMode;

  /**
   * Callback invoked upon successful submission.
   */
  onSuccess?: (record: InferRecord<TCollection>) => void;

  /**
   * Callback invoked upon submission error.
   */
  onError?: (error: Error) => void;

  /**
   * Callback invoked when user clicks cancel.
   */
  onCancel?: () => void;

  /**
   * Custom submit handler. If omitted, uses default API mutation.
   */
  onSubmit?: (
    values: InferRecord<TCollection>,
    context: { id?: string | number; api: any }
  ) => Promise<void> | void;

  /**
   * User context passed to dynamic field rules.
   */
  user?: Record<string, unknown>;

  /**
   * Parent record context if this form is nested.
   */
  parentRecord?: Record<string, unknown>;

  /**
   * Custom form title override.
   */
  title?: string;

  /**
   * Custom form description override.
   */
  description?: string;

  /**
   * Additional action buttons to render in the header or footer.
   */
  actions?: React.ReactNode;

  /**
   * Custom CSS class name for the root container.
   */
  className?: string;

  /**
   * Whether to display the form header card. Defaults to true.
   */
  showHeader?: boolean;

  /**
   * Whether to display the form footer action bar. Defaults to true.
   */
  showFooter?: boolean;

  /**
   * Custom label for the primary submit button.
   */
  submitLabel?: string;
}

export interface FormDialogProps<TCollection extends Collection<any>>
  extends Omit<FormViewProps<TCollection>, "className"> {
  /**
   * Controlled open state for the dialog modal.
   */
  open?: boolean;

  /**
   * Event callback invoked when dialog open state changes.
   */
  onOpenChange?: (open: boolean) => void;

  /**
   * Optional trigger button or element that opens the dialog.
   */
  trigger?: React.ReactNode;

  /**
   * Custom CSS class name for the dialog content wrapper.
   */
  dialogClassName?: string;
}

export interface FormSheetProps<TCollection extends Collection<any>>
  extends Omit<FormViewProps<TCollection>, "className"> {
  /**
   * Controlled open state for the sheet drawer.
   */
  open?: boolean;

  /**
   * Event callback invoked when sheet open state changes.
   */
  onOpenChange?: (open: boolean) => void;

  /**
   * Optional trigger button or element that opens the sheet drawer.
   */
  trigger?: React.ReactNode;

  /**
   * Which side of the viewport the drawer slides from. Defaults to "right".
   */
  side?: "top" | "bottom" | "left" | "right";

  /**
   * Custom CSS class name for the sheet content wrapper.
   */
  sheetClassName?: string;
}

export interface FormPageProps<TCollection extends Collection<any>>
  extends FormViewProps<TCollection> {
  /**
   * URL to navigate back to when the back button is clicked.
   */
  backUrl?: string;

  /**
   * Callback invoked when the user clicks the back button.
   */
  onBack?: () => void;
}

export interface FormFieldProps {
  /**
   * Field key name.
   */
  name: string;

  /**
   * Field schema configuration.
   */
  field: FieldConfig<any>;

  /**
   * Reactive field state from TanStack form engine.
   */
  fieldState: FormFieldState<any>;

  /**
   * Callback invoked when the field value changes.
   */
  onChange: (value: any) => void;

  /**
   * Whether the field input should be disabled.
   */
  disabled?: boolean;

  /**
   * Custom CSS class name for the field container.
   */
  className?: string;
}

export interface ChildTableProps {
  /**
   * Field key name.
   */
  name: string;

  /**
   * Sub-collection field configuration.
   */
  field: SubCollectionFieldConfig<any>;

  /**
   * Headless child collection helper managing line items CRUD.
   */
  childHelper: ChildCollectionHelper<any>;

  /**
   * Whether the child table is in read-only / disabled mode.
   */
  disabled?: boolean;

  /**
   * Custom CSS class name for the child table container.
   */
  className?: string;
}

export interface KanbanColumn {
  value: string;
  label: string;
  color?: string;
}

export interface KanbanViewProps<TCollection extends Collection<any>> {
  collection: TCollection;
  groupBy?: string;
  columns?: KanbanColumn[];
  onCardClick?: (record: InferRecord<TCollection>) => void;
  onCardMove?: (record: InferRecord<TCollection>, newColumnValue: string) => Promise<void> | void;
  onAddCard?: (columnValue: string) => void;
  className?: string;
  emptyText?: string;
}

export interface CalendarViewProps<TCollection extends Collection<any>> {
  collection: TCollection;
  startField?: string;
  endField?: string;
  titleField?: string;
  colorField?: string;
  initialDate?: Date;
  onEventClick?: (record: InferRecord<TCollection>) => void;
  onDateClick?: (date: Date) => void;
  className?: string;
}

export interface ListViewProps<TCollection extends Collection<any>> {
  collection: TCollection;
  titleField?: string;
  subtitleField?: string;
  metaField?: string;
  badgeField?: string;
  onItemClick?: (record: InferRecord<TCollection>) => void;
  className?: string;
  emptyText?: string;
}

export interface GridViewProps<TCollection extends Collection<any>> {
  collection: TCollection;
  titleField?: string;
  subtitleField?: string;
  bodyField?: string;
  badgeField?: string;
  imageField?: string;
  columns?: number;
  onCardClick?: (record: InferRecord<TCollection>) => void;
  className?: string;
  emptyText?: string;
}

export interface ViewSwitcherProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  availableViews?: ViewType[];
  className?: string;
}

export interface CollectionMultiViewProps<TCollection extends Collection<any>> {
  collection: TCollection;
  defaultView?: ViewType;
  availableViews?: ViewType[];
  onRecordClick?: (record: InferRecord<TCollection>) => void;
  actions?: React.ReactNode;
  className?: string;
}
