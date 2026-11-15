/**
 * @honocube/app/headless
 * Pure headless data, state machine, and API client layer for HonoCube.
 * Contains ZERO UI rendering components, styling tokens, or Tailwind dependencies.
 */

// Core Schema & Application Definition
export { defineCollection } from "./core/collection.js";
export { defineApp } from "./core/app.js";

// Client & Network
export { ApiClient, createApiClient } from "./client/api-client.js";
export { ApiClientError } from "./client/errors.js";
export type {
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
} from "./form/types.js";

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
} from "./page/types.js";

// Utilities & Formatting
export { toHumanLabel, formatCellValue, formatFileSize } from "./utils/format.js";

// Schema, Field, Collection & App Types
export type {
  Collection,
  CollectionConfig,
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
  BaseFieldType,
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
