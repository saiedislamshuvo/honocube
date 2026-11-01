export interface TestResourceFixtures<TInsert = any> {
  /**
   * A valid payload used to test record creation (POST /).
   */
  valid: TInsert;
  /**
   * Partial payload used to test record updating (PATCH /:id).
   */
  update: Partial<TInsert>;
  /**
   * An invalid payload that should fail schema validation (POST /).
   * If omitted, an empty object `{}` will be used by default.
   */
  invalid?: unknown;
  /**
   * Optional pre-existing record ID to use for detail/update/delete testing
   * (useful for read-only resources where create is disabled).
   */
  existingId?: string | number;
}

export interface TestResourceParams<TInsert = any, TSelect = any> {
  /**
   * Fixtures for testing creation, updating, and schema failure.
   */
  fixtures: TestResourceFixtures<TInsert>;

  /**
   * Optional request headers to include on requests (e.g. Authorization).
   */
  headers?: Record<string, string>;

  /**
   * Optional context variables injected into request environment (c.env).
   */
  context?: Record<string, unknown>;

  /**
   * Optional search test parameters.
   */
  search?: {
    query: string;
    /** If specified, verifies that the search results contain this match */
    expectedMatch?: (record: TSelect) => boolean;
  };

  /**
   * Optional filter test parameters.
   */
  filter?: {
    query: Record<string, string | number | boolean>;
    /** If specified, verifies that filtered results match expectation */
    expectedMatch?: (record: TSelect) => boolean;
  };

  /**
   * Optional batch operations configuration.
   */
  batch?: {
    updateData: Partial<TInsert>;
  };

  /**
   * Optional relations payload for testing nested relation creation.
   */
  relations?: {
    many?: Record<string, any[]>;
    pivots?: Record<string, any[]>;
  };

  /**
   * Optional slug lookup test parameter.
   */
  slug?: {
    field: string;
    value: string;
  };

  /**
   * Optional authorization tests:
   * When provided, verifies that requests with unauthorizedHeaders return 403 Forbidden.
   */
  auth?: {
    unauthorizedHeaders?: Record<string, string>;
    unauthorizedContext?: Record<string, unknown>;
  };

  /**
   * Optional test framework hooks if global `describe`, `it`, `expect` are not in global scope.
   */
  suite?: {
    describe?: (name: string, fn: () => void) => void;
    it?: (name: string, fn: () => Promise<void> | void) => void;
    expect?: any;
  };
}

export interface TestAppParams {
  /**
   * Map of resource path or name to its test parameters.
   */
  resources: Record<string, TestResourceParams>;

  /**
   * Optional API version prefix (e.g. "v1") if not inferred from defineApi.
   */
  version?: string;

  /**
   * Global headers to include on all requests.
   */
  headers?: Record<string, string>;

  /**
   * Global context to inject into request environment (c.env).
   */
  context?: Record<string, unknown>;

  /**
   * Optional test framework hooks.
   */
  suite?: {
    describe?: (name: string, fn: () => void) => void;
    it?: (name: string, fn: () => Promise<void> | void) => void;
    expect?: any;
  };
}

export interface TestCaseResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export interface TestExecutionReport {
  success: boolean;
  passed: number;
  failed: number;
  tests: TestCaseResult[];
}
