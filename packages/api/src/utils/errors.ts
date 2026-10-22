import { ApiErrorStatus, StandardSchemaV1 } from "../types.js";

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

/**
 * A validation failure.
 *
 * The issues are the ones the failing schema produced, so a caller sees the
 * same detail whether the schema was written with Zod, with Valibot or by
 * hand.
 */
export class ValidationError extends Error {
  constructor(
    public issues: ReadonlyArray<StandardSchemaV1.Issue>,
    message = "Validation failed"
  ) {
    super(message);
    this.name = "ValidationError";
  }
}
