import type { TableUrlState } from "./types.js";

const RESERVED_KEYS = new Set([
  "page",
  "limit",
  "sort",
  "order",
  "q",
  "search",
  "cursor",
  "after",
  "before",
  "direction",
]);

export function parseTableStateFromUrl(
  input?: URLSearchParams | string | Record<string, string | string[] | undefined> | null
): TableUrlState {
  if (!input) return {};

  let searchParams: URLSearchParams;

  if (input instanceof URLSearchParams) {
    searchParams = input;
  } else if (typeof input === "string") {
    const query = input.includes("?") ? input.split("?")[1] || "" : input;
    searchParams = new URLSearchParams(query);
  } else if (typeof input === "object") {
    searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(input)) {
      if (val !== undefined && val !== null) {
        if (Array.isArray(val)) {
          searchParams.set(key, val.join(","));
        } else {
          searchParams.set(key, String(val));
        }
      }
    }
  } else {
    return {};
  }

  const state: TableUrlState = {};

  const pageVal = searchParams.get("page");
  if (pageVal) {
    const parsedPage = parseInt(pageVal, 10);
    if (!Number.isNaN(parsedPage) && parsedPage > 0) {
      state.page = parsedPage;
    }
  }

  const limitVal = searchParams.get("limit");
  if (limitVal) {
    const parsedLimit = parseInt(limitVal, 10);
    if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
      state.limit = parsedLimit;
    }
  }

  const sortVal = searchParams.get("sort");
  if (sortVal) {
    state.sort = sortVal;
  }

  const searchVal = searchParams.get("q") || searchParams.get("search");
  if (searchVal) {
    state.search = searchVal;
  }

  const filters: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (!RESERVED_KEYS.has(key) && value !== "") {
      filters[key] = value;
    }
  });

  if (Object.keys(filters).length > 0) {
    state.filters = filters;
  }

  return state;
}

export function serializeTableStateToUrl(
  state: TableUrlState,
  baseSearch?: string | URLSearchParams
): string {
  const params =
    baseSearch instanceof URLSearchParams
      ? new URLSearchParams(baseSearch.toString())
      : new URLSearchParams(baseSearch ? (baseSearch.startsWith("?") ? baseSearch.slice(1) : baseSearch) : "");

  // Update or delete pagination
  if (state.page && state.page > 1) {
    params.set("page", String(state.page));
  } else {
    params.delete("page");
  }

  if (state.limit) {
    params.set("limit", String(state.limit));
  } else {
    params.delete("limit");
  }

  // Update or delete sorting
  if (state.sort) {
    params.set("sort", state.sort);
  } else {
    params.delete("sort");
  }

  // Update or delete search query
  if (state.search && state.search.trim() !== "") {
    params.set("q", state.search.trim());
    params.delete("search");
  } else {
    params.delete("q");
    params.delete("search");
  }

  // Set active filters
  if (state.filters) {
    for (const [key, value] of Object.entries(state.filters)) {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export function syncUrlState(
  state: TableUrlState,
  options?: { onUrlChange?: (url: string) => void }
): void {
  if (typeof window === "undefined") return;

  const newQuery = serializeTableStateToUrl(state, window.location.search);
  const newUrl = `${window.location.pathname}${newQuery}`;

  if (window.location.search !== newQuery) {
    window.history.pushState({}, "", newUrl);
    if (options?.onUrlChange) {
      options.onUrlChange(newUrl);
    }
  }
}
