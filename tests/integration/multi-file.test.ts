import { describe, it, expect } from "vitest";
import { InMemoryCacheStore } from "@designcontext/cache";
import { InMemoryDesignGraph } from "@designcontext/design-graph";
import { ContextEngineImpl } from "@designcontext/context-engine";
import { DesignIndexer } from "@designcontext/core";
import { MockFigmaAdapter } from "@designcontext/figma-adapter";

describe("Multi-file: two Figma files sharing one project's graph and cache", () => {
  it("colliding Figma node ids across files never leak into each other's context", async () => {
    const cache = new InMemoryCacheStore();
    const graph = new InMemoryDesignGraph(cache);
    const engine = new ContextEngineImpl(graph, cache);

    const adapterA = new MockFigmaAdapter();
    adapterA.setNode(
      "0:1",
      { nodeId: "0:1", name: "Checkout", type: "FRAME", lastModified: "v1" },
      { name: "Checkout", type: "FRAME", children: [], properties: {} },
    );
    const indexerA = new DesignIndexer({
      adapter: adapterA,
      graph,
      cache,
      fileId: "file-a",
    });

    const adapterB = new MockFigmaAdapter();
    adapterB.setNode(
      "0:1",
      { nodeId: "0:1", name: "Cancellation", type: "FRAME", lastModified: "v1" },
      { name: "Cancellation", type: "FRAME", children: [], properties: {} },
    );
    const indexerB = new DesignIndexer({
      adapter: adapterB,
      graph,
      cache,
      fileId: "file-b",
    });

    await indexerA.fullScan("0:1");
    await indexerB.fullScan("0:1");

    const screenA = await engine.getScreen("0:1", "file-a");
    const screenB = await engine.getScreen("0:1", "file-b");

    expect((screenA.content as { screen: string }).screen).toBe("Checkout");
    expect((screenB.content as { screen: string }).screen).toBe("Cancellation");

    const allNodes = await graph.all();
    expect(allNodes).toHaveLength(2);

    const fileIds = await graph.listFileIds();
    expect(fileIds.sort()).toEqual(["file-a", "file-b"]);
  });

  it("search scoped to one file excludes the other file's matching node", async () => {
    const cache = new InMemoryCacheStore();
    const graph = new InMemoryDesignGraph(cache);

    const adapterA = new MockFigmaAdapter();
    adapterA.setNode(
      "0:1",
      { nodeId: "0:1", name: "Submit", type: "COMPONENT", lastModified: "v1" },
      { name: "Submit", type: "COMPONENT", children: [], properties: {} },
    );
    await new DesignIndexer({ adapter: adapterA, graph, cache, fileId: "file-a" }).fullScan("0:1");

    const adapterB = new MockFigmaAdapter();
    adapterB.setNode(
      "0:2",
      { nodeId: "0:2", name: "Submit", type: "COMPONENT", lastModified: "v1" },
      { name: "Submit", type: "COMPONENT", children: [], properties: {} },
    );
    await new DesignIndexer({ adapter: adapterB, graph, cache, fileId: "file-b" }).fullScan("0:2");

    const scopedToA = await graph.search("Submit", "file-a");
    expect(scopedToA).toHaveLength(1);
    expect(scopedToA[0].fileId).toBe("file-a");

    const crossFile = await graph.search("Submit");
    expect(crossFile).toHaveLength(2);
  });

  it("clear(fileId) removes only that file's nodes from the graph and cache", async () => {
    const cache = new InMemoryCacheStore();
    const graph = new InMemoryDesignGraph(cache);

    const adapterA = new MockFigmaAdapter();
    adapterA.setNode(
      "0:1",
      { nodeId: "0:1", name: "A", type: "FRAME", lastModified: "v1" },
      { name: "A", type: "FRAME", children: [], properties: {} },
    );
    await new DesignIndexer({ adapter: adapterA, graph, cache, fileId: "file-a" }).fullScan("0:1");

    const adapterB = new MockFigmaAdapter();
    adapterB.setNode(
      "0:1",
      { nodeId: "0:1", name: "B", type: "FRAME", lastModified: "v1" },
      { name: "B", type: "FRAME", children: [], properties: {} },
    );
    await new DesignIndexer({ adapter: adapterB, graph, cache, fileId: "file-b" }).fullScan("0:1");

    await graph.clear("file-a");
    await cache.clear("file-a");

    expect(await graph.all()).toHaveLength(1);
    expect((await graph.all())[0].fileId).toBe("file-b");
    expect(await cache.listNodes("file-a")).toHaveLength(0);
    expect(await cache.listNodes("file-b")).toHaveLength(1);
  });
});
