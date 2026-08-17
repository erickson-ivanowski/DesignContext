import { describe, it, expect } from "vitest";
import { buildFixture } from "../helpers/fixture";

describe("US1: index a design and get a screen summary", () => {
  it("full scan discovers all nodes and get_screen returns a summary", async () => {
    const { indexer, engine } = buildFixture();

    const report = await indexer.fullScan("0:1");
    expect(report.discovered).toBe(3);
    expect(report.indexed).toBe(3);

    const screen = await engine.getScreen("0:1");
    const content = screen.content as {
      screen: string;
      sections: string[];
      components: string[];
      availableChildren: string[];
    };

    expect(content.screen).toBe("Checkout");
    expect(content.sections).toEqual(["Payment", "Submit"]);
    expect(content.components).toContain("Submit");
    expect(content.availableChildren).toEqual(["Payment", "Submit"]);
    expect(screen.tokenCount).toBeGreaterThan(0);
  });

  it("get_screen returns a summary, not the raw design dump", async () => {
    const { indexer, engine } = buildFixture();
    await indexer.fullScan("0:1");

    const screen = await engine.getScreen("0:1");
    const raw = JSON.stringify(screen.content);
    expect(raw).not.toContain("rawContext");
    expect(screen.level).toBe(0);
  });
});
