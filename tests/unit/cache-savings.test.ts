import { describe, it, expect } from "vitest";
import { InMemoryCacheStore } from "@designcontext/cache";

describe("DesignCache savings accumulator (in-memory)", () => {
  it("recordSavings accumulates across multiple calls", async () => {
    const store = new InMemoryCacheStore();
    await store.recordSavings(1000, 200);
    await store.recordSavings(500, 100);

    const savings = await store.getSavings();
    expect(savings.tokensWithoutContext).toBe(1500);
    expect(savings.tokensWithContext).toBe(300);
    expect(savings.calls).toBe(2);
  });

  it("recordScanActivity tracks hits and misses separately", async () => {
    const store = new InMemoryCacheStore();
    await store.recordScanActivity(true);
    await store.recordScanActivity(true);
    await store.recordScanActivity(false);

    const savings = await store.getSavings();
    expect(savings.cacheHits).toBe(2);
    expect(savings.cacheMisses).toBe(1);
  });

  it("getSavings returns zeros before anything is recorded", async () => {
    const store = new InMemoryCacheStore();
    const savings = await store.getSavings();
    expect(savings).toEqual({
      tokensWithoutContext: 0,
      tokensWithContext: 0,
      calls: 0,
      cacheHits: 0,
      cacheMisses: 0,
    });
  });

  it("clear() (global) does not reset savings — it's a durable, tool-wide total, not cache data", async () => {
    const store = new InMemoryCacheStore();
    await store.recordSavings(1000, 200);
    await store.recordScanActivity(true);

    await store.clear();

    const savings = await store.getSavings();
    expect(savings.tokensWithoutContext).toBe(1000);
    expect(savings.cacheHits).toBe(1);
  });

  it("clear(fileId) (scoped) does not reset savings either", async () => {
    const store = new InMemoryCacheStore();
    await store.recordSavings(1000, 200);

    await store.clear("some-file-id");

    const savings = await store.getSavings();
    expect(savings.tokensWithoutContext).toBe(1000);
  });
});
