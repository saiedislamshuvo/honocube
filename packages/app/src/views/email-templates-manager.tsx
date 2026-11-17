import * as React from "react";
import { useState, useMemo } from "react";
import {
  Mail,
  Plus,
  Search,
  Edit,
  Copy,
  Trash2,
} from "lucide-react";
import {
  Button,
  Input,
  Badge,
  Switch,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@honocube/ui";
import {
  DEFAULT_EMAIL_TEMPLATES,
  DEFAULT_EMAIL_LAYOUT,
  STANDARD_EMAIL_TOKENS,
  type EmailTemplatesManagerProps,
  type EmailTemplate,
  type EmailTemplateCategory,
} from "@honocube/core";
import { EmailTemplateEditorDialog } from "./email-template-editor-dialog.js";

const CATEGORIES: Array<{ id: EmailTemplateCategory | "all"; label: string }> = [
  { id: "all", label: "All Templates" },
  { id: "transactional", label: "Transactional" },
  { id: "auth", label: "Authentication" },
  { id: "billing", label: "Billing & Invoices" },
  { id: "system", label: "System Alerts" },
  { id: "marketing", label: "Marketing" },
];

export function EmailTemplatesManager({
  templates: initialTemplates = DEFAULT_EMAIL_TEMPLATES,
  layouts = [DEFAULT_EMAIL_LAYOUT],
  availableTokens = STANDARD_EMAIL_TOKENS,
  onSaveTemplate,
  onDeleteTemplate,
  onSendTest,
  className = "",
}: EmailTemplatesManagerProps): React.JSX.Element {
  const [templates, setTemplates] = useState<EmailTemplate[]>(initialTemplates);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<EmailTemplateCategory | "all">("all");

  // Dialog state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | undefined>(undefined);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const matchesCategory =
        selectedCategory === "all" || tpl.category === selectedCategory;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        tpl.name.toLowerCase().includes(q) ||
        tpl.subject.toLowerCase().includes(q) ||
        tpl.id.toLowerCase().includes(q) ||
        (tpl.description && tpl.description.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [templates, selectedCategory, search]);

  const handleCreateNew = () => {
    setEditingTemplate({
      id: "",
      name: "",
      description: "",
      category: "transactional",
      subject: "",
      bodyHtml: "<p>Hello {{user.name}},</p><p>Your message content here.</p>",
      locale: "en",
      active: true,
    });
    setEditorOpen(true);
  };

  const handleEdit = (tpl: EmailTemplate) => {
    setEditingTemplate(tpl);
    setEditorOpen(true);
  };

  const handleDuplicate = (tpl: EmailTemplate) => {
    const duplicated: EmailTemplate = {
      ...tpl,
      id: `${tpl.id}_copy_${Date.now().toString().slice(-4)}`,
      name: `${tpl.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setTemplates((prev) => [...prev, duplicated]);
    if (onSaveTemplate) {
      onSaveTemplate(duplicated);
    }
  };

  const handleDelete = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (onDeleteTemplate) {
      onDeleteTemplate(id);
    }
  };

  const handleToggleActive = (id: string, active: boolean) => {
    setTemplates((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const updated = { ...t, active, updatedAt: Date.now() };
          if (onSaveTemplate) onSaveTemplate(updated);
          return updated;
        }
        return t;
      })
    );
  };

  const handleSaveFromDialog = async (saved: EmailTemplate) => {
    setTemplates((prev) => {
      const idx = prev.findIndex((t) => t.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });

    if (onSaveTemplate) {
      await onSaveTemplate(saved);
    }
  };

  const getCategoryColor = (cat: EmailTemplateCategory) => {
    switch (cat) {
      case "auth":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
      case "billing":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
      case "system":
        return "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20";
      case "marketing":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20";
      default:
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
    }
  };

  // SSR Fallback
  if (typeof document === "undefined") {
    return (
      <div data-testid="email-templates-manager" className={`space-y-4 ${className}`}>
        <h1>Transactional Email Templates</h1>
        <button data-testid="create-template-btn">New Template</button>
      </div>
    );
  }

  return (
    <div
      data-testid="email-templates-manager"
      className={`space-y-6 max-w-6xl mx-auto p-4 md:p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mail className="size-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Transactional Email Templates
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Manage system messages, custom branding, localized translations, and dynamic placeholder tokens.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleCreateNew}
          data-testid="create-template-btn"
          className="gap-1.5 text-xs h-9 self-start sm:self-auto"
        >
          <Plus className="size-4" />
          New Template
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat.id}
              type="button"
              variant={selectedCategory === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
              data-testid={`category-filter-${cat.id}`}
              className="text-xs h-8 whitespace-nowrap"
            >
              {cat.label}
            </Button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            data-testid="templates-search-input"
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent className="space-y-3">
            <Mail className="size-10 text-muted-foreground mx-auto stroke-1" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">No templates found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No email templates matched your search criteria. Create a new template or clear filters.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setSelectedCategory("all");
              }}
              className="text-xs h-8"
            >
              Reset Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((tpl) => (
            <Card
              key={tpl.id}
              data-testid={`template-card-${tpl.id}`}
              className={`flex flex-col justify-between transition-all hover:shadow-md ${
                !tpl.active ? "opacity-70 bg-muted/30" : ""
              }`}
            >
              <CardHeader className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] capitalize font-medium ${getCategoryColor(
                      tpl.category
                    )}`}
                  >
                    {tpl.category}
                  </Badge>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">Active</span>
                    <Switch
                      checked={tpl.active}
                      onCheckedChange={(checked) => handleToggleActive(tpl.id, checked)}
                      data-testid={`toggle-active-${tpl.id}`}
                    />
                  </div>
                </div>

                <div>
                  <CardTitle className="text-sm font-semibold text-foreground line-clamp-1">
                    {tpl.name}
                  </CardTitle>
                  <span className="text-[11px] font-mono text-muted-foreground block">
                    #{tpl.id}
                  </span>
                </div>

                {tpl.description && (
                  <CardDescription className="text-xs line-clamp-2">
                    {tpl.description}
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="p-4 pt-0 space-y-3">
                {/* Subject preview */}
                <div className="bg-muted/40 p-2 rounded text-xs space-y-0.5 border">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                    Subject:
                  </span>
                  <p className="font-medium text-foreground line-clamp-1">
                    {tpl.subject}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t text-xs">
                  <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                    {tpl.locale || "en"}
                  </Badge>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(tpl)}
                      data-testid={`edit-template-${tpl.id}`}
                      className="size-7 p-0"
                      title="Edit Template"
                    >
                      <Edit className="size-3.5" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDuplicate(tpl)}
                      data-testid={`duplicate-template-${tpl.id}`}
                      className="size-7 p-0"
                      title="Duplicate Template"
                    >
                      <Copy className="size-3.5" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(tpl.id)}
                      data-testid={`delete-template-${tpl.id}`}
                      className="size-7 p-0 text-destructive hover:text-destructive"
                      title="Delete Template"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Editor & Preview Modal Dialog */}
      {editorOpen && (
        <EmailTemplateEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          template={editingTemplate}
          layouts={layouts}
          availableTokens={availableTokens}
          onSave={handleSaveFromDialog}
          onSendTest={onSendTest}
        />
      )}
    </div>
  );
}
