import React from "react";
import { Lock, Loader2 } from "lucide-react";
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  toast,
} from "@honocube/ui";
import {
  useCollectionForm,
  type Collection,
  type FormTab,
  type FormSection,
  type SubCollectionFieldConfig,
  type FormViewProps,
} from "@honocube/core";
import { FormField } from "./form-field.js";
import { ChildTable } from "./child-table.js";
import { FloatingSaveBar } from "./floating-save-bar.js";
import { useUnsavedChangesGuard } from "../navigation/navigation-guard.js";

export function FormView<TCollection extends Collection<any>>({
  collection,
  id,
  initialValues,
  mode,
  onSuccess,
  onError,
  onCancel,
  onSubmit,
  user,
  parentRecord,
  title,
  description,
  actions,
  className = "",
  showHeader = true,
  showFooter = true,
  submitLabel,
  floatingSaveBar = true,
  unsavedChangesGuard = true,
}: FormViewProps<TCollection>): React.JSX.Element {
  // 1. Initialize Headless Collection Form Engine
  const formReturn = useCollectionForm(collection, {
    id,
    initialValues,
    mode,
    onSuccess,
    onError,
    onSubmit,
    user,
    parentRecord,
    notify: toast,
  });

  const {
    handleSubmit,
    reset,
    isSubmitting,
    isLoading,
    isDirty,
    workflow,
    getFieldState,
    setFieldValue,
    child,
    mode: resolvedMode,
  } = formReturn;

  const isLocked = Boolean(workflow?.isLocked);
  const isFormDisabled = isLocked || resolvedMode === "view";

  // Navigation guard against accidental route exit or tab closure when form has uncommitted changes
  const { renderDialog } = useUnsavedChangesGuard({
    isDirty: Boolean(isDirty && !isFormDisabled && !isLoading),
    enabled: unsavedChangesGuard !== false,
  });

  // Keyboard shortcut Ctrl+S / Cmd+S to submit form when dirty
  React.useEffect(() => {
    if (!floatingSaveBar || isFormDisabled || typeof window === "undefined") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [floatingSaveBar, isFormDisabled, handleSubmit]);

  const resolvedTitle =
    title ||
    (resolvedMode === "create"
      ? `New ${collection.singular || collection.label || "Record"}`
      : `Edit ${collection.singular || collection.label || "Record"}`);

  // Helper to render either a standard field or an embedded child table
  const renderFieldOrChild = (fieldKey: string) => {
    const field = collection.getField(fieldKey);
    if (!field) return null;

    if (field.type === "collection") {
      return (
        <div key={fieldKey} className="col-span-full">
          <ChildTable
            name={fieldKey}
            field={field as SubCollectionFieldConfig<any>}
            childHelper={child(fieldKey as any)}
            disabled={isFormDisabled}
          />
        </div>
      );
    }

    return (
      <FormField
        key={fieldKey}
        name={fieldKey}
        field={field}
        fieldState={getFieldState(fieldKey as any)}
        onChange={(val) => setFieldValue(fieldKey as any, val)}
        disabled={isFormDisabled}
        values={formReturn.values}
      />
    );
  };

  const getGridColsClass = (columns?: number) => {
    if (columns === 1) return "grid-cols-1";
    if (columns === 3) return "grid-cols-1 md:grid-cols-3";
    return "grid-cols-1 md:grid-cols-2";
  };

  const formTabs = collection.form?.tabs;
  const formSections = collection.form?.sections;

  return (
    <form
      data-testid="form-view"
      onSubmit={handleSubmit}
      className={`space-y-6 ${className}`}
      noValidate
    >
      {/* 1. Form Header Card */}
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">{resolvedTitle}</h2>
              {workflow?.currentState && (
                <Badge
                  variant={workflow.stateMeta?.variant || "outline"}
                  className="capitalize"
                >
                  {workflow.stateMeta?.label || workflow.currentState}
                </Badge>
              )}
              {isLocked && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Lock className="h-3 w-3" />
                  <span>Locked</span>
                </Badge>
              )}
            </div>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>

          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {/* 2. Loading State */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mb-2" />
          <span className="text-sm">Loading record data...</span>
        </div>
      ) : (
        /* 3. Form Layout (Tabs vs Sections vs Default Grid) */
        <div className="space-y-6">
          {formTabs && formTabs.length > 0 ? (
            <Tabs defaultValue={formTabs[0]?.label}>
              <TabsList className="mb-4">
                {(formTabs as FormTab[]).map((tab: FormTab) => (
                  <TabsTrigger key={tab.label} value={tab.label}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {(formTabs as FormTab[]).map((tab: FormTab) => (
                <TabsContent
                  key={tab.label}
                  value={tab.label}
                  forceMount
                  className="space-y-4 focus-visible:outline-none data-[state=inactive]:hidden"
                >
                  {tab.sections && tab.sections.length > 0 ? (
                    (tab.sections as FormSection[]).map((sec: FormSection, idx: number) => (
                      <Card key={sec.title || idx}>
                        {sec.title && (
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">{sec.title}</CardTitle>
                            {sec.description && (
                              <CardDescription>{sec.description}</CardDescription>
                            )}
                          </CardHeader>
                        )}
                        <CardContent>
                          <div
                            className={`grid gap-4 ${getGridColsClass(
                              sec.columns
                            )}`}
                          >
                            {sec.fields.map((f: string) => renderFieldOrChild(String(f)))}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : tab.fields && tab.fields.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {tab.fields.map((f: string) => renderFieldOrChild(String(f)))}
                    </div>
                  ) : null}
                </TabsContent>
              ))}
            </Tabs>
          ) : formSections && formSections.length > 0 ? (
            (formSections as FormSection[]).map((sec: FormSection, idx: number) => (
              <Card key={sec.title || idx}>
                {sec.title && (
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{sec.title}</CardTitle>
                    {sec.description && (
                      <CardDescription>{sec.description}</CardDescription>
                    )}
                  </CardHeader>
                )}
                <CardContent>
                  <div className={`grid gap-4 ${getGridColsClass(sec.columns)}`}>
                    {sec.fields.map((f: string) => renderFieldOrChild(String(f)))}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {collection.getFieldKeys().map((k: any) => renderFieldOrChild(String(k)))}
            </div>
          )}
        </div>
      )}

      {/* 4. Form Action Buttons Footer */}
      {showFooter && !isLoading && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t">
          <div className="flex items-center gap-2">
            {resolvedMode !== "view" && (
              <Button
                type="submit"
                disabled={isSubmitting || isLocked}
                className="gap-2"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>
                  {submitLabel ||
                    (resolvedMode === "create" ? "Create" : "Save Changes")}
                </span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={onCancel || reset}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>

          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {/* 5. Contextual Floating Save Bar when form is dirty */}
      {floatingSaveBar && isDirty && !isFormDisabled && !isLoading && (
        <FloatingSaveBar
          isDirty={isDirty}
          isSubmitting={isSubmitting}
          saveLabel={submitLabel || (resolvedMode === "create" ? "Create" : "Save changes")}
          onDiscard={reset}
        />
      )}

      {/* 6. Unsaved changes confirmation dialog if not wrapped in NavigationGuardProvider */}
      {renderDialog()}
    </form>
  );
}
