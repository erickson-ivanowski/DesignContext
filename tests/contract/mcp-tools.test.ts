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
  importInput,
  importOutput,
  createToolDefinitions,
  type ToolContext,
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

  it("design_import validates input/output and is omitted unless ctx.importFigmaData is provided", () => {
    expect(
      importInput.parse({ file: "app", scopeNodeId: "0:1", rawData: "NAME: \"x\"" }),
    ).toEqual({ file: "app", scopeNodeId: "0:1", rawData: 'NAME: "x"' });
    expect(() => importInput.parse({ file: "app", scopeNodeId: "0:1" })).toThrow();

    expect(importOutput.parse({ discovered: 3, indexed: 3, changed: 0, cached: 0 })).toMatchObject({
      discovered: 3,
    });

    const baseCtx: ToolContext = {
      engine: {} as ToolContext["engine"],
      graph: {} as ToolContext["graph"],
      getProject: async () => ({ name: "app", framework: "react", screens: [], components: [], tokens: [] }),
      listFiles: async () => [],
      resolveFileId: async () => "file-1",
      getFileConnectionState: async () => ({ hasConnection: false, indexedNodes: 0 }),
    };

    expect(createToolDefinitions(baseCtx).some((t) => t.name === "design_import")).toBe(false);

    const withImport: ToolContext = {
      ...baseCtx,
      importFigmaData: async () => ({ discovered: 0, indexed: 0, changed: 0, cached: 0 }),
    };
    const tools = createToolDefinitions(withImport);
    expect(tools.some((t) => t.name === "design_import")).toBe(true);
  });

  it("design_import handler surfaces a warning when 0 nodes were discovered", async () => {
    const ctx: ToolContext = {
      engine: {} as ToolContext["engine"],
      graph: {} as ToolContext["graph"],
      getProject: async () => ({ name: "app", framework: "react", screens: [], components: [], tokens: [] }),
      listFiles: async () => [],
      resolveFileId: async () => "file-1",
      getFileConnectionState: async () => ({ hasConnection: false, indexedNodes: 0 }),
      importFigmaData: async () => ({ discovered: 0, indexed: 0, changed: 0, cached: 0 }),
    };
    const tool = createToolDefinitions(ctx).find((t) => t.name === "design_import")!;
    const result = (await tool.handler({ file: "app", scopeNodeId: "0:1", rawData: "garbage" })) as {
      discovered: number;
      warning?: string;
    };
    expect(result.discovered).toBe(0);
    expect(result.warning).toMatch(/0 nodes parsed/);
  });
});
