import { describe, it, expect } from "vitest";
import { optimize } from "@designcontext/context-engine";

describe("optimize()", () => {
  it("fullTokenCount reflects the pre-optimization content size, unaffected by stripping", () => {
    // Large enough to exceed the budget and trigger stripping (rawContext/properties/children).
    const bigChildren = Array.from({ length: 2000 }, (_, i) => ({ id: `n${i}`, name: `Node ${i}` }));
    const content = {
      name: "Screen",
      rawContext: { some: "large payload".repeat(2000) },
      properties: Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`prop${i}`, "value".repeat(20)])),
      children: bigChildren,
    };

    const result = optimize(content);

    // Stripping actually happened (heavy fields were replaced with counts/references) —
    // this is what "saved tokens" means, independent of whether the post-strip result
    // also happens to be under budget (that's what `truncated` tracks, a different thing).
    expect(result.fullTokenCount).toBeGreaterThan(result.tokenCount);
    expect(result.references.length).toBeGreaterThan(0);
  });

  it("fullTokenCount equals tokenCount when content already fits the budget (no stripping happens)", () => {
    const content = { name: "Small", type: "FRAME" };
    const result = optimize(content);

    expect(result.truncated).toBe(false);
    expect(result.fullTokenCount).toBe(result.tokenCount);
  });
});
