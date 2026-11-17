import * as React from "react";
import { useState, useMemo } from "react";
import { Code2, Search, Check } from "lucide-react";
import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Badge,
} from "@honocube/ui";
import {
  STANDARD_EMAIL_TOKENS,
  type TokenPickerProps,
  type EmailTokenDefinition,
} from "@honocube/core";

/**
 * Interactive Token Picker Popover.
 * Allows administrators to search, browse, and insert dynamic tokens
 * into subject lines, preheaders, or HTML bodies.
 */
export function TokenPicker({
  tokens = STANDARD_EMAIL_TOKENS,
  onSelectToken,
  className = "",
  buttonLabel = "Insert Token",
}: TokenPickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Filter tokens based on search
  const filteredTokens = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tokens;
    return tokens.filter(
      (t) =>
        t.token.toLowerCase().includes(q) ||
        t.label.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
    );
  }, [tokens, search]);

  // Group by category
  const groupedTokens = useMemo(() => {
    const groups: Record<string, EmailTokenDefinition[]> = {};
    for (const t of filteredTokens) {
      const cat = t.category || "General";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    }
    return groups;
  }, [filteredTokens]);

  const handleSelect = (token: string) => {
    onSelectToken(token);
    setCopiedToken(token);
    setTimeout(() => {
      setCopiedToken(null);
      setOpen(false);
    }, 250);
  };

  // SSR Fallback
  if (typeof document === "undefined") {
    return (
      <div data-testid="token-picker" className={`inline-block ${className}`}>
        <button data-testid="token-picker-trigger">{buttonLabel}</button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="token-picker-trigger"
          className={`h-8 gap-1.5 text-xs font-mono font-medium ${className}`}
        >
          <Code2 className="size-3.5 text-primary" />
          <span>{buttonLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        data-testid="token-picker-popover"
        className="w-80 p-0 shadow-lg"
        align="start"
      >
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dynamic tokens..."
              className="h-8 pl-8 text-xs"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto p-1.5 space-y-3">
          {Object.keys(groupedTokens).length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">
              No matching tokens found.
            </p>
          ) : (
            Object.entries(groupedTokens).map(([category, catTokens]) => (
              <div key={category} className="space-y-1">
                <div className="px-2 py-0.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {category}
                </div>
                <div className="space-y-0.5">
                  {catTokens.map((t) => {
                    const isSelected = copiedToken === t.token;
                    return (
                      <button
                        key={t.token}
                        type="button"
                        data-testid={`token-option-${t.token}`}
                        onClick={() => handleSelect(t.token)}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground ${
                          isSelected ? "bg-primary/10 text-primary font-medium" : ""
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-foreground truncate">
                              {t.label}
                            </span>
                            {t.sampleValue !== undefined && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1 py-0 h-4 font-normal text-muted-foreground"
                              >
                                {String(t.sampleValue)}
                              </Badge>
                            )}
                          </div>
                          <span className="font-mono text-[11px] text-muted-foreground block truncate">
                            {`{{${t.token}}}`}
                          </span>
                        </div>
                        {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
