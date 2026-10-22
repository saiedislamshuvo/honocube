import { StandardSchemaV1 } from "../types.js";
import { ValidationError } from "../utils/errors.js";

/**
 * A validator that follows the Standard Schema protocol.
 *
 * Zod 3.25+, Zod 4, Valibot and ArkType all produce schemas of this shape.
 */
export type Validator = StandardSchemaV1<any, any>;

/**
 * Checks whether a value implements the Standard Schema protocol.
 *
 * The check is on the protocol and not on the constructor: `instanceof`
 * compares constructor identity, so a schema built by a *second copy* of the
 * same library would not be recognised — and the framework would then skip
 * validation altogether.
 */
export function isStandardSchema(value: unknown): value is Validator {
  return (
    typeof value === "object" &&
    value !== null &&
    "~standard" in value &&
    typeof (value as any)["~standard"]?.validate === "function"
  );
}

/**
 * Runs a validator and returns the validated value.
 *
 * A rejected input is reported as a `ValidationError` carrying the issues of
 * the schema, which the framework turns into the `VALIDATION_ERROR`
 * response.
 */
export async function validateWith<T = any>(schema: Validator, input: unknown): Promise<T> {
  const result = await schema["~standard"].validate(input);
  if (result.issues) {
    throw new ValidationError(result.issues);
  }
  return result.value as T;
}

/**
 * The update path validates a partial payload.
 *
 * A Zod schema can produce a partial of itself. A schema from another
 * library cannot, so it is used as it is and the resource is expected to
 * declare a separate update schema.
 */
export function partialValidator(schema: Validator): Validator {
  if (typeof (schema as any).partial === "function") {
    return (schema as any).partial();
  }
  return schema;
}

/**
 * Resolves the create and the update validator of a resource.
 *
 * A resource may declare a single schema, a `[create, update]` pair, or an
 * object with a `create` and an `update` schema.
 */
export function resolveValidators(validator: any): { create: Validator; update: Validator } {
  if (Array.isArray(validator)) {
    return {
      create: validator[0],
      update: validator[1] ?? partialValidator(validator[0]),
    };
  }

  if (isStandardSchema(validator)) {
    return { create: validator, update: partialValidator(validator) };
  }

  const create = validator.create;
  const update = validator.update ?? partialValidator(create);
  return { create, update };
}

/**
 * Reads the `ids` of a batch body.
 *
 * The framework validates the shape of a batch body itself, so it does not
 * need a validation library to do it.
 */
function parseIds(body: unknown): (string | number)[] {
  const issues: StandardSchemaV1.Issue[] = [];

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ValidationError([{ message: "Expected an object with an 'ids' array" }]);
  }

  const ids = (body as { ids?: unknown }).ids;

  if (!Array.isArray(ids) || ids.length === 0) {
    issues.push({ message: "Expected a non-empty array of ids", path: ["ids"] });
  } else {
    ids.forEach((id, index) => {
      if (typeof id !== "string" && typeof id !== "number") {
        issues.push({ message: "Expected a string or a number", path: ["ids", index] });
      }
    });
  }

  if (issues.length > 0) {
    throw new ValidationError(issues);
  }

  return ids as (string | number)[];
}

/**
 * The body of a batch update: the rows to change and the data to apply.
 * The data itself is validated by the update validator of the resource.
 */
export function parseBatchUpdateBody(body: unknown): { ids: (string | number)[]; data: any } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ValidationError([{ message: "Expected an object with 'ids' and 'data'" }]);
  }
  return { ids: parseIds(body), data: (body as { data?: unknown }).data };
}

/**
 * The body of a batch delete: the rows to delete.
 */
export function parseBatchDeleteBody(body: unknown): { ids: (string | number)[] } {
  return { ids: parseIds(body) };
}
