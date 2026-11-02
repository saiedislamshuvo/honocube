/**
 * @honocube/app
 * Enterprise Application & Workspace framework for HonoCube.
 */

export const VERSION = "2.0.2";

// Core APIs
export { defineCollection } from "./core/collection.js";
export { defineApp } from "./core/app.js";

// HTTP & Client
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

// Query & Hooks
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

// Table & Collection List Engine
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

// Format & String Utilities
export { toHumanLabel, formatCellValue } from "./utils/format.js";

// Collection & Record Types
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

// Field Types
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

// View Types
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

// Workflow Types
export type {
  WorkflowVariant,
  WorkflowState,
  WorkflowTransition,
  WorkflowConfig,
} from "./types/workflow.js";

// App Types
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
} from "./types/app.js";
