import React, { useState, useMemo } from "react";
import {
  Tag,
  Folder,
  FileText,
  CheckCircle,
  AlertCircle,
  Calendar,
  Clock,
  User,
  Users,
  Settings,
  Mail,
  Phone,
  Globe,
  Shield,
  Star,
  Heart,
  Bookmark,
  Bell,
  CreditCard,
  Package,
  Truck,
  Database,
  Key,
  Lock,
  DollarSign,
  Activity,
  BarChart,
  Layers,
  Zap,
  Home,
  Briefcase,
  Award,
  Archive,
  HelpCircle,
  Send,
  Share2,
  ShoppingBag,
  Printer,
  Search,
  Compass,
  ChevronDown,
  X,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button,
  Input,
  cn,
} from "@honocube/ui";
import type { IconPickerFieldProps } from "@honocube/core";

export const DEFAULT_ICON_REGISTRY: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  tag: Tag,
  folder: Folder,
  file: FileText,
  "check-circle": CheckCircle,
  "alert-circle": AlertCircle,
  calendar: Calendar,
  clock: Clock,
  user: User,
  users: Users,
  settings: Settings,
  mail: Mail,
  phone: Phone,
  globe: Globe,
  shield: Shield,
  star: Star,
  heart: Heart,
  bookmark: Bookmark,
  bell: Bell,
  "credit-card": CreditCard,
  package: Package,
  truck: Truck,
  database: Database,
  key: Key,
  lock: Lock,
  "dollar-sign": DollarSign,
  activity: Activity,
  "bar-chart": BarChart,
  layers: Layers,
  zap: Zap,
  home: Home,
  briefcase: Briefcase,
  award: Award,
  archive: Archive,
  "help-circle": HelpCircle,
  send: Send,
  share: Share2,
  "shopping-bag": ShoppingBag,
  printer: Printer,
  search: Search,
  compass: Compass,
};

export function IconPickerField({
  id,
  name,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  placeholder = "Select icon...",
  icons,
  hasError = false,
  className = "",
}: IconPickerFieldProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedKey = (value || "").toLowerCase().replace(/^lucide:/, "");
  const SelectedIcon = DEFAULT_ICON_REGISTRY[selectedKey];

  const availableIcons = useMemo(() => {
    const keys = icons || Object.keys(DEFAULT_ICON_REGISTRY);
    if (!searchQuery.trim()) return keys;
    const q = searchQuery.toLowerCase().trim();
    return keys.filter((key) => key.toLowerCase().includes(q));
  }, [icons, searchQuery]);

  const handleSelect = (key: string) => {
    onChange(key);
    setOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div
      data-testid="icon-picker-container"
      className={cn("w-full relative", className)}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            id={id || name}
            variant="outline"
            disabled={disabled || readOnly}
            data-testid="icon-picker-trigger"
            className={cn(
              "w-full justify-between font-normal h-9 px-3",
              !value ? "text-muted-foreground" : "text-foreground",
              hasError ? "border-destructive focus:ring-destructive" : ""
            )}
          >
            <div className="flex items-center gap-2 truncate">
              {SelectedIcon ? (
                <SelectedIcon className="h-4 w-4 shrink-0 text-primary" />
              ) : (
                <div className="h-4 w-4 rounded border border-dashed border-muted-foreground/40 shrink-0" />
              )}
              <span className="truncate">{value || placeholder}</span>
            </div>

            <div className="flex items-center gap-1 shrink-0 ml-2">
              {value && !disabled && !readOnly && (
                <button
                  type="button"
                  data-testid="icon-clear-btn"
                  onClick={handleClear}
                  className="rounded-full p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Clear icon"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Clear icon</span>
                </button>
              )}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          data-testid="icon-picker-popover"
          align="start"
          className="w-72 p-3 space-y-3"
        >
          {/* Search filter input */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="icon-search-input"
              type="text"
              placeholder="Search icons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          {/* Grid of icons */}
          <div className="grid grid-cols-6 gap-1 max-h-56 overflow-y-auto p-0.5">
            {availableIcons.map((iconKey) => {
              const IconComp = DEFAULT_ICON_REGISTRY[iconKey] || Tag;
              const isSelected = selectedKey === iconKey.toLowerCase();
              return (
                <button
                  key={iconKey}
                  type="button"
                  data-testid={`icon-option-${iconKey}`}
                  onClick={() => handleSelect(iconKey)}
                  title={iconKey}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-ring",
                    isSelected
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <IconComp className="h-4 w-4" />
                </button>
              );
            })}

            {availableIcons.length === 0 && (
              <div className="col-span-6 py-4 text-center text-xs text-muted-foreground">
                No icons found matching &quot;{searchQuery}&quot;
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
