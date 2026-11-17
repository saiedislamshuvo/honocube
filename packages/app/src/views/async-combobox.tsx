import * as React from "react";
import { Check, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from "@honocube/ui";
import {
  AppContext,
  type AsyncComboboxProps,
  type ComboboxOption,
} from "@honocube/core";

/**
 * Interactive async searchable combobox for selecting foreign keys and relations
 * from large enterprise datasets without loading all records upfront.
 */
export function AsyncCombobox({
  id,
  name,
  value,
  onChange,
  target,
  endpoint,
  valueKey = "id",
  labelKey = "name",
  subtitleKey,
  placeholder = "Select an option...",
  searchPlaceholder = "Type to search...",
  emptyText = "No options found.",
  loadingText = "Loading options...",
  disabled = false,
  readOnly = false,
  clearable = true,
  searchable = true,
  pageSize = 20,
  debounceMs = 300,
  filterParams,
  options: staticOptions,
  fetchOptions,
  resolveOption,
  className = "",
  hasError = false,
}: AsyncComboboxProps): React.JSX.Element {
  const appContext = React.useContext(AppContext);
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [optionsList, setOptionsList] = React.useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(false);
  const [totalCount, setTotalCount] = React.useState<number | undefined>(undefined);
  const [resolvedOption, setResolvedOption] = React.useState<ComboboxOption | null>(null);
  const [focusedIndex, setFocusedIndex] = React.useState(-1);

  const searchInputRef = React.useRef<HTMLInputElement | null>(null);

  // Debounce search input
  React.useEffect(() => {
    if (debounceMs <= 0) {
      setDebouncedQuery(searchQuery);
      setPage(1);
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchQuery, debounceMs]);

  // Determine currently selected option from list, static options, or resolved cache
  const selectedOption: ComboboxOption | null = React.useMemo(() => {
    if (value === undefined || value === null || value === "") {
      return null;
    }
    const strVal = String(value);

    // 1. Check in optionsList
    const inList = optionsList.find((opt) => String(opt.value) === strVal);
    if (inList) return inList;

    // 2. Check in staticOptions
    if (staticOptions) {
      const inStatic = staticOptions.find((opt) => String(opt.value) === strVal);
      if (inStatic) return inStatic;
    }

    // 3. Check resolvedOption
    if (resolvedOption && String(resolvedOption.value) === strVal) {
      return resolvedOption;
    }

    // 4. Fallback to basic representation
    return {
      value: value!,
      label: String(value),
    };
  }, [value, optionsList, staticOptions, resolvedOption]);

  // Resolve initial selected option label from remote API if only raw ID is present
  React.useEffect(() => {
    if (value === undefined || value === null || value === "") {
      setResolvedOption(null);
      return;
    }

    const strVal = String(value);
    // If already known in optionsList or staticOptions, no need to fetch
    if (optionsList.some((opt) => String(opt.value) === strVal)) return;
    if (staticOptions?.some((opt) => String(opt.value) === strVal)) return;
    if (resolvedOption && String(resolvedOption.value) === strVal && resolvedOption.label !== strVal) {
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    async function fetchSelected() {
      try {
        if (resolveOption) {
          const opt = await resolveOption(value!, controller.signal);
          if (isMounted && opt) {
            setResolvedOption(opt);
          }
          return;
        }

        if (target || endpoint) {
          const basePath = endpoint || `/api/${target}`;
          const detailPath = `${basePath}/${encodeURIComponent(strVal)}`;

          let rawData: any;
          if (appContext?.client) {
            const res = await appContext.client.get<any>(detailPath);
            rawData = res?.data ?? res;
          } else if (typeof fetch !== "undefined") {
            const res = await fetch(detailPath, { signal: controller.signal });
            if (res.ok) {
              const json = await res.json();
              rawData = json?.data ?? json;
            }
          }

          if (isMounted && rawData) {
            const opt: ComboboxOption = {
              value: value!,
              label:
                rawData[labelKey] ??
                rawData.name ??
                rawData.title ??
                rawData.label ??
                strVal,
              subtitle: subtitleKey ? String(rawData[subtitleKey] ?? "") : undefined,
              data: rawData,
            };
            setResolvedOption(opt);
          }
        }
      } catch {
        // Ignored in case of network or abort
      }
    }

    void fetchSelected();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [value, target, endpoint, labelKey, subtitleKey, resolveOption, appContext?.client, staticOptions, optionsList, resolvedOption]);

  // Main data loader function
  const loadData = React.useCallback(
    async (queryText: string, targetPage: number, append: boolean = false) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      try {
        // Mode A: Static options array provided
        if (staticOptions) {
          const filtered = staticOptions.filter((opt) => {
            if (!queryText.trim()) return true;
            const q = queryText.toLowerCase();
            return (
              opt.label.toLowerCase().includes(q) ||
              (opt.subtitle && opt.subtitle.toLowerCase().includes(q))
            );
          });

          const total = filtered.length;
          const start = 0;
          const end = targetPage * pageSize;
          const paged = filtered.slice(start, end);

          setTotalCount(total);
          setHasMore(end < total);
          setOptionsList(paged);
          return;
        }

        // Mode B: Custom fetchOptions function provided
        if (fetchOptions) {
          const result = await fetchOptions(queryText, targetPage);
          if (append) {
            setOptionsList((prev) => [...prev, ...result.options]);
          } else {
            setOptionsList(result.options);
          }
          setHasMore(Boolean(result.hasMore));
          setTotalCount(result.total);
          return;
        }

        // Mode C: Standard HonoCube API endpoint query
        if (target || endpoint) {
          const basePath = endpoint || `/api/${target}`;
          const params: Record<string, any> = {
            page: targetPage,
            limit: pageSize,
            ...filterParams,
          };
          if (queryText.trim()) {
            params.search = queryText.trim();
            params.q = queryText.trim();
          }

          let responseData: any;
          let metaData: any;

          if (appContext?.client) {
            const res = await appContext.client.get<any>(basePath, params);
            responseData = res?.data ?? res;
            metaData = res?.meta;
          } else if (typeof fetch !== "undefined") {
            const searchParams = new URLSearchParams();
            Object.entries(params).forEach(([k, v]) => {
              if (v !== undefined && v !== null) {
                searchParams.set(k, String(v));
              }
            });
            const url = `${basePath}?${searchParams.toString()}`;
            const res = await fetch(url);
            if (res.ok) {
              const json = await res.json();
              responseData = json?.data ?? json;
              metaData = json?.meta;
            }
          }

          const rawItems: any[] = Array.isArray(responseData)
            ? responseData
            : Array.isArray(responseData?.items)
            ? responseData.items
            : [];

          const mapped: ComboboxOption[] = rawItems.map((item) => {
            const itemVal = item[valueKey] ?? item.id ?? item._id;
            const itemLabel =
              item[labelKey] ??
              item.name ??
              item.title ??
              item.label ??
              String(itemVal);
            const itemSub = subtitleKey
              ? String(item[subtitleKey] ?? "")
              : item.description || item.code || item.email
              ? String(item.description || item.code || item.email)
              : undefined;

            return {
              value: itemVal,
              label: String(itemLabel),
              subtitle: itemSub,
              data: item,
            };
          });

          if (append) {
            setOptionsList((prev) => [...prev, ...mapped]);
          } else {
            setOptionsList(mapped);
          }

          const paginationMeta = metaData?.pagination;
          if (paginationMeta) {
            setTotalCount(paginationMeta.total);
            if (typeof paginationMeta.hasNext === "boolean") {
              setHasMore(paginationMeta.hasNext);
            } else if (typeof paginationMeta.total === "number") {
              setHasMore(targetPage * pageSize < paginationMeta.total);
            } else {
              setHasMore(rawItems.length >= pageSize);
            }
          } else {
            setHasMore(rawItems.length >= pageSize);
          }
        }
      } catch {
        if (!append) {
          setOptionsList([]);
        }
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [
      staticOptions,
      fetchOptions,
      target,
      endpoint,
      valueKey,
      labelKey,
      subtitleKey,
      pageSize,
      filterParams,
      appContext?.client,
    ]
  );

  // Trigger query when popover opens or debouncedQuery changes
  React.useEffect(() => {
    if (open) {
      void loadData(debouncedQuery, 1, false);
    }
  }, [open, debouncedQuery, loadData]);

  // Focus search input when popover opens
  React.useEffect(() => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
      setDebouncedQuery("");
      setFocusedIndex(-1);
    }
  }, [open]);

  // Load next page
  const handleLoadMore = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nextPage = page + 1;
    setPage(nextPage);
    void loadData(debouncedQuery, nextPage, true);
  };

  const handleSelect = (option: ComboboxOption) => {
    if (option.disabled || disabled || readOnly) return;
    onChange(option.value, option);
    setResolvedOption(option);
    setOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (disabled || readOnly) return;
    onChange(null, null);
    setResolvedOption(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || readOnly) return;

    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < optionsList.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < optionsList.length) {
        const item = optionsList[focusedIndex];
        if (item) handleSelect(item);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const isDisabled = disabled || readOnly;
  const isSelected = value !== undefined && value !== null && value !== "";

  return (
    <div className={cn("relative w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            name={name}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            disabled={isDisabled}
            data-testid="async-combobox-trigger"
            onKeyDown={handleKeyDown}
            className={cn(
              "w-full justify-between font-normal text-left h-10 px-3",
              !isSelected && "text-muted-foreground",
              hasError && "border-destructive text-destructive focus:ring-destructive",
              readOnly && "cursor-default bg-muted"
            )}
          >
            <span className="truncate flex-1 mr-2 flex items-center gap-1.5">
              {selectedOption ? (
                <>
                  <span className="text-foreground font-medium truncate">
                    {selectedOption.label}
                  </span>
                  {selectedOption.subtitle && (
                    <span className="text-xs text-muted-foreground truncate">
                      ({selectedOption.subtitle})
                    </span>
                  )}
                </>
              ) : (
                <span>{placeholder}</span>
              )}
            </span>

            <div className="flex items-center gap-1 shrink-0">
              {isLoading && (
                <Loader2
                  data-testid="async-combobox-spinner"
                  className="h-3.5 w-3.5 animate-spin text-muted-foreground"
                />
              )}

              {clearable && isSelected && !isDisabled && (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Clear selection"
                  data-testid="async-combobox-clear"
                  onClick={handleClear}
                  className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0 shadow-md"
        >
          {searchable && (
            <div className="flex items-center border-b px-3 py-2">
              <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                data-testid="async-combobox-search"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          <div
            role="listbox"
            tabIndex={-1}
            data-testid="async-combobox-options-list"
            className="max-h-60 overflow-y-auto p-1"
          >
            {isLoading && optionsList.length === 0 ? (
              <div
                data-testid="async-combobox-loading"
                className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
              >
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>{loadingText}</span>
              </div>
            ) : optionsList.length === 0 ? (
              <div
                data-testid="async-combobox-empty"
                className="py-6 text-center text-sm text-muted-foreground"
              >
                {searchQuery ? `No results found for "${searchQuery}"` : emptyText}
              </div>
            ) : (
              optionsList.map((opt, idx) => {
                const optIsSelected =
                  value !== undefined &&
                  value !== null &&
                  String(opt.value) === String(value);
                const isFocused = idx === focusedIndex;

                return (
                  <div
                    key={`${opt.value}-${idx}`}
                    role="option"
                    aria-selected={optIsSelected}
                    data-testid="async-combobox-item"
                    data-value={String(opt.value)}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center justify-between rounded-sm px-2.5 py-1.5 text-sm outline-none transition-colors",
                      optIsSelected
                        ? "bg-accent text-accent-foreground font-medium"
                        : "hover:bg-muted/80 text-foreground",
                      isFocused && "ring-1 ring-ring",
                      opt.disabled && "pointer-events-none opacity-50"
                    )}
                    onClick={() => handleSelect(opt)}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="truncate">{opt.label}</span>
                      {opt.subtitle && (
                        <span className="text-xs text-muted-foreground truncate">
                          {opt.subtitle}
                        </span>
                      )}
                    </div>
                    {optIsSelected && (
                      <Check className="h-4 w-4 shrink-0 text-primary ml-2" />
                    )}
                  </div>
                );
              })
            )}

            {hasMore && (
              <div className="p-1 border-t mt-1">
                <button
                  type="button"
                  data-testid="async-combobox-load-more"
                  disabled={isLoadingMore}
                  onClick={handleLoadMore}
                  className="w-full text-center py-1.5 text-xs font-medium text-primary hover:bg-muted rounded-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Loading more...</span>
                    </>
                  ) : (
                    <span>
                      {totalCount !== undefined
                        ? `Showing ${optionsList.length} of ${totalCount} • Load more`
                        : "Load more options"}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
