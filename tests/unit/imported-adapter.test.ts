import { describe, it, expect } from "vitest";
import { ImportedFigmaAdapter, parseFigmaDataResponse } from "@designcontext/figma-adapter";

// Same real captured sample used by parse-figma-data.test.ts.
const REAL_SAMPLE = `NAME: "Bari_APP_Conta-Cancelamento-conta"

GLOBAL_VARS:
Light Mode/Neutral Colors/Gray 100:
  - '#F3F3F3'
fill_885d3464:
  - '#0090FF'
Light Mode/Primary Colors/White:
  - '#FFFFFF'
layout_a9bd3943:
  mode: column
  padding: 24px
  alignItems: center
  gap: 24px
  sizing:
    horizontal: fixed
    vertical: hug
  dimensions:
    width: 360

ELEMENTS:
EL-8be6dfba:
  type: FRAME
  layout:
    mode: none
    sizing: {}
    dimensions:
      width: 360
      height: 800
  fills: Light Mode/Neutral Colors/Gray 100

COMPONENTS:

COMPONENT_SETS:

NODES:
[CANVAS] "✅ 1 - Desenvolvimento" #155:1283
  [FRAME] "cpf" #1997:15127 template=EL-8be6dfba
`;

describe("ImportedFigmaAdapter", () => {
  it("resolves metadata for the root node from parsed data", async () => {
    const parsed = parseFigmaDataResponse(REAL_SAMPLE);
    const adapter = new ImportedFigmaAdapter(parsed);
    const meta = await adapter.getMetadata("155:1283");
    expect(meta.name).toBe("✅ 1 - Desenvolvimento");
    expect(meta.type).toBe("CANVAS");
    expect(meta.children).toEqual(["1997:15127"]);
    expect(meta.parentId).toBeNull();
  });

  it("resolves metadata for a child node", async () => {
    const parsed = parseFigmaDataResponse(REAL_SAMPLE);
    const adapter = new ImportedFigmaAdapter(parsed);
    const meta = await adapter.getMetadata("1997:15127");
    expect(meta.name).toBe("cpf");
    expect(meta.type).toBe("FRAME");
    expect(meta.parentId).toBe("155:1283");
  });

  it("returns the parsed node as design context", async () => {
    const parsed = parseFigmaDataResponse(REAL_SAMPLE);
    const adapter = new ImportedFigmaAdapter(parsed);
    const ctx = await adapter.getDesignContext("1997:15127");
    expect(ctx.type).toBe("FRAME");
    expect(ctx.fills).toEqual(["#F3F3F3"]);
  });

  it("throws a clear error for an unknown node id", async () => {
    const parsed = parseFigmaDataResponse(REAL_SAMPLE);
    const adapter = new ImportedFigmaAdapter(parsed);
    await expect(adapter.getMetadata("9:9")).rejects.toThrow('Node "9:9" not found in imported data.');
    await expect(adapter.getDesignContext("9:9")).rejects.toThrow('Node "9:9" not found in imported data.');
  });

  it("getScreenshot/getImage throw a documented not-available error", async () => {
    const parsed = parseFigmaDataResponse(REAL_SAMPLE);
    const adapter = new ImportedFigmaAdapter(parsed);
    await expect(adapter.getScreenshot("155:1283")).rejects.toThrow(/available from imported data/);
    await expect(adapter.getImage("155:1283")).rejects.toThrow(/available from imported data/);
  });
});
