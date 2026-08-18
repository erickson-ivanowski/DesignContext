import { describe, it, expect } from "vitest";
import { createToolDefinitions, type ToolContext, type FileConnectionState } from "@designcontext/mcp-server";
import { InMemoryDesignGraph } from "@designcontext/design-graph";
import { ContextEngineImpl } from "@designcontext/context-engine";

function buildCtx(connectionState: FileConnectionState): ToolContext {
  const graph = new InMemoryDesignGraph();
  const engine = new ContextEngineImpl(graph, {
    get: async () => null,
    set: async () => {},
    invalidate: async () => {},
    clear: async () => {},
    listNodes: async () => [],
    upsertNode: async () => {},
    saveSnapshot: async () => {},
    getLatestSnapshot: async () => null,
    recordSavings: async () => {},
    recordScanActivity: async () => {},
    getSavings: async () => ({
      tokensWithoutContext: 0,
      tokensWithContext: 0,
      calls: 0,
      cacheHits: 0,
      cacheMisses: 0,
    }),
  });
  return {
    engine: engine as ToolContext["engine"],
    graph,
    getProject: async () => ({ name: "app", framework: "unknown", screens: [], components: [], tokens: [] }),
    listFiles: async () => [
      { alias: "checkout", fileId: "file-1", screens: 0, components: 0, hasConnection: connectionState.hasConnection },
    ],
    resolveFileId: async () => "file-1",
    getFileConnectionState: async () => connectionState,
  };
}

function findTool(ctx: ToolContext, name: string) {
  const tool = createToolDefinitions(ctx).find((t) => t.name === name);
  if (!tool) throw new Error(`tool ${name} not found`);
  return tool;
}

describe("assertFileReady: actionable errors for empty files", () => {
  it("tells the agent to generate a token when the file has no connection and no data", async () => {
    const ctx = buildCtx({ hasConnection: false, indexedNodes: 0 });
    const tool = findTool(ctx, "design_get_screen");

    await expect(tool.handler({ screen: "Checkout", file: "checkout" })).rejects.toThrow(
      /figma\.com\/settings.*Personal Access Tokens/s,
    );
    await expect(tool.handler({ screen: "Checkout", file: "checkout" })).rejects.toThrow(
      /designcontext connect --file/,
    );
  });

  it("tells the agent to run scan when the file is connected but never scanned", async () => {
    const ctx = buildCtx({ hasConnection: true, indexedNodes: 0 });
    const tool = findTool(ctx, "design_get_structure");

    await expect(tool.handler({ nodeId: "0:1", depth: 1, file: "checkout" })).rejects.toThrow(
      /never been scanned/,
    );
    await expect(tool.handler({ nodeId: "0:1", depth: 1, file: "checkout" })).rejects.toThrow(
      /designcontext scan --file checkout/,
    );
  });

  it("does not gate design_find on connection state — empty results are a legitimate answer", async () => {
    const ctx = buildCtx({ hasConnection: false, indexedNodes: 0 });
    const tool = findTool(ctx, "design_find");

    const result = await tool.handler({ query: "Checkout" });
    expect(result).toEqual([]);
  });
});
