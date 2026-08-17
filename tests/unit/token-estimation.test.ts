import { describe, it, expect } from "vitest";
import {
  estimateTokens,
  estimateTokenReduction,
} from "@designcontext/shared";

describe("token estimation", () => {
  it("estimates ~4 chars per token", () => {
    expect(estimateTokens("abcd efgh")).toBe(3);
  });

  it("handles objects", () => {
    expect(estimateTokens({ a: 1, b: 2 })).toBeGreaterThan(0);
  });

  it("returns 0 for empty input", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens(null)).toBe(0);
  });

  it("computes reduction ratio", () => {
    expect(estimateTokenReduction(1000, 300)).toBeCloseTo(0.7);
    expect(estimateTokenReduction(0, 0)).toBe(0);
    expect(estimateTokenReduction(1000, 0)).toBe(1);
  });
});
