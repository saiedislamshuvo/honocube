import * as React from "react";
import { useState, useMemo } from "react";
import {
  Mail,
  Eye,
  Send,
  Save,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Monitor,
  Code2,
  Globe,
} from "lucide-react";
import {
  Button,
  Input,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
  Switch,
} from "@honocube/ui";
import {
  renderEmailTemplate,
  validateTemplateSyntax,
  STANDARD_EMAIL_TOKENS,
  DEFAULT_EMAIL_LAYOUT,
  type EmailTemplateEditorDialogProps,
  type EmailTemplate,
  type EmailTemplateCategory,
  type RenderedEmail,
} from "@honocube/core";
import { TokenPicker } from "./token-picker.js";

const DEFAULT_SAMPLE_DATA: Record<string, any> = {
  company: {
    name: "Acme Corporation",
    support_email: "support@acme.com",
    website: "https://acme.com",
    address: "123 Market St, Suite 400",
  },
  user: {
    name: "Jane Doe",
    first_name: "Jane",
    last_name: "Doe",
    email: "jane.doe@example.com",
    role: "Member",
  },
  order: {
    id: "ORD-7890",
    total: "$129.00",
    date: "Nov 17, 2026",
    status: "Confirmed",
    tracking_url: "https://track.example.com/ORD-7890",
    items: [
      { name: "Enterprise Pro Subscription", quantity: 1, price: 99.0 },
      { name: "Priority Support Add-on", quantity: 1, price: 30.0 },
    ],
  },
  invoice: {
    id: "INV-2026-089",
    amount_due: "$129.00",
    due_date: "Dec 01, 2026",
    pdf_url: "https://pay.example.com/invoice/INV-2026-089.pdf",
  },
  auth: {
    reset_url: "https://app.example.com/reset?token=demo_token_123",
    expires_in: "60 minutes",
  },
};

export function EmailTemplateEditorDialog({
  open,
  onOpenChange,
  template,
  layouts = [DEFAULT_EMAIL_LAYOUT],
  availableTokens = STANDARD_EMAIL_TOKENS,
  onSave,
  onSendTest,
  sampleData = DEFAULT_SAMPLE_DATA,
  className = "",
}: EmailTemplateEditorDialogProps): React.JSX.Element | null {
  const [activeTab, setActiveTab] = useState<"editor" | "preview" | "test">("editor");

  // Form State
  const [id, setId] = useState(template?.id || "");
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [category, setCategory] = useState<EmailTemplateCategory>(
    template?.category || "transactional"
  );
  const [subject, setSubject] = useState(template?.subject || "");
  const [previewText, setPreviewText] = useState(template?.previewText || "");
  const [bodyHtml, setBodyHtml] = useState(template?.bodyHtml || "");
  const [bodyText, setBodyText] = useState(template?.bodyText || "");
  const [locale, setLocale] = useState(template?.locale || "en");
  const [active, setActive] = useState(template?.active ?? true);
  const [senderName, setSenderName] = useState(template?.senderName || "");
  const [senderEmail, setSenderEmail] = useState(template?.senderEmail || "");
  const [replyTo, setReplyTo] = useState(template?.replyTo || "");
  const [selectedLayoutId, setSelectedLayoutId] = useState<string>(
    template?.layoutId || layouts[0]?.id || "default_branded_layout"
  );

  // Preview & Test state
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [testEmailRecipient, setTestEmailRecipient] = useState("test@example.com");
  const [testSendSuccess, setTestSendSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when template prop changes
  React.useEffect(() => {
    if (template) {
      setId(template.id || "");
      setName(template.name || "");
      setDescription(template.description || "");
      setCategory(template.category || "transactional");
      setSubject(template.subject || "");
      setPreviewText(template.previewText || "");
      setBodyHtml(template.bodyHtml || "");
      setBodyText(template.bodyText || "");
      setLocale(template.locale || "en");
      setActive(template.active ?? true);
      setSenderName(template.senderName || "");
      setSenderEmail(template.senderEmail || "");
      setReplyTo(template.replyTo || "");
      setSelectedLayoutId(template.layoutId || layouts[0]?.id || "default_branded_layout");
    }
  }, [template, layouts]);

  // Syntax validation
  const syntaxCheck = useMemo(() => {
    return validateTemplateSyntax(bodyHtml);
  }, [bodyHtml]);

  // Current selected layout
  const activeLayout = useMemo(() => {
    return layouts.find((l) => l.id === selectedLayoutId) || layouts[0];
  }, [layouts, selectedLayoutId]);

  // Rendered preview
  const rendered: RenderedEmail = useMemo(() => {
    const dummyTemplate: EmailTemplate = {
      id: id || "temp",
      name: name || "Template",
      category,
      subject,
      previewText,
      bodyHtml,
      bodyText,
      locale,
      active,
      senderName,
      senderEmail,
      replyTo,
    };

    return renderEmailTemplate(dummyTemplate, sampleData, {
      locale,
      layout: activeLayout,
    });
  }, [
    id,
    name,
    category,
    subject,
    previewText,
    bodyHtml,
    bodyText,
    locale,
    active,
    senderName,
    senderEmail,
    replyTo,
    sampleData,
    activeLayout,
  ]);

  const handleSave = async () => {
    if (!name.trim() || !subject.trim() || !bodyHtml.trim()) return;
    setIsSaving(true);
    try {
      const templateToSave: EmailTemplate = {
        id: id.trim() || name.toLowerCase().replace(/[^a-z0-9_]+/g, "_"),
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        subject: subject.trim(),
        previewText: previewText.trim() || undefined,
        bodyHtml,
        bodyText: bodyText.trim() || undefined,
        locale,
        active,
        senderName: senderName.trim() || undefined,
        senderEmail: senderEmail.trim() || undefined,
        replyTo: replyTo.trim() || undefined,
        layoutId: selectedLayoutId,
        tokens: availableTokens,
        updatedAt: Date.now(),
        createdAt: template?.createdAt || Date.now(),
      };

      if (onSave) {
        await onSave(templateToSave);
      }
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmailRecipient) return;
    if (onSendTest) {
      await onSendTest(testEmailRecipient, rendered);
    }
    setTestSendSuccess(true);
    setTimeout(() => setTestSendSuccess(false), 3000);
  };

  const insertTokenIntoSubject = (token: string) => {
    setSubject((prev) => `${prev} {{${token}}}`);
  };

  const insertTokenIntoBody = (token: string) => {
    setBodyHtml((prev) => `${prev} {{${token}}}`);
  };

  if (!open) return null;

  // SSR Fallback
  if (typeof document === "undefined") {
    return (
      <div data-testid="email-template-editor-dialog" className="hidden">
        <h2>{name || "Email Template Editor"}</h2>
        <button data-testid="email-template-save-btn">Save Template</button>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="email-template-editor-dialog"
        className={`sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden ${className}`}
      >
        {/* Header */}
        <DialogHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Mail className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base">
                  {name ? `Edit Template: ${name}` : "New Email Template"}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Customize transactional message wording, dynamic placeholder tokens, and branding.
                </DialogDescription>
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center gap-2 mr-6">
              <span className="text-xs text-muted-foreground">Active</span>
              <Switch checked={active} onCheckedChange={setActive} data-testid="template-active-switch" />
            </div>
          </div>
        </DialogHeader>

        {/* Content Body with Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as any)}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="border-b px-4 bg-muted/40 flex items-center justify-between">
            <TabsList className="bg-transparent h-10 p-0 gap-4">
              <TabsTrigger
                value="editor"
                data-testid="tab-editor"
                className="data-[state=active]:bg-background data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-3 text-xs"
              >
                <Code2 className="mr-1.5 size-3.5" />
                Template Design
              </TabsTrigger>
              <TabsTrigger
                value="preview"
                data-testid="tab-preview"
                className="data-[state=active]:bg-background data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-3 text-xs"
              >
                <Eye className="mr-1.5 size-3.5" />
                Live Preview
                {rendered.missingTokens.length > 0 && (
                  <Badge variant="destructive" className="ml-1.5 text-[10px] px-1 py-0 h-4">
                    {rendered.missingTokens.length} Missing
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="test"
                data-testid="tab-test"
                className="data-[state=active]:bg-background data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-3 text-xs"
              >
                <Send className="mr-1.5 size-3.5" />
                Send Test
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <Globe className="size-3.5 text-muted-foreground" />
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                data-testid="template-locale-select"
                aria-label="Template Locale"
                className="h-7 text-xs rounded border border-border bg-background px-2"
              >
                <option value="en">English (en)</option>
                <option value="es">Spanish (es)</option>
                <option value="fr">French (fr)</option>
                <option value="de">German (de)</option>
              </select>
            </div>
          </div>

          {/* TAB 1: Template Design & Code */}
          <TabsContent value="editor" className="flex-1 overflow-y-auto p-4 space-y-4 m-0">
            {/* Metadata Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Template Name *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Order Confirmation"
                  data-testid="template-name-input"
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Template ID / Identifier
                </label>
                <Input
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="e.g. order_confirmation"
                  data-testid="template-id-input"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as EmailTemplateCategory)}
                  data-testid="template-category-select"
                  aria-label="Category"
                  className="w-full h-8 text-xs rounded-md border border-border bg-background px-2"
                >
                  <option value="transactional">Transactional</option>
                  <option value="auth">Authentication & Security</option>
                  <option value="billing">Billing & Invoices</option>
                  <option value="marketing">Marketing & Updates</option>
                  <option value="system">System Alerts</option>
                </select>
              </div>
            </div>

            {/* Subject Line & Preheader */}
            <div className="space-y-3 p-3 bg-muted/20 border rounded-lg">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-foreground">
                    Subject Line *
                  </label>
                  <TokenPicker
                    tokens={availableTokens}
                    onSelectToken={insertTokenIntoSubject}
                    buttonLabel="Token"
                  />
                </div>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Your Order #{{order.id}} has been confirmed"
                  data-testid="template-subject-input"
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Preview Text / Preheader
                </label>
                <Input
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  placeholder="Short summary displayed in the inbox preview pane"
                  data-testid="template-preview-text-input"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* HTML Body Editor */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-foreground">
                    HTML Message Body *
                  </label>
                  {!syntaxCheck.valid && (
                    <Badge variant="destructive" className="text-[10px] gap-1 px-1.5 py-0 h-4">
                      <AlertTriangle className="size-3" />
                      Syntax Warning
                    </Badge>
                  )}
                </div>
                <TokenPicker
                  tokens={availableTokens}
                  onSelectToken={insertTokenIntoBody}
                  buttonLabel="Insert Token"
                />
              </div>

              {!syntaxCheck.valid && (
                <div className="p-2 bg-destructive/10 text-destructive text-xs rounded border border-destructive/20 space-y-0.5">
                  {syntaxCheck.errors.map((err, i) => (
                    <p key={i}>• {err}</p>
                  ))}
                </div>
              )}

              <Textarea
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                placeholder="Write your email HTML content here... You can use tokens like {{user.name}}, {{#if condition}}...{{/if}}, and {{#each items}}...{{/each}}."
                data-testid="template-body-html-input"
                className="font-mono text-xs min-h-[160px] leading-relaxed"
                required
              />
            </div>

            {/* Sender Overrides & Layout Selection */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Sender Name
                </label>
                <Input
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="e.g. Acme Orders"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Sender Email
                </label>
                <Input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="orders@acme.com"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Reply-To Email
                </label>
                <Input
                  type="email"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                  placeholder="support@acme.com"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Branded Layout
                </label>
                <select
                  value={selectedLayoutId}
                  onChange={(e) => setSelectedLayoutId(e.target.value)}
                  aria-label="Branded Layout"
                  className="w-full h-8 text-xs rounded-md border border-border bg-background px-2"
                >
                  {layouts.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: Live Preview */}
          <TabsContent value="preview" className="flex-1 overflow-y-auto p-4 m-0 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Subject:</span>
                  <span className="text-xs font-medium text-foreground" data-testid="preview-rendered-subject">
                    {rendered.subject || "(No subject)"}
                  </span>
                </div>
                {rendered.previewText && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Preheader:</span>
                    <span className="text-xs text-muted-foreground">{rendered.previewText}</span>
                  </div>
                )}
              </div>

              {/* Viewport switch */}
              <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md">
                <Button
                  type="button"
                  variant={previewDevice === "desktop" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setPreviewDevice("desktop")}
                  className="h-7 px-2 text-xs"
                  data-testid="preview-device-desktop"
                >
                  <Monitor className="size-3.5 mr-1" />
                  Desktop
                </Button>
                <Button
                  type="button"
                  variant={previewDevice === "mobile" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setPreviewDevice("mobile")}
                  className="h-7 px-2 text-xs"
                  data-testid="preview-device-mobile"
                >
                  <Smartphone className="size-3.5 mr-1" />
                  Mobile
                </Button>
              </div>
            </div>

            {/* Missing tokens notification */}
            {rendered.missingTokens.length > 0 && (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-md text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>
                    <strong>Missing Sample Data Tokens:</strong>{" "}
                    {rendered.missingTokens.map((t) => `{{${t}}}`).join(", ")}
                  </span>
                </div>
              </div>
            )}

            {/* Sandboxed HTML container */}
            <div className="flex justify-center bg-muted/30 p-4 rounded-lg overflow-x-auto">
              <div
                style={{
                  width: previewDevice === "mobile" ? "375px" : "620px",
                  transition: "width 0.2s ease-in-out",
                }}
                className="bg-card border rounded-md shadow-sm overflow-hidden"
                data-testid="email-preview-container"
              >
                <div
                  className="email-rendered-preview p-2"
                  dangerouslySetInnerHTML={{ __html: rendered.html }}
                />
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: Send Test Email */}
          <TabsContent value="test" className="flex-1 overflow-y-auto p-4 m-0 space-y-4">
            <div className="max-w-md mx-auto py-8 space-y-4">
              <div className="text-center space-y-1">
                <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
                  <Send className="size-5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Send Test Email</h3>
                <p className="text-xs text-muted-foreground">
                  Verify how your template renders in real inbox clients by sending a test message.
                </p>
              </div>

              <div className="space-y-3 border p-4 rounded-lg bg-card">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Recipient Email Address
                  </label>
                  <Input
                    type="email"
                    value={testEmailRecipient}
                    onChange={(e) => setTestEmailRecipient(e.target.value)}
                    placeholder="your-email@example.com"
                    data-testid="test-email-recipient-input"
                    className="h-8 text-xs"
                    required
                  />
                </div>

                <div className="text-xs text-muted-foreground space-y-1 bg-muted/40 p-2.5 rounded">
                  <p>• <strong>Subject:</strong> {rendered.subject}</p>
                  <p>• <strong>Sender:</strong> {senderEmail || "system@honocube.com"}</p>
                </div>

                {testSendSuccess && (
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded text-xs flex items-center gap-2">
                    <CheckCircle2 className="size-4" />
                    <span>Test email successfully dispatched to {testEmailRecipient}!</span>
                  </div>
                )}

                <Button
                  type="button"
                  onClick={handleSendTest}
                  disabled={!testEmailRecipient}
                  data-testid="send-test-email-btn"
                  className="w-full text-xs h-8 gap-1.5"
                >
                  <Send className="size-3.5" />
                  Send Test Message
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <DialogFooter className="p-3 border-t bg-muted/20 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!name.trim() || !subject.trim() || !bodyHtml.trim() || isSaving}
            data-testid="email-template-save-btn"
            className="text-xs h-8 gap-1.5"
          >
            <Save className="size-3.5" />
            {isSaving ? "Saving..." : "Save Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
