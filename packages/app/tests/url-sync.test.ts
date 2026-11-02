import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  parseTableStateFromUrl,
  serializeTableStateToUrl,
  syncUrlState,
} from "../src/index.js";

describe("URL State Synchronization", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("parseTableStateFromUrl", () => {
    it("parses query strings with page, limit, sort, search, and custom filters", () => {
      const queryString = "?page=3&limit=50&sort=-createdAt&q=Acme%20Corp&status=active&category=hardware";
      const state = parseTableStateFromUrl(queryString);

      expect(state.page).toBe(3);
      expect(state.limit).toBe(50);
      expect(state.sort).toBe("-createdAt");
      expect(state.search).toBe("Acme Corp");
      expect(state.filters).toEqual({
        status: "active",
        category: "hardware",
      });
    });

    it("parses from URLSearchParams instance and handles alias 'search'", () => {
      const params = new URLSearchParams("page=1&search=test&role=admin");
      const state = parseTableStateFromUrl(params);

      expect(state.page).toBe(1);
      expect(state.search).toBe("test");
      expect(state.filters).toEqual({ role: "admin" });
    });

    it("parses from Next.js plain searchParams object", () => {
      const nextParams = {
        page: "2",
        limit: "15",
        sort: "title:asc",
        q: "Invoice",
        status: "paid",
        tag: ["urgent", "vip"],
      };

      const state = parseTableStateFromUrl(nextParams);
      expect(state.page).toBe(2);
      expect(state.limit).toBe(15);
      expect(state.sort).toBe("title:asc");
      expect(state.search).toBe("Invoice");
      expect(state.filters).toEqual({
        status: "paid",
        tag: "urgent,vip",
      });
    });

    it("ignores invalid page numbers and returns empty object on empty input", () => {
      expect(parseTableStateFromUrl("?page=-5&limit=abc")).toEqual({});
      expect(parseTableStateFromUrl("")).toEqual({});
      expect(parseTableStateFromUrl(null)).toEqual({});
    });
  });

  describe("serializeTableStateToUrl", () => {
    it("serializes table state into clean query string", () => {
      const state = {
        page: 2,
        limit: 25,
        sort: "-total",
        search: "Acme",
        filters: { status: "pending", priority: "high" },
      };

      const query = serializeTableStateToUrl(state);
      const params = new URLSearchParams(query);

      expect(params.get("page")).toBe("2");
      expect(params.get("limit")).toBe("25");
      expect(params.get("sort")).toBe("-total");
      expect(params.get("q")).toBe("Acme");
      expect(params.get("status")).toBe("pending");
      expect(params.get("priority")).toBe("high");
    });

    it("omits page=1 from the URL query to keep URLs clean", () => {
      const state = {
        page: 1,
        sort: "id",
      };

      const query = serializeTableStateToUrl(state);
      const params = new URLSearchParams(query);

      expect(params.has("page")).toBe(false);
      expect(params.get("sort")).toBe("id");
    });

    it("preserves unrelated URL query parameters when baseSearch is passed", () => {
      const base = "?tab=details&theme=dark&page=1&status=draft";
      const state = {
        page: 4,
        filters: { status: "approved" },
      };

      const query = serializeTableStateToUrl(state, base);
      const params = new URLSearchParams(query);

      expect(params.get("tab")).toBe("details");
      expect(params.get("theme")).toBe("dark");
      expect(params.get("page")).toBe("4");
      expect(params.get("status")).toBe("approved");
    });
  });

  describe("syncUrlState", () => {
    it("invokes onUrlChange and updates window.history if window exists", () => {
      const onUrlChange = vi.fn();

      // Mock window
      const pushStateSpy = vi.fn();
      vi.stubGlobal("window", {
        location: {
          pathname: "/invoices",
          search: "",
        },
        history: {
          pushState: pushStateSpy,
        },
      });

      syncUrlState({ page: 2, sort: "-date" }, { onUrlChange });

      expect(pushStateSpy).toHaveBeenCalledWith({}, "", "/invoices?page=2&sort=-date");
      expect(onUrlChange).toHaveBeenCalledWith("/invoices?page=2&sort=-date");

      vi.unstubAllGlobals();
    });
  });
});
