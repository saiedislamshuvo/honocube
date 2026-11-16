import React, { useState, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { Badge, cn } from "@honocube/ui";
import type { TagsInputFieldProps } from "@honocube/core";

export function TagsInputField({
  id,
  name,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  placeholder = "Add tag...",
  maxTags,
  suggestions,
  delimiters = [",", "Enter"],
  allowDuplicates = false,
  hasError = false,
  className = "",
}: TagsInputFieldProps): React.JSX.Element {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Normalize incoming value to string[]
  const tags: string[] = React.useMemo(() => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Fallback for comma-separated string
        return value.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
    return [];
  }, [value]);

  const addTag = useCallback(
    (rawText: string) => {
      const text = rawText.trim();
      if (!text) return;

      if (!allowDuplicates && tags.some((t) => t.toLowerCase() === text.toLowerCase())) {
        setInputValue("");
        return;
      }

      if (maxTags !== undefined && tags.length >= maxTags) {
        return;
      }

      onChange([...tags, text]);
      setInputValue("");
    },
    [allowDuplicates, maxTags, onChange, tags]
  );

  const removeTag = useCallback(
    (indexToRemove: number) => {
      if (disabled || readOnly) return;
      onChange(tags.filter((_, idx) => idx !== indexToRemove));
    },
    [disabled, readOnly, onChange, tags]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (delimiters.includes(e.key) || (e.key === "Enter" && !e.shiftKey)) {
      e.preventDefault();
      addTag(inputValue);
      return;
    }

    if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    if (!pasted) return;

    // Split pasted string by comma or newline
    const tokens = pasted
      .split(/[\n\r,]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (tokens.length === 0) return;

    const nextTags = [...tags];
    for (const token of tokens) {
      if (!allowDuplicates && nextTags.some((t) => t.toLowerCase() === token.toLowerCase())) {
        continue;
      }
      if (maxTags !== undefined && nextTags.length >= maxTags) {
        break;
      }
      nextTags.push(token);
    }

    onChange(nextTags);
    setInputValue("");
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  const isLimitReached = maxTags !== undefined && tags.length >= maxTags;

  // Filtered suggestions for autocomplete chip suggestions
  const availableSuggestions = React.useMemo(() => {
    if (!suggestions || suggestions.length === 0) return [];
    return suggestions.filter(
      (s) =>
        (!tags.includes(s) || allowDuplicates) &&
        (!inputValue || s.toLowerCase().includes(inputValue.toLowerCase()))
    );
  }, [suggestions, tags, allowDuplicates, inputValue]);

  return (
    <div className="w-full space-y-2">
      <div
        data-testid="tags-input-container"
        onClick={handleContainerClick}
        className={cn(
          "flex min-h-[38px] w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background transition-colors",
          hasError ? "border-destructive focus-within:ring-1 focus-within:ring-destructive" : "focus-within:ring-1 focus-within:ring-ring",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-text",
          className
        )}
      >
        {/* Active Tag Badges */}
        {tags.map((tag, idx) => (
          <Badge
            key={`${tag}-${idx}`}
            variant="secondary"
            data-testid={`tag-badge-${idx}`}
            className="flex items-center gap-1 py-0.5 px-2 text-xs font-normal max-w-full truncate"
          >
            <span className="truncate">{tag}</span>
            {!disabled && !readOnly && (
              <button
                type="button"
                data-testid={`remove-tag-btn-${idx}`}
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(idx);
                }}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-colors"
                title={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
                <span className="sr-only">Remove {tag}</span>
              </button>
            )}
          </Badge>
        ))}

        {/* Inline Input Field */}
        {!isLimitReached && !disabled && !readOnly && (
          <input
            ref={inputRef}
            id={id || name}
            data-testid="tags-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onBlur={() => {
              if (inputValue.trim()) {
                addTag(inputValue);
              }
            }}
            placeholder={tags.length === 0 ? placeholder : ""}
            disabled={disabled}
            readOnly={readOnly}
            className="flex-1 bg-transparent border-0 outline-none p-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-0 min-w-[90px]"
          />
        )}
      </div>

      {/* Suggested Chips (if provided) */}
      {availableSuggestions.length > 0 && !isLimitReached && !disabled && !readOnly && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs text-muted-foreground">Suggestions:</span>
          {availableSuggestions.slice(0, 6).map((item) => (
            <button
              key={item}
              type="button"
              data-testid={`suggestion-chip-${item}`}
              onClick={() => addTag(item)}
              className="inline-flex items-center rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-solid hover:bg-accent transition-colors"
            >
              + {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
