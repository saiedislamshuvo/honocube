import { describe, it, expect } from "vitest";
import { ApiError, errorBody, ValidationError } from "../../src/utils/errors.js";

describe("ApiError and errorBody", () => {
  it("creates ApiError instances using static factory methods", () => {
    // 1. badRequest
    const badReq = ApiError.badRequest("Invalid input", { field: "title" });
    expect(badReq).toBeInstanceOf(Error);
    expect(badReq).toBeInstanceOf(ApiError);
    expect(badReq.name).toBe("ApiError");
    expect(badReq.status).toBe(400);
    expect(badReq.code).toBe("BAD_REQUEST");
    expect(badReq.message).toBe("Invalid input");
    expect(badReq.details).toEqual({ field: "title" });

    const defaultBadReq = ApiError.badRequest();
    expect(defaultBadReq.message).toBe("Bad Request");
    expect(defaultBadReq.details).toBeUndefined();

    // 2. notFound
    const notFound = ApiError.notFound("Resource not found");
    expect(notFound.status).toBe(404);
    expect(notFound.code).toBe("NOT_FOUND");
    expect(notFound.message).toBe("Resource not found");

    const defaultNotFound = ApiError.notFound();
    expect(defaultNotFound.message).toBe("Not Found");

    // 3. forbidden
    const forbidden = ApiError.forbidden("Access denied");
    expect(forbidden.status).toBe(403);
    expect(forbidden.code).toBe("FORBIDDEN");
    expect(forbidden.message).toBe("Access denied");

    const defaultForbidden = ApiError.forbidden();
    expect(defaultForbidden.message).toBe("Forbidden");

    // 4. tooManyRequests
    const rateLimit = ApiError.tooManyRequests("Rate limit reached");
    expect(rateLimit.status).toBe(429);
    expect(rateLimit.code).toBe("TOO_MANY_REQUESTS");
    expect(rateLimit.message).toBe("Rate limit reached");

    const defaultRateLimit = ApiError.tooManyRequests();
    expect(defaultRateLimit.message).toBe("Too Many Requests");

    // 5. internal
    const internal = ApiError.internal("Database crash");
    expect(internal.status).toBe(500);
    expect(internal.code).toBe("INTERNAL_ERROR");
    expect(internal.message).toBe("Database crash");

    const defaultInternal = ApiError.internal();
    expect(defaultInternal.message).toBe("Internal Server Error");

    // 6. Direct construction with custom status code
    const custom = new ApiError(418, "TEAPOT", "I am a teapot", { brew: "green" });
    expect(custom.status).toBe(418);
    expect(custom.code).toBe("TEAPOT");
    expect(custom.message).toBe("I am a teapot");
    expect(custom.details).toEqual({ brew: "green" });
  });

  it("formats error envelopes using errorBody", () => {
    const envelope = errorBody({
      code: "SAMPLE_ERROR",
      message: "Something went wrong",
      details: { extra: 123 },
    });

    expect(envelope).toEqual({
      success: false,
      error: {
        code: "SAMPLE_ERROR",
        message: "Something went wrong",
        details: { extra: 123 },
      },
    });

    const envelopeWithoutDetails = errorBody({
      code: "NO_DETAILS",
      message: "No details provided",
    });

    expect(envelopeWithoutDetails).toEqual({
      success: false,
      error: {
        code: "NO_DETAILS",
        message: "No details provided",
        details: undefined,
      },
    });
  });

  it("creates ValidationError with standard schema issues", () => {
    const issues = [
      {
        message: "String must contain at least 1 character(s)",
        path: ["title"],
      },
    ];

    const valErr = new ValidationError(issues);
    expect(valErr).toBeInstanceOf(Error);
    expect(valErr).toBeInstanceOf(ValidationError);
    expect(valErr.name).toBe("ValidationError");
    expect(valErr.message).toBe("Validation failed");
    expect(valErr.issues).toEqual(issues);

    const customValErr = new ValidationError(issues, "Custom validation failure");
    expect(customValErr.message).toBe("Custom validation failure");
    expect(customValErr.issues).toBe(issues);
  });
});
