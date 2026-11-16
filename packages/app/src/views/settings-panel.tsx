import React, { useState, useMemo, useContext } from "react";
import { Sliders, Save, Check, Loader2 } from "lucide-react";
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
  AppContext,
  useCollectionQuery,
  useCollectionForm,
  type Collection,
  type InferRecord,
  type FormTab,
  type FormSection,
  type SubCollectionFieldConfig,
  type SettingsPanelProps,
  type FormFieldState,
} from "@honocube/core";
import { FormField } from "./form-field.js";
import { ChildTable } from "./child-table.js";

interface ConnectedSettingsPanelContentProps<TCollection extends Collection<any>>
  extends SettingsPanelProps<TCollection> {
  initialData?: InferRecord<TCollection>;
  isLoadingQuery?: boolean;
}

function ConnectedSettingsPanelContent<TCollection extends Collection<any>>({
  collection,
  initialData,
  isLoadingQuery = false,
  title,
  description,
  activeTab: propActiveTab,
  onTabChange,
  onSave,
  onSuccess,
  onError,
  actions,
  showHeader = true,
  showSaveBar = true,
  saveLabel = "Save Changes",
  className = "",
}: ConnectedSettingsPanelContentProps<TCollection>): React.JSX.Element {
  const appContext = useContext(AppContext);
  const client = appContext?.client;

  // 1. Initialize Headless Collection Form Engine
  const recordId = (initialData as any)?.id;
  const formReturn = useCollectionForm(collection, {
    id: recordId,
    initialValues: initialData,
    mode: "edit",
    autoFetch: false,
    onSubmit: async (values) => {
      if (onSave) {
        await onSave(values);
      } else if (client) {
        const endpoint = collection.endpoint || `/api/${collection.name}`;
        if (recordId !== undefined && recordId !== null) {
          await client.patch(`${endpoint}/${recordId}`, values);
        } else {
          await client.patch(endpoint, values);
        }
      }
    },
    onSuccess: (savedRecord) => {
      toast.success(
        `${collection.label || collection.singular || "Settings"} updated successfully`
      );
      onSuccess?.(savedRecord);
    },
    onError: (err) => {
      onError?.(err);
    },
    notify: toast,
  });

  const {
    handleSubmit,
    reset,
    isSubmitting,
    isLoading: isFormLoading,
    isDirty,
    getFieldState,
    setFieldValue,
    child,
  } = formReturn;

  const isLoading = isLoadingQuery || isFormLoading;

  const formTabs = collection.form?.tabs;
  const formSections = collection.form?.sections;

  const [internalTab, setInternalTab] = useState<string>(
    propActiveTab || formTabs?.[0]?.label || ""
  );

  const currentTab = propActiveTab || internalTab;

  const handleTabChange = (val: string) => {
    setInternalTab(val);
    onTabChange?.(val);
  };

  const getGridColsClass = (columns?: number) => {
    if (columns === 1) return "grid-cols-1";
    if (columns === 3) return "grid-cols-1 md:grid-cols-3";
    return "grid-cols-1 md:grid-cols-2";
  };

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
            disabled={isSubmitting}
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
        disabled={isSubmitting}
      />
    );
  };

  const resolvedTitle = title || collection.label || "Settings";
  const resolvedDescription =
    description || "Manage system-wide configuration, regional defaults, and integration options.";

  return (
    <form
      data-testid="settings-panel-form"
      onSubmit={handleSubmit}
      className={`space-y-6 ${className}`}
      noValidate
    >
      {/* 1. Header Toolbar */}
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">{resolvedTitle}</h1>
                {isDirty && (
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 text-amber-600 bg-amber-50 dark:bg-amber-950/20 text-xs font-normal"
                  >
                    Unsaved changes
                  </Badge>
                )}
              </div>
              {resolvedDescription && (
                <p className="text-xs text-muted-foreground mt-0.5">{resolvedDescription}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {actions}
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="gap-1.5 h-8 text-xs font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>{saveLabel}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* 2. Loading State */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground border rounded-lg bg-card">
          <Loader2 className="h-6 w-6 animate-spin mb-2" />
          <span className="text-sm">Loading settings configuration...</span>
        </div>
      ) : (
        /* 3. Settings Form Layout (Tabs vs Sections vs Standard Fields Grid) */
        <div className="space-y-6">
          {formTabs && formTabs.length > 0 ? (
            <Tabs value={currentTab} onValueChange={handleTabChange}>
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
                          <div className={`grid gap-4 ${getGridColsClass(sec.columns)}`}>
                            {sec.fields.map((f: string) => renderFieldOrChild(String(f)))}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : tab.fields && tab.fields.length > 0 ? (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                          {tab.fields.map((f: string) => renderFieldOrChild(String(f)))}
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}
                </TabsContent>
              ))}
            </Tabs>
          ) : formSections && formSections.length > 0 ? (
            <div className="space-y-6">
              {(formSections as FormSection[]).map((sec: FormSection, idx: number) => (
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
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                  {collection.getFieldKeys().map((key) => renderFieldOrChild(String(key)))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 4. Sticky Bottom Save Bar when dirty */}
      {showSaveBar && isDirty && (
        <div className="sticky bottom-4 z-10 flex items-center justify-between p-3 px-4 rounded-lg border bg-background/95 backdrop-blur shadow-md">
          <span className="text-xs font-medium text-muted-foreground">
            You have unsaved changes
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => reset()}
              disabled={isSubmitting}
              className="h-7 text-xs px-2.5"
            >
              Discard
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="gap-1.5 h-7 text-xs px-3 font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-3 w-3" />
                  <span>{saveLabel}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

/**
 * Standalone Settings Panel for SSR or component testing when AppProvider / ApiClient is not present.
 */
function StandaloneSettingsPanelContent<TCollection extends Collection<any>>({
  collection,
  data = {} as any,
  title,
  description,
  activeTab: propActiveTab,
  onTabChange,
  onSave,
  actions,
  showHeader = true,
  saveLabel = "Save Changes",
  className = "",
}: SettingsPanelProps<TCollection>): React.JSX.Element {
  const [formValues, setFormValues] = useState<Record<string, any>>({ ...data });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formTabs = collection.form?.tabs;
  const formSections = collection.form?.sections;

  const [internalTab, setInternalTab] = useState<string>(
    propActiveTab || formTabs?.[0]?.label || ""
  );

  const currentTab = propActiveTab || internalTab;

  const handleTabChange = (val: string) => {
    setInternalTab(val);
    onTabChange?.(val);
  };

  const getGridColsClass = (columns?: number) => {
    if (columns === 1) return "grid-cols-1";
    if (columns === 3) return "grid-cols-1 md:grid-cols-3";
    return "grid-cols-1 md:grid-cols-2";
  };

  const renderField = (fieldKey: string) => {
    const field = collection.getField(fieldKey);
    if (!field) return null;

    const val = formValues[fieldKey];
    const fieldState: FormFieldState = {
      value: val,
      errors: [],
      error: undefined,
      isTouched: false,
      isDirty: false,
      visible: true,
      disabled: false,
      readOnly: false,
      required: Boolean(field.required),
    };

    return (
      <FormField
        key={fieldKey}
        name={fieldKey}
        field={field}
        fieldState={fieldState}
        onChange={(newVal) => {
          setFormValues((prev) => ({ ...prev, [fieldKey]: newVal }));
        }}
        disabled={isSubmitting}
      />
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (onSave) {
        await onSave(formValues);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resolvedTitle = title || collection.label || "Settings";
  const resolvedDescription =
    description || "Manage system-wide configuration, regional defaults, and integration options.";

  return (
    <form
      data-testid="settings-panel-form"
      onSubmit={handleSubmit}
      className={`space-y-6 ${className}`}
      noValidate
    >
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">{resolvedTitle}</h1>
              </div>
              {resolvedDescription && (
                <p className="text-xs text-muted-foreground mt-0.5">{resolvedDescription}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {actions}
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="gap-1.5 h-8 text-xs font-medium"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{saveLabel}</span>
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {formTabs && formTabs.length > 0 ? (
          <Tabs value={currentTab} onValueChange={handleTabChange}>
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
                        <div className={`grid gap-4 ${getGridColsClass(sec.columns)}`}>
                          {sec.fields.map((f: string) => renderField(String(f)))}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : tab.fields && tab.fields.length > 0 ? (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                        {tab.fields.map((f: string) => renderField(String(f)))}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </TabsContent>
            ))}
          </Tabs>
        ) : formSections && formSections.length > 0 ? (
          <div className="space-y-6">
            {(formSections as FormSection[]).map((sec: FormSection, idx: number) => (
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
                    {sec.fields.map((f: string) => renderField(String(f)))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {collection.getFieldKeys().map((key) => renderField(String(key)))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </form>
  );
}

function SettingsPanelWithQuery<TCollection extends Collection<any>>(
  props: SettingsPanelProps<TCollection>
): React.JSX.Element {
  const { collection } = props;
  const queryResult = useCollectionQuery({
    collection,
    params: { limit: 1 },
  });

  const record: InferRecord<TCollection> | undefined = useMemo(() => {
    const raw = queryResult.data?.data;
    if (Array.isArray(raw)) {
      return raw[0] as InferRecord<TCollection> | undefined;
    }
    if (raw && typeof raw === "object") {
      return raw as InferRecord<TCollection>;
    }
    return undefined;
  }, [queryResult.data]);

  return (
    <ConnectedSettingsPanelContent
      {...props}
      initialData={record}
      isLoadingQuery={queryResult.isLoading && !record}
    />
  );
}

export function SettingsPanel<TCollection extends Collection<any>>(
  props: SettingsPanelProps<TCollection>
): React.JSX.Element {
  const appContext = useContext(AppContext);

  if (!appContext) {
    return <StandaloneSettingsPanelContent {...props} />;
  }

  if (props.data !== undefined) {
    return <ConnectedSettingsPanelContent {...props} initialData={props.data} />;
  }

  return <SettingsPanelWithQuery {...props} />;
}
