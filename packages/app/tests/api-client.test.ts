import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiClientError, createApiClient } from "../src/index.js";

describe("ApiClient", () => {
  it("normalizes trailing slashes on apiBaseUrl and builds paths", () => {
    const client = createApiClient({ apiBaseUrl: "https://api.example.com///" });
    expect(client.apiBaseUrl).toBe("https://api.example.com");
    expect(client.buildUrl("/users")).toBe("https://api.example.com/users");
    expect(client.buildUrl("users")).toBe("https://api.example.com/users");
  });

  it("injects Bearer auth, X-Tenant-Id, and Idempotency-Key headers", async () => {
    let capturedHeaders: Headers | undefined;
    let capturedUrl: string | undefined;
    let capturedMethod: string | undefined;

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method;
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ success: true, data: { id: 1 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const client = new ApiClient({
      apiBaseUrl: "https://api.example.com",
      auth: {
        type: "bearer",
        getToken: async () => "secret-token-xyz",
      },
      tenant: {
        header: "X-Tenant-Id",
        getTenantId: () => "tenant-456",
      },
      idempotency: {
        enabled: true,
        header: "Idempotency-Key",
        generateKey: () => "custom-uuid-123",
      },
      fetch: mockFetch as any,
    });

    // 1. POST request (should have all headers including Idempotency-Key)
    await client.post("/api/invoices", { total: 100 });
    expect(capturedUrl).toBe("https://api.example.com/api/invoices");
    expect(capturedMethod).toBe("POST");
    expect(capturedHeaders?.get("Authorization")).toBe("Bearer secret-token-xyz");
    expect(capturedHeaders?.get("X-Tenant-Id")).toBe("tenant-456");
    expect(capturedHeaders?.get("Idempotency-Key")).toBe("custom-uuid-123");
    expect(capturedHeaders?.get("Content-Type")).toBe("application/json");

    // 2. GET request (should have Auth and Tenant, but NOT Idempotency-Key)
    await client.get("/api/invoices");
    expect(capturedMethod).toBe("GET");
    expect(capturedHeaders?.get("Authorization")).toBe("Bearer secret-token-xyz");
    expect(capturedHeaders?.get("X-Tenant-Id")).toBe("tenant-456");
    expect(capturedHeaders?.has("Idempotency-Key")).toBe(false);
  });

  it("serializes search, filters, sorting, and pagination into URL search params", async () => {
    let capturedUrl = "";

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const client = new ApiClient({
      apiBaseUrl: "https://api.example.com",
      fetch: mockFetch as any,
    });

    await client.get("/api/invoices", {
      page: 2,
      limit: 25,
      sort: "-createdAt",
      search: "Acme Corp",
      filters: {
        status: "paid",
        category: "hardware",
      },
    });

    const parsedUrl = new URL(capturedUrl);
    expect(parsedUrl.searchParams.get("page")).toBe("2");
    expect(parsedUrl.searchParams.get("limit")).toBe("25");
    expect(parsedUrl.searchParams.get("sort")).toBe("-createdAt");
    expect(parsedUrl.searchParams.get("q")).toBe("Acme Corp");
    expect(parsedUrl.searchParams.get("status")).toBe("paid");
    expect(parsedUrl.searchParams.get("category")).toBe("hardware");
  });

  it("unwraps envelopes and parses ApiClientError on failure", async () => {
    const errorBody = {
      success: false,
      error: {
        code: "INVALID_STATUS",
        message: "Status must be draft or submitted",
        details: { field: "status" },
      },
    };

    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify(errorBody), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    });

    const client = new ApiClient({
      apiBaseUrl: "https://api.example.com",
      fetch: mockFetch as any,
    });

    try {
      await client.post("/api/invoices", { status: "invalid" });
      expect.fail("Expected ApiClientError to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiClientError);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.code).toBe("INVALID_STATUS");
      expect(apiErr.message).toBe("Status must be draft or submitted");
      expect(apiErr.details).toEqual({ field: "status" });
    }
  });
});
