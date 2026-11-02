/**
 * @honocube/app
 * Enterprise Application & Workspace framework for HonoCube.
 */

export const VERSION = "2.0.2";

// Core APIs
export { defineCollection } from "./core/collection.js";
export { defineApp } from "./core/app.js";

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
