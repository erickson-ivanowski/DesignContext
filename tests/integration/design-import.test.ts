import { describe, it, expect } from "vitest";
import { ImportedFigmaAdapter, parseFigmaDataResponse } from "@designcontext/figma-adapter";
import { DesignIndexer } from "@designcontext/core";
import { InMemoryCacheStore } from "@designcontext/cache";
import { InMemoryDesignGraph } from "@designcontext/design-graph";
import { ContextEngineImpl } from "@designcontext/context-engine";

// Same real captured sample used by parse-figma-data.test.ts / imported-adapter.test.ts.
const REAL_SAMPLE = `NAME: "Bari_APP_Conta-Cancelamento-conta"

GLOBAL_VARS:
Light Mode/Neutral Colors/Gray 100:
  - '#F3F3F3'

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
  [FRAME] "cpf 2" #1997:15257 template=EL-8be6dfba
`;

describe("design_import path: ImportedFigmaAdapter -> DesignIndexer.fullScan", () => {
  it("indexes agent-supplied raw Figma data through the normal scan/cache pipeline", async () => {
    const parsed = parseFigmaDataResponse(REAL_SAMPLE);
    const adapter = new ImportedFigmaAdapter(parsed);
    const cache = new InMemoryCacheStore();
    const graph = new InMemoryDesignGraph(cache);
    const engine = new ContextEngineImpl(graph, cache);
    const indexer = new DesignIndexer({ adapter, graph, cache, fileId: "file-imported" });

    const report = await indexer.fullScan("155:1283");
    expect(report.discovered).toBe(3);
    expect(report.indexed).toBe(3);
    expect(report.fullScan).toBe(true);

    const structureNode = await graph.getNode("file-imported:1997:15127");
    expect(structureNode?.name).toBe("cpf");
    expect(structureNode?.tokens.color).toBeTruthy();

    const screen = await engine.getScreen("155:1283", "file-imported");
    expect((screen.content as { screen: string }).screen).toBe("✅ 1 - Desenvolvimento");
  });

  it("reports 0 discovered when rawData doesn't parse into any nodes", async () => {
    const parsed = parseFigmaDataResponse('NAME: "Empty"\n\nGLOBAL_VARS:\n\nELEMENTS:\n\nCOMPONENTS:\n\nCOMPONENT_SETS:\n\nNODES:\n');
    expect(parsed.nodes.size).toBe(0);
  });
});
