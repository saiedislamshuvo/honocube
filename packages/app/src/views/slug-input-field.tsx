import React, { useState, useEffect, useRef, useCallback } from "react";
import { Lock, Unlock, RefreshCw } from "lucide-react";
import { Input, Button, cn } from "@honocube/ui";
import { slugify as defaultSlugify, type SlugInputFieldProps } from "@honocube/core";

export function SlugInputField({
  id,
  name,
  value,
  onChange,
  sourceValue,
  disabled = false,
  readOnly = false,
  placeholder = "url-friendly-slug",
  separator = "-",
  lowercase = true,
  locked: controlledLocked,
  onLockChange,
  slugify: customSlugify,
  hasError = false,
  className = "",
}: SlugInputFieldProps): React.JSX.Element {
  // If record has existing value on mount, default to locked; otherwise start unlocked
  const [internalLocked, setInternalLocked] = useState<boolean>(() => {
    if (controlledLocked !== undefined) return controlledLocked;
    return Boolean(value && String(value).trim().length > 0);
  });

  const isLocked = controlledLocked !== undefined ? controlledLocked : internalLocked;

  const setLock = useCallback(
    (nextLocked: boolean) => {
      setInternalLocked(nextLocked);
      onLockChange?.(nextLocked);
    },
    [onLockChange]
  );

  const slugifyFn = useCallback(
    (text?: string | null) => {
      if (customSlugify) return customSlugify(text || "");
      return defaultSlugify(text, { separator, lowercase });
    },
    [customSlugify, separator, lowercase]
  );

  // Track previous source value to reactively derive slug when unlocked
  const prevSourceRef = useRef<string | undefined>(sourceValue);

  useEffect(() => {
    // Only auto-derive when not locked, sourceValue exists and has changed
    if (!isLocked && !disabled && !readOnly && sourceValue !== undefined && sourceValue !== prevSourceRef.current) {
      prevSourceRef.current = sourceValue;
      const derived = slugifyFn(sourceValue);
      if (derived !== (value ?? "")) {
        onChange(derived);
      }
    } else {
      prevSourceRef.current = sourceValue;
    }
  }, [isLocked, disabled, readOnly, sourceValue, value, slugifyFn, onChange]);

  const handleManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow user typing, but slugify invalid chars
    const cleaned = slugifyFn(raw);
    // Automatically lock to preserve manual override
    if (!isLocked) {
      setLock(true);
    }
    onChange(cleaned);
  };

  const handleSync = () => {
    if (sourceValue) {
      const derived = slugifyFn(sourceValue);
      onChange(derived);
    }
  };

  const handleToggleLock = () => {
    const next = !isLocked;
    setLock(next);
    // If unlocking and sourceValue exists, sync immediately
    if (!next && sourceValue) {
      const derived = slugifyFn(sourceValue);
      onChange(derived);
    }
  };

  return (
    <div
      data-testid="slug-input-container"
      className={cn("relative flex items-center w-full", className)}
    >
      <Input
        id={id || name}
        data-testid="slug-input"
        type="text"
        value={value ?? ""}
        onChange={handleManualChange}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        className={cn(
          "font-mono text-sm pr-16 selection:bg-primary/20",
          hasError ? "border-destructive focus-visible:ring-destructive" : ""
        )}
      />

      <div className="absolute right-1 flex items-center gap-0.5">
        {/* Force regenerate / sync from source */}
        {sourceValue !== undefined && !disabled && !readOnly && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleSync}
            title="Sync slug from source title"
            data-testid="slug-sync-btn"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="sr-only">Sync from title</span>
          </Button>
        )}

        {/* Lock / Unlock Toggle Button */}
        {!disabled && !readOnly && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 transition-colors",
              isLocked
                ? "text-amber-600 dark:text-amber-400 hover:text-amber-700"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={handleToggleLock}
            title={
              isLocked
                ? "Slug is locked against auto-updates. Click to unlock."
                : "Slug is auto-derived from source. Click to lock."
            }
            data-testid="slug-lock-toggle-btn"
            data-locked={isLocked ? "true" : "false"}
          >
            {isLocked ? (
              <Lock className="h-3.5 w-3.5" />
            ) : (
              <Unlock className="h-3.5 w-3.5" />
            )}
            <span className="sr-only">
              {isLocked ? "Unlock slug" : "Lock slug"}
            </span>
          </Button>
        )}
      </div>
    </div>
  );
}
