import { describe, it, expect } from "vitest";
import { InMemoryCacheStore } from "@designcontext/cache";
import { InMemoryDesignGraph } from "@designcontext/design-graph";
import { ContextEngineImpl } from "@designcontext/context-engine";
import { DesignIndexer } from "@designcontext/core";
import { MockFigmaAdapter } from "@designcontext/figma-adapter";

describe("US5: reuse previously indexed context across sessions", () => {
  it("a second scan of an unchanged design reuses cached data (no Figma calls)", async () => {
    const adapter = new MockFigmaAdapter();
    adapter.setNode(
      "0:1",
      { nodeId: "0:1", name: "Home", type: "FRAME", lastModified: "v1" },
      { name: "Home", type: "FRAME", children: [], properties: {} },
    );

    const cache = new InMemoryCacheStore();
    const graph1 = new InMemoryDesignGraph(cache);
    const indexer1 = new DesignIndexer({
      adapter,
      graph: graph1,
      cache,
      fileId: "file-home",
    });
    await indexer1.fullScan("0:1");

    // Simulate a restart: a fresh graph reloaded from the same cache.
    const graph2 = new InMemoryDesignGraph(cache);
    await graph2.load();
    const engine2 = new ContextEngineImpl(graph2, cache);
    const adapter2 = new MockFigmaAdapter();
    adapter2.setNode(
      "0:1",
      { nodeId: "0:1", name: "Home", type: "FRAME", lastModified: "v1" },
      { name: "Home", type: "FRAME", children: [], properties: {} },
    );
    const indexer2 = new DesignIndexer({
      adapter: adapter2,
      graph: graph2,
      cache,
      fileId: "file-home",
    });

    const report = await indexer2.incrementalScan("0:1");
    expect(report.cached).toBe(1);
    expect(report.changed).toBe(0);
    expect(adapter2.calls.context).toHaveLength(0);

    const screen = await engine2.getScreen("0:1");
    expect((screen.content as { screen: string }).screen).toBe("Home");
  });
});
