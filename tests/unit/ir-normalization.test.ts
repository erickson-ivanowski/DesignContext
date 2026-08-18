import { describe, it, expect } from "vitest";
import { normalize, extractTokens } from "@designcontext/design-ir";

describe("IR normalization", () => {
  it("normalizes raw Figma context into Design IR", () => {
    const ir = normalize(
      "1:2",
      {
        name: "Payment",
        type: "FRAME",
        absoluteBoundingBox: { x: 0, y: 0, width: 320, height: 240 },
        children: [{ id: "1:3" }, "1:4"],
        componentId: "c:1",
        componentName: "Payment",
        properties: { layoutMode: "VERTICAL" },
      },
      "file-1",
    );

    expect(ir.id).toBe("1:2");
    expect(ir.name).toBe("Payment");
    expect(ir.type).toBe("FRAME");
    expect(ir.bounds).toEqual({ x: 0, y: 0, width: 320, height: 240 });
    expect(ir.children).toEqual(["1:3", "1:4"]);
    expect(ir.componentId).toBe("c:1");
    expect(ir.properties).toEqual({ layoutMode: "VERTICAL" });
  });

  it("tolerates missing fields", () => {
    const ir = normalize("1:2", {}, "file-1");
    expect(ir.name).toBe("1:2");
    expect(ir.type).toBe("FRAME");
    expect(ir.bounds).toBeNull();
    expect(ir.children).toEqual([]);
    expect(ir.componentId).toBeNull();
  });

  it("extracts color tokens from fills", () => {
    const tokens = extractTokens({
      fills: [{ color: { r: 1, g: 0.5, b: 0, a: 1 } }],
    });
    expect(tokens.color).toEqual({ r: "1", g: "0.5", b: "0", a: "1" });
  });

  it("preserves a TEXT node's `text` content in properties (regression: this was silently dropped)", () => {
    const ir = normalize(
      "1:21",
      {
        name: "Edit team color styles",
        type: "TEXT",
        text: "Edit team color styles",
      },
      "file-1",
    );

    expect(ir.properties.text).toBe("Edit team color styles");
  });
});
