import { describe, expect, it } from "vitest";
import { VERSION } from "../src/index.js";

describe("@honocube/app scaffold", () => {
  it("exports package version matching 2.0.2", () => {
    expect(VERSION).toBe("2.0.2");
  });
});
