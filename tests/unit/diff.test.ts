import { describe, it, expect } from "vitest";
import { diff } from "@designcontext/diff-engine";
import type { DesignNode } from "@designcontext/core";

function node(id: string, props: Record<string, unknown>, structural = "s1"): DesignNode {
  return {
    id,
    fileId: "f",
    parentId: null,
    name: id,
    type: "FRAME",
    bounds: null,
    children: [],
    componentId: null,
    componentName: null,
    properties: props,
    tokens: {},
    contentHash: `content-${JSON.stringify(props)}`,
    structuralHash: structural,
    lastSeenAt: "2026-01-01",
  };
}

describe("diff", () => {
  it("classifies changed, added, removed, unchanged", () => {
    const previous = {
      a: node("a", { label: "old" }),
      b: node("b", { x: 1 }),
      removed: node("removed", {}),
    };
    const current = {
      a: node("a", { label: "new" }),
      b: node("b", { x: 1 }),
      added: node("added", {}),
    };

    const result = diff("scope", previous, current);
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].nodeId).toBe("a");
    expect(result.changed[0].before).toEqual({ label: "old" });
    expect(result.changed[0].after).toEqual({ label: "new" });
    expect(result.added).toEqual(["added"]);
    expect(result.removed).toEqual(["removed"]);
    expect(result.unchanged).toEqual(["b"]);
  });

  it("distinguishes structural from content changes", () => {
    const previous = { a: node("a", {}, "s1") };
    const current = { a: node("a", {}, "s2") };
    const result = diff("scope", previous, current);
    expect(result.changed[0].kind).toBe("structural");
  });
});
