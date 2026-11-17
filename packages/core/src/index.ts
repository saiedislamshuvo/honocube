/**
 * @honocube/core
 * Pure headless data layer, state machines, and theme contracts for HonoCube.
 * Contains ZERO UI rendering components, styling tokens, or Tailwind dependencies.
 */

export const VERSION = "2.0.2";

// Core Schemas & Derivation Engine
export { defineCollection } from "./core/collection.js";
export { defineApp } from "./core/app.js";
export {
  f,
  field,
  isFieldBuilder,
  unwrapFieldConfig,
  BaseFieldBuilder,
  TextFieldBuilder,
  NumberFieldBuilder,
  SelectFieldBuilder,
  DateFieldBuilder,
  BooleanFieldBuilder,
  RelationFieldBuilder,
  ComputedFieldBuilder,
  JsonFieldBuilder,
  SeriesFieldBuilder,
  SubCollectionFieldBuilder,
  MediaFieldBuilder,
  DateRangeFieldBuilder,
  PhoneFieldBuilder,
  ColorFieldBuilder,
  IconFieldBuilder,
  TagsFieldBuilder,
  SlugFieldBuilder,
  BarcodeFieldBuilder,
  QRCodeFieldBuilder,
  SignatureFieldBuilder,
  RichTextFieldBuilder,
  RepeaterFieldBuilder,
} from "./core/builder.js";
export {
  fromResource,
  fromDrizzleTable,
  deriveFieldsFromResource,
  deriveFieldsFromDrizzleTable,
  deriveFieldsFromZod,
  deriveFieldFromDrizzleColumn,
  deriveFieldFromZodType,
  inferFieldTypeFromDrizzleColumn,
  isDrizzleTable,
  getDrizzleTableName,
  getDrizzleColumns,
  getZodShape,
  unwrapZodType,
  unwrapResourceConfig,
} from "./core/derivation.js";
export type { DerivedCollectionDefinition } from "./core/derivation.js";

// Client & Network
export { createApiClient } from "./client/api-client.js";
export { ApiClientError } from "./client/errors.js";
export type {
  ApiClient,
  ApiClientOptions,
  ApiResponse,
  PaginationMeta,
  PaginationParams,
  QueryParams,
  RequestOptions,
} from "./client/api-client.js";
export type { ErrorEnvelope } from "./client/errors.js";

// React Query Hooks & Provider
export { queryKeys } from "./query/keys.js";
export { AppContext, AppProvider, useApp, useApiClient } from "./query/provider.js";
export type { AppContextValue, AppProviderProps } from "./query/provider.js";
export { useCollectionQuery } from "./query/use-query.js";
export type {
  UseCollectionDetailOptions,
  UseCollectionListOptions,
  UseCollectionQueryOptions,
} from "./query/use-query.js";
export { useCollectionMutation } from "./query/use-mutation.js";
export type { UseCollectionMutationResult } from "./query/use-mutation.js";

// Headless Table & List Engine
export { useCollectionList } from "./table/use-collection-list.js";
export { generateColumnsFromCollection } from "./table/columns.js";
export {
  parseTableStateFromUrl,
  serializeTableStateToUrl,
  syncUrlState,
} from "./table/url-sync.js";
export type {
  CollectionListFilters,
  CollectionListOptions,
  CollectionListPagination,
  CollectionListResult,
  CollectionListSearch,
  CollectionListSelection,
  CollectionListSorting,
  CollectionListVisibility,
  SortOrder,
  SortState,
  TableUrlState,
} from "./table/types.js";

// Headless Form & Record Engine
export { useCollectionForm } from "./form/use-collection-form.js";
export { createChildCollectionHelper } from "./form/child.js";
export { useChildCollection } from "./form/use-child-collection.js";
export { evaluateComputedFields } from "./form/computed.js";
export { evaluateFieldCapability } from "./form/capabilities.js";
export { validateField, validateRecord } from "./form/validation.js";
export { getDefaultFormValues } from "./form/defaults.js";
export type {
  CollectionFormOptions,
  CollectionFormReturn,
  FieldCapabilityState,
  FormFieldState,
  FormMode,
  ChildCollectionHelper,
  FormNotifier,
  RevisionConflict,
  ConflictResolutionAction,
} from "./form/types.js";

// Optimistic Concurrency Control (OCC) Primitives
export {
  generateETag,
  parseETag,
  isRevisionConflict,
  extractConflictDetails,
} from "./concurrency/etag.js";

// Headless Workflow State Machine Engine
export { useCollectionWorkflow } from "./workflow/use-workflow.js";
export {
  getCurrentWorkflowState,
  getStateMetadata,
  isRecordLocked,
  getAvailableTransitions,
} from "./workflow/engine.js";
export type {
  AvailableTransition,
  WorkflowStateMeta,
  UseWorkflowOptions,
  UseWorkflowReturn,
} from "./workflow/types.js";

// Routing Resolution Engine
export { resolveWorkspaceRoute } from "./page/resolve-route.js";
export type {
  WorkspaceRouteType,
  WorkspaceResolvedRoute,
  WorkspacePageProps,
  WorkspaceDashboardProps,
  CollectionDetailPageProps,
} from "./page/types.js";

// Theme Contracts
export {
  createTheme,
  isHonoCubeTheme,
  resolveTheme,
} from "./theme/theme-contract.js";
export type {
  HonoCubeTheme,
  ThemeComponents,
} from "./theme/theme-contract.js";

// Shell & Navigation Types
export type {
  ShellTenant,
  ShellUser,
  BreadcrumbItemData,
  WorkspaceBreadcrumbsProps,
  TenantSwitcherProps,
  UserProfileDropdownProps,
  SpotlightProps,
  WorkspaceSidebarProps,
  WorkspaceTopbarProps,
  WorkspaceShellProps,
} from "./shell/types.js";

// View Component Types
export type {
  TableViewProps,
  FormViewProps,
  FormDialogProps,
  FormSheetProps,
  FormPageProps,
  FormFieldProps,
  MaskedNumericInputProps,
  BarcodeFieldProps,
  QRCodeFieldProps,
  SignaturePadProps,
  RichTextEditorProps,
  ComboboxOption,
  AsyncComboboxProps,
  RepeaterFieldProps,
  DateRangePickerProps,
  FloatingSaveBarProps,
  PhoneInputFieldProps,
  ColorPickerFieldProps,
  IconPickerFieldProps,
  TagsInputFieldProps,
  SlugInputFieldProps,
  UnsavedChangesDialogProps,
  ChildTableProps,
  KanbanColumn,
  KanbanViewProps,
  CalendarViewProps,
  ListViewProps,
  GridViewProps,
  TreeViewProps,
  TreeNode,
  SettingsPanelProps,
  ViewSwitcherProps,
  CollectionMultiViewProps,
  WorkflowActionBarProps,
  DocumentHeaderProps,
  SidePanelProps,
  AuditFieldDiff,
  AuditActivity,
  DocumentComment,
  DocumentAttachment,
  ChartSeries,
  ChartDataPoint,
  BaseChartProps,
  LineChartProps,
  AreaChartProps,
  BarChartProps,
  PieChartItem,
  DonutChartProps,
  SparklineProps,
  MetricCardProps,
  AnalyticsChartCardProps,
  SpreadsheetCellChange,
  SpreadsheetColumn,
  SpreadsheetViewProps,
  PaperSize,
  PrintOrientation,
  PrintDocumentLayout,
  PrintCompanyInfo,
  PrintCustomerInfo,
  PrintDocumentItem,
  PrintDocumentTotal,
  PrintDocumentProps,
  PrintDocumentDialogProps,
  PdfPaperSize,
  PdfOrientation,
  PdfFont,
  PdfRgbColor,
  PdfMargin,
  PdfTableColumn,
  PdfTableOptions,
  PdfDocumentOptions,
  ExportPdfButtonProps,
  PdfPreviewDialogProps,
  BarcodeScannerOptions,
  BarcodeCameraScannerProps,
  BarcodeScannerDialogProps,
  VerificationItem,
  ScanVerificationWidgetProps,
  RealtimeIndicatorProps,
  RealtimeToastNotifierProps,
  CompanyHierarchyTreeProps,
  MasterDataSyncDialogProps,
} from "./views/types.js";

// Utilities & Formatting
export { toHumanLabel, formatCellValue, formatFileSize } from "./utils/format.js";
export { slugify, type SlugifyOptions } from "./utils/slug.js";

// Schema, Field, Collection & App Types
export type {
  AnyFieldDef,
  NormalizedField,
  NormalizedFields,
  Collection,
  CollectionConfig,
  BaseDerivedCollectionConfig,
  ResourceCollectionConfig,
  TableCollectionConfig,
  DefineCollectionInput,
  FieldOverrideMap,
  InferRecord,
  FormLayoutConfig,
  FormTab,
  FormSection,
  PresentationMode,
  PresentationConfig,
  SidePanelConfig,
  DocumentAction,
  BulkAction,
  CollectionIdentifier,
} from "./types/collection.js";

export type {
  IFieldBuilder,
  ITextFieldBuilder,
  INumberFieldBuilder,
  ISelectFieldBuilder,
  IDateFieldBuilder,
  IBooleanFieldBuilder,
  IRelationFieldBuilder,
  IComputedFieldBuilder,
  IJsonFieldBuilder,
  ISeriesFieldBuilder,
  ISubCollectionFieldBuilder,
  IMediaFieldBuilder,
  IDateRangeFieldBuilder,
  IPhoneFieldBuilder,
  IColorFieldBuilder,
  IIconFieldBuilder,
  ITagsFieldBuilder,
  ISlugFieldBuilder,
  IBarcodeFieldBuilder,
  IQRCodeFieldBuilder,
  ISignatureFieldBuilder,
  IRichTextFieldBuilder,
  IRepeaterFieldBuilder,
} from "./types/builder.js";

export type {
  BaseFieldType,
  MediaAsset,
  FieldCapabilityContext,
  DynamicRule,
  SelectOption,
  BaseFieldConfig,
  TextFieldConfig,
  NumberFieldConfig,
  DateFieldConfig,
  BooleanFieldConfig,
  SelectFieldConfig,
  JsonFieldConfig,
  SeriesFieldConfig,
  RelationFieldConfig,
  SubCollectionFieldConfig,
  ComputedFieldConfig,
  MediaFieldConfig,
  DateRangeValue,
  DateRangeFieldConfig,
  PhoneFieldConfig,
  ColorFieldConfig,
  IconFieldConfig,
  TagsFieldConfig,
  SlugFieldConfig,
  BarcodeFieldConfig,
  QRCodeFieldConfig,
  SignatureFieldConfig,
  RichTextFieldConfig,
  RichTextToolbarTool,
  RepeaterFieldConfig,
  FieldConfig,
  InferFieldValue,
} from "./types/fields.js";

export type {
  ViewType,
  TableViewConfig,
  ListViewConfig,
  GridViewConfig,
  KanbanViewConfig,
  CalendarViewConfig,
  GanttViewConfig,
  TreeViewConfig,
  SpreadsheetViewConfig,
  SelectableFieldKeys,
  DateFieldKeys,
  NumericFieldKeys,
  TextFieldKeys,
} from "./types/views.js";

export type {
  WorkflowVariant,
  WorkflowState,
  WorkflowTransition,
  WorkflowConfig,
} from "./types/workflow.js";

export type {
  AuthType,
  AuthConfig,
  TenantConfig,
  IdempotencyConfig,
  CustomNavigationLink,
  NavigationItem,
  NavigationGroup,
  AppConfig,
  AppInstance,
  ShellElementPosition,
  AppLayoutConfig,
  ThemeMode,
  ColorPreset,
  ThemeConfig,
} from "./types/app.js";

export {
  parseCsv,
  escapeCsvCell,
  serializeCsv,
  generateCsvTemplate,
  downloadCsvFile,
  chunkArray,
  importInChunks,
} from "./import/csv.js";

export type {
  ParseCsvOptions,
  ParsedCsvResult,
  ImportChunkResult,
  ImportInChunksProgress,
  ImportInChunksOptions,
  ImportInChunksSummary,
} from "./import/csv.js";

// Realtime SSE / Event Bus Engine
export {
  createRealtimeClient,
  setupRealtimeCacheSync,
  RealtimeContext,
  RealtimeProvider,
  useRealtimeClient,
  useRealtimeStatus,
  useRealtimeSubscription,
} from "./realtime/client.js";

export type {
  RealtimeConnectionStatus,
  RealtimeEvent,
  RealtimeClientOptions,
  RealtimeEventListener,
  RealtimeStatusListener,
  RealtimeClient,
  RealtimeProviderProps,
} from "./realtime/client.js";

// Multi-Company Holding Hierarchy & Master Data (Issue #137)
export {
  buildCompanyTree,
  getSubsidiaryIds,
  getAncestorCompanyIds,
  isDescendantCompany,
  flattenCompanyTree,
} from "./company/hierarchy.js";

export type {
  Company,
  CompanyTreeNode,
  MasterDataSyncOptions,
  MasterDataSyncResult,
} from "./company/hierarchy.js";

