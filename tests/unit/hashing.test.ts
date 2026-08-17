import { describe, it, expect } from "vitest";
import {
  contentHash,
  structuralHash,
  canonicalJson,
  sha256,
} from "@designcontext/shared";

describe("hashing", () => {
  it("is deterministic regardless of key order", () => {
    const a = { name: "x", type: "FRAME", children: ["1", "2"] };
    const b = { children: ["1", "2"], type: "FRAME", name: "x" };
    expect(contentHash(a)).toBe(contentHash(b));
  });

  it("excludes volatile fields from content hash", () => {
    const a = { name: "x", type: "FRAME", lastModified: "2020-01-01" };
    const b = { name: "x", type: "FRAME", lastModified: "2026-08-17" };
    expect(contentHash(a)).toBe(contentHash(b));
  });

  it("detects content changes", () => {
    const a = { name: "x", type: "FRAME", properties: { label: "A" } };
    const b = { name: "x", type: "FRAME", properties: { label: "B" } };
    expect(contentHash(a)).not.toBe(contentHash(b));
  });

  it("structuralHash reflects type/children/component/hierarchy", () => {
    const base = {
      type: "FRAME",
      children: ["1"],
      order: 0,
      componentId: null as string | null,
      hierarchy: ["root"],
    };
    const same = { ...base, order: 0 };
    expect(structuralHash(base)).toBe(structuralHash(same));

    const changedType = { ...base, type: "INSTANCE" };
    expect(structuralHash(changedType)).not.toBe(structuralHash(base));

    const changedChildren = { ...base, children: ["1", "2"] };
    expect(structuralHash(changedChildren)).not.toBe(structuralHash(base));
  });

  it("canonicalJson sorts keys and strips volatile", () => {
    const json = canonicalJson({ b: 1, a: 2, lastModified: "x" });
    expect(json).toBe(JSON.stringify({ a: 2, b: 1 }));
  });

  it("sha256 returns a 64-char hex digest", () => {
    expect(sha256("hello")).toMatch(/^[a-f0-9]{64}$/);
  });
});
