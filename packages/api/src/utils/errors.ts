import { ApiErrorStatus } from "../types.js";

export class ApiError extends Error {
  constructor(
    public status: ApiErrorStatus,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(message = "Bad Request", details?: any) {
    return new ApiError(400, "BAD_REQUEST", message, details);
  }

  static notFound(message = "Not Found") {
    return new ApiError(404, "NOT_FOUND", message);
  }

  static forbidden(message = "Forbidden") {
    return new ApiError(403, "FORBIDDEN", message);
  }

  static tooManyRequests(message = "Too Many Requests") {
    return new ApiError(429, "TOO_MANY_REQUESTS", message);
  }

  static internal(message = "Internal Server Error") {
    return new ApiError(500, "INTERNAL_ERROR", message);
  }
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Builds the error envelope the framework answers with.
 *
 * Every error response goes through this helper — a thrown `ApiError`, a
 * failed validation, an unexpected failure and the not-found answer for a
 * path no route handled — so the shape a client sees is the same wherever
 * the error came from.
 */
export const errorBody = (error: {
  code: string;
  message: string;
  details?: any;
}): ErrorEnvelope => ({
  success: false,
  error: {
    code: error.code,
    message: error.message,
    details: error.details,
  },
});
