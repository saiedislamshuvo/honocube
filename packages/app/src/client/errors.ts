export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: any;
  readonly headers?: Headers;

  constructor(status: number, code: string, message: string, details?: any, headers?: Headers) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.headers = headers;
  }

  static fromResponse(status: number, data: any, headers?: Headers): ApiClientError {
    if (data && typeof data === "object" && data.error && typeof data.error === "object") {
      const code = data.error.code || "API_ERROR";
      const message = data.error.message || `Request failed with status ${status}`;
      return new ApiClientError(status, code, message, data.error.details, headers);
    }
    const message = typeof data === "string" ? data : `Request failed with status ${status}`;
    return new ApiClientError(status, "HTTP_ERROR", message, undefined, headers);
  }
}
