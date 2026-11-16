import { WorkspaceShell } from "../shell/workspace-shell.js";
import { WorkspaceSidebar } from "../shell/sidebar.js";
import { WorkspaceTopbar } from "../shell/topbar.js";
import { WorkspaceDashboard } from "../page/workspace-dashboard.js";
import { CollectionDetailPage } from "../page/collection-detail-page.js";
import { CollectionMultiView } from "../views/multi-view.js";
import { TableView } from "../views/table-view.js";
import { FormView } from "../views/form-view.js";
import { FormPage } from "../views/form-page.js";
import { FormDialog } from "../views/form-dialog.js";
import { FormSheet } from "../views/form-sheet.js";
import { KanbanView } from "../views/kanban-view.js";
import { CalendarView } from "../views/calendar-view.js";
import { ListView } from "../views/list-view.js";
import { GridView } from "../views/grid-view.js";
import { TreeView } from "../views/tree-view.js";
import { ChildTable } from "../views/child-table.js";
import { SidePanel } from "../views/side-panel.js";
import { DocumentHeader } from "../views/document-header.js";
import { WorkflowActionBar } from "../views/workflow-action-bar.js";
import { FormField } from "../views/form-field.js";
import type { HonoCubeTheme } from "@honocube/core";

/**
 * Official reference default theme for HonoCube.
 * Composes canonical Radix UI primitives and shadcn/ui layouts
 * with Twenty CRM pipeline and ERPNext workflow patterns.
 */
export const defaultTheme: HonoCubeTheme = {
  name: "default",
  version: "2.0.2",
  description: "Official canonical Radix & Shadcn theme for HonoCube with Twenty & ERPNext ergonomics.",
  defaultMode: "system",
  defaultPreset: "zinc",
  components: {
    Shell: WorkspaceShell,
    Sidebar: WorkspaceSidebar,
    Topbar: WorkspaceTopbar,
    Dashboard: WorkspaceDashboard,
    views: {
      table: TableView,
      form: FormView,
      formPage: FormPage,
      formDialog: FormDialog,
      formSheet: FormSheet,
      multiView: CollectionMultiView,
      detail: CollectionDetailPage,
      kanban: KanbanView,
      calendar: CalendarView,
      list: ListView,
      grid: GridView,
      tree: TreeView,
      childTable: ChildTable,
      sidePanel: SidePanel,
      documentHeader: DocumentHeader,
      workflowActionBar: WorkflowActionBar,
    },
    fields: {
      default: FormField,
    },
  },
};
