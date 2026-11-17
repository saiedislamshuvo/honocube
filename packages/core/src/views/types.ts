import type React from "react";
import type { Collection, InferRecord, BulkAction } from "../types/collection.js";
import type { CollectionListOptions } from "../table/types.js";
import type { FormMode, FormFieldState, ChildCollectionHelper, RevisionConflict } from "../form/types.js";
import type { FieldConfig, SubCollectionFieldConfig, DateRangeValue } from "../types/fields.js";
import type { ViewType } from "../types/views.js";
import type { AvailableTransition } from "../workflow/types.js";

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

  /**
   * Whether in-table instant boolean toggle switches are enabled. Defaults to true.
   */
  enableInlineToggle?: boolean;

  /**
   * Callback fired when a boolean field is toggled directly inside a table row.
   */
  onToggleField?: (
    record: InferRecord<TCollection>,
    fieldKey: string,
    nextValue: boolean
  ) => Promise<void> | void;

  /**
   * Callback fired when a boolean field is toggled in bulk across selected rows.
   */
  onBulkToggle?: (
    selectedIds: Array<string | number>,
    fieldKey: string,
    value?: boolean
  ) => Promise<void> | void;
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

  /**
   * Whether to display a contextual floating save bar when form values are dirty.
   */
  floatingSaveBar?: boolean;

  /**
   * Whether to guard against accidental navigation or tab closure when form has unsaved changes.
   * Defaults to true.
   */
  unsavedChangesGuard?: boolean;

  /**
   * Callback invoked when an optimistic concurrency control (OCC) or revision conflict is detected.
   */
  onConflict?: (conflict: RevisionConflict<InferRecord<TCollection>>) => void | Promise<void>;

  /**
   * Whether to display the revision conflict resolution dialog automatically when a conflict occurs.
   * Defaults to true.
   */
  revisionConflictDialog?: boolean;
}

export interface FloatingSaveBarProps {
  isDirty?: boolean;
  isSubmitting?: boolean;
  onSave?: (e?: React.FormEvent) => void | Promise<void>;
  onDiscard?: () => void | Promise<void>;
  saveLabel?: string;
  discardLabel?: string;
  showDiscard?: boolean;
  message?: React.ReactNode;
  visible?: boolean;
  actions?: React.ReactNode;
  className?: string;
}

export interface UnsavedChangesDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
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

  /**
   * Current snapshot of form record values, used by dependent fields like slugs.
   */
  values?: Record<string, any>;
}

export interface SlugInputFieldProps {
  id?: string;
  name: string;
  value?: string | null;
  onChange: (value: string) => void;
  sourceValue?: string;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  separator?: string;
  lowercase?: boolean;
  locked?: boolean;
  onLockChange?: (locked: boolean) => void;
  slugify?: (text: string) => string;
  hasError?: boolean;
  className?: string;
}

export interface TagsInputFieldProps {
  id?: string;
  name?: string;
  value?: string[] | string | null;
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  maxTags?: number;
  suggestions?: string[];
  delimiters?: string[];
  allowDuplicates?: boolean;
  hasError?: boolean;
  className?: string;
}

export interface ColorPickerFieldProps {
  id?: string;
  name?: string;
  value?: string | null;
  onChange: (color: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  presets?: string[];
  format?: "hex" | "rgb" | "hsl";
  hasError?: boolean;
  className?: string;
}

export interface IconPickerFieldProps {
  id?: string;
  name?: string;
  value?: string | null;
  onChange: (icon: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  icons?: string[];
  hasError?: boolean;
  className?: string;
}

export interface PhoneInputFieldProps {
  id?: string;
  name?: string;
  value?: string | null;
  onChange: (phone: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  defaultCountry?: string;
  allowedCountries?: string[];
  preferredCountries?: string[];
  hasError?: boolean;
  className?: string;
}

export interface DateRangePickerProps {
  id?: string;
  name?: string;
  value?: DateRangeValue | string | null;
  onChange: (value: DateRangeValue) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  includeTime?: boolean;
  format?: string;
  presets?: boolean | string[];
  hasError?: boolean;
  className?: string;
}

export interface MaskedNumericInputProps {
  id?: string;
  name?: string;
  value?: number | string | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  prefix?: string;
  suffix?: string;
  format?: "currency" | "percent" | "number" | string;
  currencyCode?: string;
  thousandSeparator?: boolean | string;
  allowNegative?: boolean;
  padDecimals?: boolean;
  hasError?: boolean;
  className?: string;
}

export interface BarcodeFieldProps {
  id?: string;
  name?: string;
  value?: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  format?: "code128" | "code39" | "ean13" | "upca";
  displayValue?: boolean;
  width?: number;
  height?: number;
  hasError?: boolean;
  className?: string;
  showScanner?: boolean;
}

export interface QRCodeFieldProps {
  id?: string;
  name?: string;
  value?: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  size?: number;
  level?: "L" | "M" | "Q" | "H";
  includeMargin?: boolean;
  hasError?: boolean;
  className?: string;
  showScanner?: boolean;
}

export interface SignaturePadProps {
  id?: string;
  name?: string;
  value?: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  readOnly?: boolean;
  penColor?: string;
  backgroundColor?: string;
  penWidth?: number;
  width?: number;
  height?: number;
  format?: "image/png" | "image/svg+xml" | "image/jpeg";
  signerName?: string;
  signedAt?: string;
  hasError?: boolean;
  className?: string;
}

export interface RichTextEditorProps {
  id?: string;
  name?: string;
  value?: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  toolbar?: Array<"headings" | "bold" | "italic" | "underline" | "strike" | "bulletList" | "orderedList" | "blockquote" | "codeBlock" | "link" | "clear">;
  minHeight?: number;
  maxHeight?: number;
  format?: "html" | "markdown" | "json";
  hasError?: boolean;
  className?: string;
}

export interface ComboboxOption {
  value: string | number;
  label: string;
  subtitle?: string;
  disabled?: boolean;
  data?: Record<string, unknown>;
}

export interface AsyncComboboxProps {
  id?: string;
  name?: string;
  value?: string | number | null;
  onChange: (value: string | number | null, option?: ComboboxOption | null) => void;
  target?: string;
  endpoint?: string;
  valueKey?: string;
  labelKey?: string;
  subtitleKey?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  loadingText?: string;
  disabled?: boolean;
  readOnly?: boolean;
  clearable?: boolean;
  searchable?: boolean;
  pageSize?: number;
  debounceMs?: number;
  filterParams?: Record<string, unknown>;
  options?: ComboboxOption[];
  fetchOptions?: (
    query: string,
    page: number,
    signal?: AbortSignal
  ) => Promise<{ options: ComboboxOption[]; hasMore?: boolean; total?: number }>;
  resolveOption?: (
    value: string | number,
    signal?: AbortSignal
  ) => Promise<ComboboxOption | null>;
  className?: string;
  hasError?: boolean;
  createInline?: boolean;
  createTitle?: string;
  createDescription?: string;
  createCollection?: any;
  onCreate?: (nameOrQuery: string) => Promise<ComboboxOption | Record<string, unknown> | null | void>;
}

export interface RepeaterFieldProps {
  id?: string;
  name: string;
  value?: any[];
  onChange: (value: any[]) => void;
  fields?: Record<string, any>;
  schema?: Record<string, any>;
  label?: string;
  description?: string;
  minItems?: number;
  maxItems?: number;
  layout?: "table" | "cards" | "stack";
  addButtonText?: string;
  itemLabel?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  allowReorder?: boolean;
  allowClone?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  hasError?: boolean;
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

export interface TreeNode<TRecord = Record<string, unknown>> {
  id: string | number;
  label: string;
  title?: string;
  record: TRecord;
  parentId?: string | number | null;
  children: TreeNode<TRecord>[];
  depth: number;
  hasChildren: boolean;
  description?: string;
  icon?: string;
  badge?: string;
  order?: number;
}

export interface TreeViewProps<TCollection extends Collection<any> = Collection<any>> {
  collection: TCollection;
  data?: Array<InferRecord<TCollection>>;
  parentField?: string;
  labelField?: string;
  titleField?: string;
  descriptionField?: string;
  iconField?: string;
  badgeField?: string;
  orderField?: string;
  initialExpandedDepth?: number;
  defaultExpandedKeys?: Array<string | number>;
  onNodeClick?: (record: InferRecord<TCollection>, node?: TreeNode<InferRecord<TCollection>>) => void;
  onNodeExpand?: (node: TreeNode<InferRecord<TCollection>>, expanded: boolean) => void;
  onAddChild?: (parentRecord: InferRecord<TCollection>, parentNode?: TreeNode<InferRecord<TCollection>>) => void;
  onReparent?: (record: InferRecord<TCollection>, newParentId: string | number | null) => Promise<void> | void;
  searchable?: boolean;
  actions?: React.ReactNode;
  allowDragAndDrop?: boolean;
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

export interface SettingsPanelProps<TCollection extends Collection<any> = Collection<any>> {
  collection: TCollection;
  data?: InferRecord<TCollection>;
  title?: React.ReactNode;
  description?: React.ReactNode;
  activeTab?: string;
  onTabChange?: (tabKey: string) => void;
  onSave?: (values: Record<string, any>) => Promise<void> | void;
  onSuccess?: (savedRecord: InferRecord<TCollection>) => void;
  onError?: (error: Error) => void;
  actions?: React.ReactNode;
  showHeader?: boolean;
  showSaveBar?: boolean;
  saveLabel?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Document Header & Collaboration Types
// ---------------------------------------------------------------------------

export interface AuditFieldDiff {
  field: string;
  from?: unknown;
  to?: unknown;
}

export interface AuditActivity {
  id: string;
  actor: {
    name: string;
    avatar?: string;
  };
  action: string;
  timestamp: string | Date;
  diffs?: AuditFieldDiff[];
}

export interface DocumentComment {
  id: string;
  author: {
    name: string;
    avatar?: string;
  };
  content: string;
  createdAt: string | Date;
}

export interface DocumentAttachment {
  id: string;
  name: string;
  size?: number;
  mimeType?: string;
  uploadedAt: string | Date;
  url?: string;
}

export interface WorkflowActionBarProps<TCollection extends Collection<any>> {
  collection: TCollection;
  record: InferRecord<TCollection>;
  user?: Record<string, unknown>;
  onTransitionSuccess?: (
    updatedRecord: InferRecord<TCollection>,
    transition: AvailableTransition<InferRecord<TCollection>>
  ) => void;
  onTransitionError?: (error: Error) => void;
  className?: string;
}

export interface DocumentHeaderProps<TCollection extends Collection<any>> {
  collection: TCollection;
  record: InferRecord<TCollection>;
  title?: React.ReactNode;
  identifier?: React.ReactNode;
  subtitle?: React.ReactNode;
  user?: Record<string, unknown>;
  onBack?: () => void;
  backHref?: string;
  onTransitionSuccess?: (
    updatedRecord: InferRecord<TCollection>,
    transition: AvailableTransition<InferRecord<TCollection>>
  ) => void;
  onTransitionError?: (error: Error) => void;
  onAction?: (actionKey: "print" | "duplicate" | "delete" | string) => void;
  actions?: React.ReactNode;
  extraActions?: React.ReactNode;
  showWorkflow?: boolean;
  actionsMenuOpen?: boolean;
  className?: string;
}

export interface SidePanelProps<TCollection extends Collection<any> = Collection<any>> {
  collection?: TCollection;
  recordId?: string | number;
  activities?: AuditActivity[];
  comments?: DocumentComment[];
  attachments?: DocumentAttachment[];
  onAddComment?: (content: string) => Promise<void> | void;
  onUploadAttachment?: (file: File) => Promise<void> | void;
  onDeleteAttachment?: (attachmentId: string) => Promise<void> | void;
  currentUser?: {
    name: string;
    avatar?: string;
  };
  defaultTab?: "activity" | "comments" | "attachments";
  tabs?: Array<"activity" | "comments" | "attachments">;
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Interactive Analytics & Chart Types
// ---------------------------------------------------------------------------

export interface ChartSeries {
  key: string;
  label?: string;
  color?: string;
  strokeWidth?: number;
}

export type ChartDataPoint = Record<string, unknown>;

export interface BaseChartProps {
  data: ChartDataPoint[];
  indexKey: string;
  series: ChartSeries[];
  width?: number | string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  valueFormatter?: (value: number) => string;
  className?: string;
}

export interface LineChartProps extends BaseChartProps {
  curve?: "linear" | "smooth";
  showDots?: boolean;
}

export interface AreaChartProps extends BaseChartProps {
  curve?: "linear" | "smooth";
  showDots?: boolean;
  gradientOpacity?: number;
  stacked?: boolean;
}

export interface BarChartProps extends BaseChartProps {
  layout?: "vertical" | "horizontal";
  stacked?: boolean;
  radius?: number;
}

export interface PieChartItem {
  label: string;
  value: number;
  color?: string;
}

export interface DonutChartProps {
  data: PieChartItem[];
  innerRadiusRatio?: number;
  width?: number;
  height?: number;
  centerLabel?: string;
  centerValue?: string | number;
  showLegend?: boolean;
  showTooltip?: boolean;
  valueFormatter?: (value: number) => string;
  className?: string;
}

export interface SparklineProps {
  data: number[];
  width?: number | string;
  height?: number;
  color?: string;
  type?: "line" | "area";
  strokeWidth?: number;
  showGradient?: boolean;
  className?: string;
}

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number | string;
    direction: "up" | "down" | "neutral";
    label?: string;
  };
  sparklineData?: number[];
  sparklineColor?: string;
  icon?: React.ReactNode;
  className?: string;
}

export interface AnalyticsChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  timeRange?: string;
  onTimeRangeChange?: (range: string) => void;
  timeRangeOptions?: Array<{ label: string; value: string }>;
  className?: string;
}

// ---------------------------------------------------------------------------
// Spreadsheet Grid View Types
// ---------------------------------------------------------------------------

export interface SpreadsheetCellChange {
  rowIndex: number;
  colIndex: number;
  columnKey: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface SpreadsheetColumn {
  key: string;
  label: string;
  type?: "text" | "number" | "boolean" | "select" | "date" | "currency";
  width?: number | string;
  readOnly?: boolean;
  options?: Array<{ label: string; value: string | number }>;
  format?: (val: unknown) => string;
  formula?: (row: Record<string, unknown>, allRows: Record<string, unknown>[]) => unknown;
  summary?: "sum" | "avg" | "count" | "min" | "max" | ((values: unknown[]) => unknown);
  defaultValue?: unknown;
}

export interface SpreadsheetViewProps<TCollection extends Collection<any>> {
  collection?: TCollection;
  data?: Array<InferRecord<TCollection>>;
  initialData?: Array<Record<string, unknown>>;
  columns?: SpreadsheetColumn[];
  onDataChange?: (data: Record<string, unknown>[], changes: SpreadsheetCellChange[]) => void;
  onSave?: (data: Record<string, unknown>[]) => Promise<void> | void;
  readOnly?: boolean;
  allowAddRows?: boolean;
  allowDeleteRows?: boolean;
  showFormulaBar?: boolean;
  showSummaryRow?: boolean;
  showToolbar?: boolean;
  className?: string;
  emptyText?: string;
}

// ---------------------------------------------------------------------------
// Print-Optimized Document Layout Types (Issue #122)
// ---------------------------------------------------------------------------

export type PaperSize = "a4" | "letter" | "legal" | "receipt80mm";
export type PrintOrientation = "portrait" | "landscape";
export type PrintDocumentLayout = "invoice" | "packing-slip" | "receipt" | "general";

export interface PrintCompanyInfo {
  name: string;
  logo?: string;
  address?: string | string[];
  email?: string;
  phone?: string;
  website?: string;
  taxId?: string;
}

export interface PrintCustomerInfo {
  name: string;
  company?: string;
  address?: string | string[];
  email?: string;
  phone?: string;
  taxId?: string;
}

export interface PrintDocumentItem {
  id?: string | number;
  sku?: string;
  description: string;
  quantity: number;
  unitPrice?: number;
  discount?: number | string;
  taxRate?: number;
  amount?: number;
  notes?: string;
  shipped?: boolean | number;
}

export interface PrintDocumentTotal {
  label: string;
  value: number | string;
  isGrandTotal?: boolean;
}

export interface PrintDocumentProps {
  layout?: PrintDocumentLayout;
  paperSize?: PaperSize;
  orientation?: PrintOrientation;
  title?: string;
  documentNumber?: string;
  date?: string | Date;
  dueDate?: string | Date;
  status?: string;
  company: PrintCompanyInfo;
  customer?: PrintCustomerInfo;
  shippingAddress?: PrintCustomerInfo;
  items: PrintDocumentItem[];
  totals?: PrintDocumentTotal[];
  notes?: string;
  terms?: string;
  barcodeOrQrValue?: string;
  signature?: {
    label?: string;
    signatureUrl?: string;
    date?: string | Date;
    signerName?: string;
  };
  className?: string;
  showPrintButton?: boolean;
  onPrint?: () => void;
  showPdfExport?: boolean;
  onExportPdf?: () => void;
}

export interface PrintDocumentDialogProps extends PrintDocumentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Client-side PDF Export Engine & Document Types (Issue #133)
// ---------------------------------------------------------------------------

export type PdfPaperSize = "a4" | "letter" | "legal" | "receipt80mm";
export type PdfOrientation = "portrait" | "landscape";
export type PdfFont =
  | "Helvetica"
  | "Helvetica-Bold"
  | "Helvetica-Oblique"
  | "Courier"
  | "Courier-Bold"
  | "Times-Roman"
  | "Times-Bold";

export type PdfRgbColor = [number, number, number];

export interface PdfMargin {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export interface PdfTableColumn {
  key: string;
  header: string;
  width?: number;
  align?: "left" | "center" | "right";
}

export interface PdfTableOptions {
  title?: string;
  subtitle?: string;
  columns: PdfTableColumn[];
  data: Array<Record<string, unknown>>;
  paperSize?: PdfPaperSize;
  orientation?: PdfOrientation;
  margins?: PdfMargin | number;
  showPageNumbers?: boolean;
  showTimestamp?: boolean;
  filename?: string;
  headerBgColor?: PdfRgbColor;
  headerTextColor?: PdfRgbColor;
  alternateRowColor?: PdfRgbColor;
  borderColor?: PdfRgbColor;
}

export interface PdfDocumentOptions {
  paperSize?: PdfPaperSize;
  orientation?: PdfOrientation;
  margins?: PdfMargin | number;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
  };
}

export interface ExportPdfButtonProps {
  onExport?: () => Promise<void> | void;
  filename?: string;
  label?: string;
  variant?: "default" | "secondary" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  disabled?: boolean;
  iconOnly?: boolean;
}

export interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfDataUri?: string;
  pdfBlob?: Blob;
  filename?: string;
  title?: string;
  trigger?: React.ReactNode;
  onDownload?: () => void;
}

// ---------------------------------------------------------------------------
// Barcode & QR Code Hardware/Camera Scanner Types (Issue #123)
// ---------------------------------------------------------------------------

export interface BarcodeScannerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  minLength?: number;
  maxIntervalMs?: number;
  preventDefault?: boolean;
  sound?: boolean;
}

export interface BarcodeCameraScannerProps {
  onScan: (barcode: string) => void;
  onError?: (error: Error) => void;
  facingMode?: "environment" | "user";
  torch?: boolean;
  aspectRatio?: number;
  className?: string;
}

export interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (barcode: string) => void;
  title?: string;
  description?: string;
  trigger?: React.ReactNode;
  formats?: string[];
}

export interface VerificationItem {
  id: string | number;
  barcode: string;
  name: string;
  expectedQuantity: number;
  verifiedQuantity: number;
  sku?: string;
  status?: "pending" | "verified" | "over";
}

export interface ScanVerificationWidgetProps {
  items: VerificationItem[];
  onItemVerified?: (item: VerificationItem, remaining: number) => void;
  onComplete?: () => void;
  title?: string;
  autoFocus?: boolean;
  className?: string;
}

export interface RealtimeIndicatorProps {
  client?: any;
  showLabel?: boolean;
  onReconnect?: () => void;
  className?: string;
}

export interface RealtimeToastNotifierProps {
  client?: any;
  resourceLabels?: Record<string, string>;
  filter?: (event: any) => boolean;
  formatMessage?: (event: any) => { title: string; description?: string } | null;
}

