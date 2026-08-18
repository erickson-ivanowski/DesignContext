import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { FigmaMcpAdapter, StdioFigmaClient } from "@designcontext/figma-adapter";
import { DesignIndexer } from "@designcontext/core";
import { InMemoryCacheStore } from "@designcontext/cache";
import { InMemoryDesignGraph } from "@designcontext/design-graph";
import { ContextEngineImpl } from "@designcontext/context-engine";

const serverPath = fileURLToPath(
  new URL("../fixtures/mock-figma-server.mjs", import.meta.url),
);

describe("Figma MCP stdio client", () => {
  it("indexes a design through a real stdio MCP server and serves a screen summary", async () => {
    const client = new StdioFigmaClient({
      command: process.execPath,
      args: [serverPath],
    });
    const adapter = new FigmaMcpAdapter(client);
    const cache = new InMemoryCacheStore();
    const graph = new InMemoryDesignGraph(cache);
    const engine = new ContextEngineImpl(graph, cache);
    const indexer = new DesignIndexer({ adapter, graph, cache, fileId: "file-checkout" });

    const report = await indexer.fullScan("0:1");
    expect(report.discovered).toBe(3);

    const screen = await engine.getScreen("0:1", "file-checkout");
    expect((screen.content as { screen: string }).screen).toBe("Checkout");

    const screenshot = await adapter.getScreenshot("0:1");
    expect(screenshot).toBeInstanceOf(Buffer);
    expect(screenshot.toString()).toBe("hello");

    await adapter.close();
  }, 20000);
});
