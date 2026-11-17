/**
 * @honocube/app
 * Enterprise Application & Workspace framework for HonoCube.
 */

export const VERSION = "2.0.2";

// Pure Headless Data Layer, State Machines & Contracts (from @honocube/core)
export * from "@honocube/core";

// Enterprise Views
export { TableView } from "./views/table-view.js";
export { TableToolbar, type TableToolbarProps } from "./views/table-toolbar.js";
export { TablePagination, type TablePaginationProps } from "./views/table-pagination.js";
export { FormView } from "./views/form-view.js";
export { FormDialog } from "./views/form-dialog.js";
export { FormSheet } from "./views/form-sheet.js";
export { FormPage } from "./views/form-page.js";
export { FormField } from "./views/form-field.js";
export {
  MaskedNumericInput,
  formatNumericValue,
  parseNumericString,
  getCurrencySymbol,
  type FormatNumericOptions,
  type ParseNumericOptions,
} from "./views/masked-numeric-input.js";
export {
  DateRangePicker,
  DATE_RANGE_PRESETS,
  parseDateRange,
  type DateRangePreset,
} from "./views/date-range-picker.js";
export { FloatingSaveBar } from "./views/floating-save-bar.js";
export {
  PhoneInputField,
  COUNTRY_CALLING_CODES,
  parsePhoneNumber,
} from "./views/phone-input-field.js";
export {
  ColorPickerField,
  DEFAULT_COLOR_PRESETS,
} from "./views/color-picker-field.js";
export {
  IconPickerField,
  DEFAULT_ICON_REGISTRY,
} from "./views/icon-picker-field.js";
export { TagsInputField } from "./views/tags-input-field.js";
export { SlugInputField } from "./views/slug-input-field.js";
export { BarcodeField } from "./views/barcode-field.js";
export { QRCodeField } from "./views/qr-code-field.js";
export { SignaturePad } from "./views/signature-pad.js";
export { RichTextEditor } from "./views/rich-text-editor.js";
export { AsyncCombobox } from "./views/async-combobox.js";
export { RepeaterField } from "./views/repeater-field.js";
export { UnsavedChangesDialog } from "./views/unsaved-changes-dialog.js";
export { RevisionConflictDialog, type RevisionConflictDialogProps } from "./views/revision-conflict-dialog.js";
export { ChildTable } from "./views/child-table.js";
export { KanbanView } from "./views/kanban-view.js";
export { CalendarView } from "./views/calendar-view.js";
export { ListView } from "./views/list-view.js";
export { GridView } from "./views/grid-view.js";
export { TreeView } from "./views/tree-view.js";
export { SettingsPanel } from "./views/settings-panel.js";
export { ViewSwitcher } from "./views/view-switcher.js";
export { CollectionMultiView } from "./views/multi-view.js";
export { WorkflowActionBar } from "./views/workflow-action-bar.js";
export { DocumentHeader } from "./views/document-header.js";
export { SidePanel } from "./views/side-panel.js";
export { MetricCard, AnalyticsChartCard } from "./views/analytics-cards.js";
export {
  SpreadsheetView,
  SpreadsheetGrid,
  colIndexToLetter,
  letterToColIndex,
  coordToCellRef,
  cellRefToCoord,
  evaluateFormula,
} from "./views/spreadsheet-view.js";
export { PrintDocument } from "./views/print-document.js";
export { PrintDocumentDialog } from "./views/print-document-dialog.js";
export {
  ImportDialog,
  type ImportDialogProps,
  type ImportStep,
} from "./views/import-dialog.js";
export {
  ImportButton,
  type ImportButtonProps,
} from "./views/import-button.js";
export { RealtimeIndicator } from "./views/realtime-indicator.js";
export { RealtimeToastNotifier } from "./views/realtime-toast-notifier.js";
export { CompanyHierarchyTree } from "./views/company-hierarchy-tree.js";
export { MasterDataSyncDialog } from "./views/master-data-sync-dialog.js";
export {
  BulkMediaIngestDialog,
  type BulkMediaStep,
} from "./views/bulk-media-ingest-dialog.js";
export { BulkMediaIngestButton } from "./views/bulk-media-ingest-button.js";
export { NotificationBell } from "./views/notification-bell.js";
export { NotificationRuleDialog } from "./views/notification-rule-dialog.js";
export { CustomFieldsManagerDialog } from "./views/custom-fields-manager-dialog.js";
export { CustomFieldsFormSection } from "./views/custom-fields-form-section.js";
export { AutomationRuleDialog } from "./views/automation-rule-dialog.js";
export { AutomationHistoryView } from "./views/automation-history-view.js";
export { WebhookManagerDialog } from "./views/webhook-manager-dialog.js";
export { WebhookDeliveriesView } from "./views/webhook-deliveries-view.js";
export { AuditTrailView } from "./views/audit-trail-view.js";
export { SidebarCustomizer } from "./views/sidebar-customizer.js";
export { NavigationMenuBuilderDialog } from "./views/navigation-menu-builder-dialog.js";
export { ImpersonationBanner } from "./shell/impersonation-banner.js";
export { ImpersonationDialog } from "./views/impersonation-dialog.js";
export { InlineEntityCreationDialog } from "./views/inline-entity-creation-dialog.js";
export { ForeignKeySelector } from "./views/foreign-key-selector.js";




// Programmatic PDF Export Engine & UI Primitives (Issue #133)
export {
  PdfDocument,
  PdfPage,
  PAGE_SIZES,
  STANDARD_FONTS,
  measureTextWidth,
  escapePdfString,
  truncateText,
  hexToRgb,
  uint8ArrayToBase64,
  downloadBlob,
  downloadPdf,
  exportTableToPdf,
  exportDocumentToPdf,
} from "./pdf/pdf-engine.js";
export { ExportPdfButton } from "./views/export-pdf-button.js";
export { PdfPreviewDialog } from "./views/pdf-preview-dialog.js";

// Hardware & Camera Barcode/QR Code Scanner Integration (Issue #123)
export { useBarcodeScanner, playScanBeep } from "./scanner/use-barcode-scanner.js";
export { BarcodeCameraScanner } from "./scanner/barcode-camera-scanner.js";
export { BarcodeScannerDialog } from "./views/barcode-scanner-dialog.js";
export { ScanVerificationWidget } from "./views/scan-verification-widget.js";

// Interactive Analytics & Chart Primitives
export {
  LineChart,
  AreaChart,
  BarChart,
  DonutChart,
  Sparkline,
  ChartLegend,
  DEFAULT_CHART_COLORS,
} from "@honocube/ui";

// Media Library & Asset Management
export {
  MediaLibrary,
  MediaLibraryDialog,
  type MediaLibraryProps,
  type MediaLibraryDialogProps,
} from "./media/media-library.js";
export {
  ImagePickerField,
  type ImagePickerFieldProps,
} from "./media/image-picker-field.js";

// Navigation Guards & Route Interception
export {
  NavigationGuardProvider,
  useNavigationGuard,
  useUnsavedChangesGuard,
  type NavigationGuardContextValue,
  type NavigationGuardProviderProps,
  type UseUnsavedChangesGuardOptions,
} from "./navigation/navigation-guard.js";

// Workspace Shell Layout & Navigation
export { WorkspaceShell } from "./shell/workspace-shell.js";
export { WorkspaceSidebar } from "./shell/sidebar.js";
export { WorkspaceTopbar } from "./shell/topbar.js";
export { WorkspaceBreadcrumbs, parsePathnameToBreadcrumbs } from "./shell/breadcrumbs.js";
export { Spotlight } from "./shell/spotlight.js";
export { TenantSwitcher } from "./shell/tenant-switcher.js";
export { UserProfileDropdown } from "./shell/user-profile.js";

// Theming, Layout Templates & Appearance
export { defaultTheme } from "./theme/default-theme.js";
export {
  ThemeProvider,
  useTheme,
  useAppTheme,
} from "./theme/theme-provider.js";
export { ThemeSwitcher } from "./theme/theme-switcher.js";
export type {
  ThemeProviderProps,
  ThemeContextValue,
} from "./theme/theme-provider.js";
export { toast, Toaster, type ToasterProps } from "@honocube/ui";

// Workspace Catch-all Page & Routing
export { WorkspacePage } from "./page/workspace-page.js";
export { WorkspaceDashboard } from "./page/workspace-dashboard.js";
export { CollectionDetailPage } from "./page/collection-detail-page.js";
