import { MockFigmaAdapter } from "@designcontext/figma-adapter";
import { InMemoryCacheStore } from "@designcontext/cache";
import { InMemoryDesignGraph } from "@designcontext/design-graph";
import { ContextEngineImpl } from "@designcontext/context-engine";
import { DesignIndexer } from "@designcontext/core";

export interface Fixture {
  adapter: MockFigmaAdapter;
  cache: InMemoryCacheStore;
  graph: InMemoryDesignGraph;
  engine: ContextEngineImpl;
  indexer: DesignIndexer;
}

const FILE_ID = "file-checkout";

export function buildFixture(): Fixture {
  const adapter = new MockFigmaAdapter();

  adapter.setNode(
    "0:1",
    {
      nodeId: "0:1",
      name: "Checkout",
      type: "FRAME",
      children: ["0:2", "0:3"],
      lastModified: "v1",
    },
    {
      name: "Checkout",
      type: "FRAME",
      bounds: { x: 0, y: 0, width: 375, height: 812 },
      children: ["0:2", "0:3"],
      properties: { layoutMode: "VERTICAL" },
    },
  );

  adapter.setNode(
    "0:2",
    {
      nodeId: "0:2",
      name: "Payment",
      type: "FRAME",
      parentId: "0:1",
      lastModified: "v1",
    },
    {
      name: "Payment",
      type: "FRAME",
      bounds: { x: 16, y: 16, width: 343, height: 200 },
      children: [],
      properties: { layoutMode: "HORIZONTAL" },
    },
  );

  adapter.setNode(
    "0:3",
    {
      nodeId: "0:3",
      name: "Submit",
      type: "COMPONENT",
      parentId: "0:1",
      componentId: "c:submit",
      lastModified: "v1",
    },
    {
      name: "Submit",
      type: "COMPONENT",
      componentId: "c:submit",
      componentName: "Submit",
      children: [],
      properties: { label: "Pay now" },
      color: { r: 0, g: 0.5, b: 1, a: 1 },
    },
  );

  const cache = new InMemoryCacheStore();
  const graph = new InMemoryDesignGraph(cache);
  const engine = new ContextEngineImpl(graph, cache);
  const indexer = new DesignIndexer({ adapter, graph, cache, fileId: FILE_ID });

  return { adapter, cache, graph, engine, indexer };
}
