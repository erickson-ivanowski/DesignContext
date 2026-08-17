import { describe, it, expect } from "vitest";
import {
  getProjectInput,
  getProjectOutput,
  getScreenInput,
  getScreenOutput,
  getStructureInput,
  getStructureOutput,
  getComponentInput,
  getComponentOutput,
  getTokensInput,
  getTokensOutput,
  getChangesInput,
  getChangesOutput,
  findInput,
  findOutput,
  inspectInput,
} from "@designcontext/mcp-server";

describe("MCP tool contracts", () => {
  it("design_get_project accepts {} and validates output", () => {
    expect(getProjectInput.parse({})).toEqual({});
    expect(() => getProjectInput.parse({ extra: true })).toThrow();

    const output = getProjectOutput.parse({
      name: "app",
      framework: "react",
      screens: ["Checkout"],
      components: ["Submit"],
      tokens: ["color.primary"],
    });
    expect(output.screens).toEqual(["Checkout"]);
  });

  it("design_get_screen requires screen and validates output", () => {
    expect(getScreenInput.parse({ screen: "Checkout" })).toEqual({ screen: "Checkout" });
    expect(() => getScreenInput.parse({})).toThrow();

    const output = getScreenOutput.parse({
      screen: "Checkout",
      viewport: null,
      sections: ["Payment"],
      components: ["Submit"],
      layoutSummary: {},
      availableChildren: ["Payment"],
    });
    expect(output.components).toContain("Submit");
  });

  it("design_get_structure validates tree shape and depth", () => {
    expect(getStructureInput.parse({ nodeId: "1", depth: 2 })).toEqual({
      nodeId: "1",
      depth: 2,
    });
    expect(() => getStructureInput.parse({ nodeId: "1", depth: -1 })).toThrow();

    const tree = getStructureOutput.parse({
      id: "1",
      name: "Screen",
      type: "FRAME",
      children: [{ id: "2", name: "Button", type: "COMPONENT", children: [] }],
    });
    expect(tree.children).toHaveLength(1);
  });

  it("design_get_component accepts name or nodeId", () => {
    expect(getComponentInput.parse({ name: "Submit" })).toEqual({ name: "Submit" });
    expect(getComponentInput.parse({ nodeId: "1:2" })).toEqual({ nodeId: "1:2" });

    const output = getComponentOutput.parse({
      name: "Submit",
      structure: [{ id: "1", name: "Submit", type: "COMPONENT", children: [] }],
      properties: { label: "Pay" },
      tokens: {},
      childComponents: [],
      codeMapping: { component: "Submit", source: null, props: ["label"] },
    });
    expect(output.codeMapping.props).toEqual(["label"]);
  });

  it("design_get_tokens validates output", () => {
    expect(getTokensInput.parse({})).toEqual({});
    expect(getTokensInput.parse({ scope: "0:1" })).toEqual({ scope: "0:1" });

    const output = getTokensOutput.parse({
      scope: "project",
      color: { "primary.blue": "#0066ff" },
      spacing: { sm: 8 },
    });
    expect(output.color).toEqual({ "primary.blue": "#0066ff" });
  });

  it("design_get_changes validates diff output", () => {
    expect(getChangesInput.parse({ screen: "Checkout" })).toEqual({ screen: "Checkout" });

    const output = getChangesOutput.parse({
      changed: [{ nodeId: "1", name: "Submit", before: { a: 1 }, after: { a: 2 }, kind: "content" }],
      added: [],
      removed: [],
      unchanged: ["2"],
    });
    expect(output.changed[0].kind).toBe("content");
  });

  it("design_find and design_inspect validate inputs", () => {
    expect(findInput.parse({ query: "pay" })).toEqual({ query: "pay" });
    expect(findOutput.parse([])).toEqual([]);

    expect(inspectInput.parse({ nodeId: "1", level: 0 })).toEqual({ nodeId: "1", level: 0 });
    expect(() => inspectInput.parse({ nodeId: "1", level: 5 })).toThrow();
  });
});
