import type React from "react";
import type { ThemeMode, ColorPreset } from "../types/app.js";
import type {
  WorkspaceShellProps,
  WorkspaceSidebarProps,
  WorkspaceTopbarProps,
} from "../shell/types.js";
import type {
  WorkspaceDashboardProps,
  CollectionDetailPageProps,
  WorkspacePageProps,
} from "../page/types.js";
import type {
  TableViewProps,
  FormViewProps,
  FormPageProps,
  FormDialogProps,
  FormSheetProps,
  CollectionMultiViewProps,
  KanbanViewProps,
  CalendarViewProps,
  ListViewProps,
  GridViewProps,
  ChildTableProps,
  SidePanelProps,
  DocumentHeaderProps,
  WorkflowActionBarProps,
  FormFieldProps,
} from "../views/types.js";

/**
 * Component slots that can be customized or replaced by a HonoCube theme.
 */
export interface ThemeComponents {
  /**
   * Main workspace shell layout.
   */
  Shell?: React.ComponentType<WorkspaceShellProps>;

  /**
   * Navigation sidebar within the shell.
   */
  Sidebar?: React.ComponentType<WorkspaceSidebarProps>;

  /**
   * Top bar header within the shell.
   */
  Topbar?: React.ComponentType<WorkspaceTopbarProps>;

  /**
   * Default workspace home dashboard.
   */
  Dashboard?: React.ComponentType<WorkspaceDashboardProps>;

  /**
   * Page catch-all router component.
   */
  Page?: React.ComponentType<WorkspacePageProps>;

  /**
   * Collection views.
   */
  views?: {
    table?: React.ComponentType<TableViewProps<any>>;
    form?: React.ComponentType<FormViewProps<any>>;
    formPage?: React.ComponentType<FormPageProps<any>>;
    formDialog?: React.ComponentType<FormDialogProps<any>>;
    formSheet?: React.ComponentType<FormSheetProps<any>>;
    multiView?: React.ComponentType<CollectionMultiViewProps<any>>;
    detail?: React.ComponentType<CollectionDetailPageProps<any>>;
    kanban?: React.ComponentType<KanbanViewProps<any>>;
    calendar?: React.ComponentType<CalendarViewProps<any>>;
    list?: React.ComponentType<ListViewProps<any>>;
    grid?: React.ComponentType<GridViewProps<any>>;
    childTable?: React.ComponentType<ChildTableProps>;
    sidePanel?: React.ComponentType<SidePanelProps<any>>;
    documentHeader?: React.ComponentType<DocumentHeaderProps<any>>;
    workflowActionBar?: React.ComponentType<WorkflowActionBarProps<any>>;
  };

  /**
   * Custom field input renderers by field type or name.
   */
  fields?: Record<string, React.ComponentType<FormFieldProps>>;

  /**
   * Custom 404 / not found view.
   */
  notFound?: React.ComponentType<{
    collectionName?: string;
    onNavigate?: (href: string) => void;
  }>;
}

/**
 * Formal contract for HonoCube themes and layout templates.
 */
export interface HonoCubeTheme {
  /**
   * Unique identifier of the theme (e.g., "default", "twenty", "erpnext", "corporate").
   */
  name: string;

  /**
   * Optional semantic version of the theme.
   */
  version?: string;

  /**
   * Optional description of the theme's design language or target layout.
   */
  description?: string;

  /**
   * Default color appearance mode ("light" | "dark" | "system").
   */
  defaultMode?: ThemeMode;

  /**
   * Default color palette preset ("zinc", "blue", "violet", etc., or custom brand preset).
   */
  defaultPreset?: ColorPreset | string;

  /**
   * Component slots for shell, views, and fields.
   */
  components?: ThemeComponents;
}

/**
 * Helper to define and validate a HonoCube theme with type safety.
 */
export function createTheme(theme: HonoCubeTheme): HonoCubeTheme {
  return {
    ...theme,
    components: {
      ...theme.components,
      views: {
        ...theme.components?.views,
      },
      fields: {
        ...theme.components?.fields,
      },
    },
  };
}

/**
 * Resolves a theme against a fallback or base theme.
 */
export function resolveTheme(
  customTheme?: HonoCubeTheme,
  baseTheme?: HonoCubeTheme
): HonoCubeTheme | undefined {
  if (!customTheme && !baseTheme) return undefined;
  if (!customTheme) return baseTheme;
  if (!baseTheme) return customTheme;
  return {
    ...baseTheme,
    ...customTheme,
    components: {
      ...baseTheme.components,
      ...customTheme.components,
      views: {
        ...baseTheme.components?.views,
        ...customTheme.components?.views,
      },
      fields: {
        ...baseTheme.components?.fields,
        ...customTheme.components?.fields,
      },
    },
  };
}

/**
 * Type guard to check if an object satisfies the HonoCubeTheme contract.
 */
export function isHonoCubeTheme(value: unknown): value is HonoCubeTheme {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof (value as any).name === "string"
  );
}
