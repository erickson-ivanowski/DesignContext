import { describe, it, expect } from "vitest";
import { buildFixture } from "../helpers/fixture";

describe("US2: detect a small design change without reprocessing everything", () => {
  it("incremental scan reports exactly the changed node and skips re-fetch", async () => {
    const { adapter, cache, indexer } = buildFixture();

    await indexer.fullScan("0:1");

    // Mutate one button: content + lastModified change, structure unchanged.
    adapter.setNode(
      "0:3",
      {
        nodeId: "0:3",
        name: "Submit",
        type: "COMPONENT",
        parentId: "0:1",
        componentId: "c:submit",
        lastModified: "v2",
      },
      {
        name: "Submit",
        type: "COMPONENT",
        componentId: "c:submit",
        componentName: "Submit",
        children: [],
        properties: { label: "Pay now!" },
        color: { r: 0, g: 0.5, b: 1, a: 1 },
      },
    );

    adapter.calls.context.length = 0;
    const report = await indexer.incrementalScan("0:1");

    expect(report.changed).toBe(1);
    expect(report.cached).toBe(2);
    expect(report.indexed).toBe(0);

    // Only the mutated button's context is re-fetched.
    expect(adapter.calls.context).toEqual(["0:3"]);

    // 2 unchanged nodes (0:1, 0:2) recorded as cache hits, 1 changed node (0:3) as a miss.
    const savings = await cache.getSavings();
    expect(savings.cacheHits).toBe(2);
    expect(savings.cacheMisses).toBe(1);
  });
});
