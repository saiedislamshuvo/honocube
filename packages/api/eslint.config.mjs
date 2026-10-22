import { config } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    rules: {
      // The adapter interface is deliberately untyped (`any`) so that the
      // framework can sit on top of any driver, and the core uses it to talk
      // to tables whose shape it does not know at compile time.
      "@typescript-eslint/no-explicit-any": "off",
      // A `catch` block that is only there to ignore an error is common in
      // the manual test tooling and in the optional code paths.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }
      ]
    }
  }
];
