import type { AppConfig, AppInstance } from "../types/app.js";
import { ApiClientError } from "./errors.js";

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
  after?: string;
  before?: string;
}

export interface QueryParams extends PaginationParams, Record<string, unknown> {
  sort?: string;
  order?: "asc" | "desc";
  search?: string;
  q?: string;
  filters?: Record<string, unknown>;
}

export interface PaginationMeta {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
  nextCursor?: string;
  prevCursor?: string;
  [key: string]: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  meta?: {
    pagination?: PaginationMeta;
    [key: string]: unknown;
  };
}

export interface ApiClientOptions {
  apiBaseUrl: string;
  auth?: AppConfig["auth"];
  tenant?: AppConfig["tenant"];
  idempotency?: AppConfig["idempotency"];
  fetch?: typeof fetch;
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: QueryParams;
}

export class ApiClient {
  readonly apiBaseUrl: string;
  readonly auth?: AppConfig["auth"];
  readonly tenant?: AppConfig["tenant"];
  readonly idempotency?: AppConfig["idempotency"];
  private customFetch: typeof fetch;

  constructor(options: ApiClientOptions | AppInstance | AppConfig) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/+$/, "");
    this.auth = options.auth;
    this.tenant = options.tenant;
    this.idempotency = options.idempotency;
    this.customFetch = "fetch" in options && options.fetch ? options.fetch : globalThis.fetch.bind(globalThis);
  }

  private async buildHeaders(method: string, customHeaders?: HeadersInit): Promise<Headers> {
    const headers = new Headers(customHeaders);

    // 1. Bearer Token Auth
    if (this.auth?.type === "bearer" && typeof this.auth.getToken === "function") {
      const token = await this.auth.getToken();
      if (token) {
        const headerName = this.auth.headerName || "Authorization";
        const prefix = this.auth.tokenPrefix ?? "Bearer ";
        headers.set(headerName, `${prefix}${token}`);
      }
    }

    // 2. Multi-Tenancy / Workspace Isolation
    if (typeof this.tenant?.getTenantId === "function") {
      const tenantId = await this.tenant.getTenantId();
      if (tenantId) {
        const headerName = this.tenant.header || "X-Tenant-Id";
        headers.set(headerName, tenantId);
      }
    }

    // 3. Mutation Idempotency
    const isMutation = ["POST", "PATCH", "DELETE", "PUT"].includes(method.toUpperCase());
    if (isMutation && this.idempotency?.enabled !== false) {
      const headerName = this.idempotency?.header || "Idempotency-Key";
      if (!headers.has(headerName)) {
        const key = this.idempotency?.generateKey
          ? this.idempotency.generateKey()
          : typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2) + Date.now().toString(36);
        headers.set(headerName, key);
      }
    }

    return headers;
  }

  buildUrl(path: string, params?: QueryParams): string {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const normalizedPath =
      this.apiBaseUrl.replace(/\/+$/, "").endsWith("/api") && cleanPath.startsWith("/api/")
        ? cleanPath.slice(4)
        : cleanPath;
    const isAbsolute = this.apiBaseUrl.startsWith("http://") || this.apiBaseUrl.startsWith("https://");
    const base = isAbsolute
      ? this.apiBaseUrl.replace(/\/+$/, "")
      : typeof window !== "undefined" && window.location?.origin
      ? String(window.location.origin) + (this.apiBaseUrl ? "/" + this.apiBaseUrl.replace(/^\/+|\/+$/g, "") : "")
      : "http://localhost" + (this.apiBaseUrl ? "/" + this.apiBaseUrl.replace(/^\/+|\/+$/g, "") : "");
    const url = new URL(base + normalizedPath);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;

        if (key === "filters" && typeof value === "object" && !Array.isArray(value)) {
          for (const [fKey, fVal] of Object.entries(value as Record<string, unknown>)) {
            if (fVal !== undefined && fVal !== null) {
              url.searchParams.set(fKey, String(fVal));
            }
          }
        } else if (key === "search" || key === "q") {
          url.searchParams.set("q", String(value));
        } else if (Array.isArray(value)) {
          url.searchParams.set(key, value.join(","));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return isAbsolute ? url.toString() : `${url.pathname}${url.search}`;
  }

  async request<T = unknown>(
    path: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const { params, headers: customHeaders, body, method = "GET", ...rest } = options;
    const url = this.buildUrl(path, params);
    const headers = await this.buildHeaders(method, customHeaders);

    let finalBody: BodyInit | undefined = undefined;
    if (body !== undefined && body !== null) {
      if (typeof body === "string" || body instanceof FormData || body instanceof Blob) {
        finalBody = body;
      } else {
        if (!headers.has("Content-Type")) {
          headers.set("Content-Type", "application/json");
        }
        finalBody = JSON.stringify(body);
      }
    }

    const response = await this.customFetch(url, {
      ...rest,
      method,
      headers,
      body: finalBody,
    });

    const isJson = response.headers.get("content-type")?.includes("application/json");
    let responseData: any = null;

    if (isJson) {
      try {
        responseData = await response.json();
      } catch {
        responseData = null;
      }
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      throw ApiClientError.fromResponse(response.status, responseData, response.headers);
    }

    if (responseData && typeof responseData === "object" && "success" in responseData) {
      return responseData as ApiResponse<T>;
    }

    return {
      success: true,
      data: responseData as T,
    };
  }

  get<T = unknown>(path: string, params?: QueryParams, init?: Omit<RequestOptions, "params" | "method">): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...init, method: "GET", params });
  }

  post<T = unknown>(path: string, body?: unknown, init?: Omit<RequestOptions, "body" | "method">): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...init, method: "POST", body });
  }

  patch<T = unknown>(path: string, body?: unknown, init?: Omit<RequestOptions, "body" | "method">): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...init, method: "PATCH", body });
  }

  delete<T = unknown>(path: string, init?: Omit<RequestOptions, "method">): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...init, method: "DELETE" });
  }
}

export function createApiClient(options: ApiClientOptions | AppInstance | AppConfig): ApiClient {
  return new ApiClient(options);
}
