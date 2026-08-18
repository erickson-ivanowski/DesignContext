import { describe, it, expect } from "vitest";
import { parseFigmaDataResponse } from "@designcontext/figma-adapter";

// Real response captured live from `figma-developer-mcp`'s get_figma_data tool
// (depth: 1, a real Figma file) — not a synthetic guess at the format.
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
EL-55c77a47:
  type: CONNECTOR
  layout:
    mode: none
    sizing: {}
    dimensions:
      width: 124
      height: 0
  strokes: fill_885d3464
  strokeWeight: 2px
  strokeDashes:
    - 6
    - 6
  strokeAlign: CENTER
EL-f67beb55:
  type: INSTANCE
  layout:
    mode: none
    overflowScroll:
      - y
    sizing: {}
    dimensions:
      width: 375
      height: 829
  fills: Light Mode/Primary Colors/White
  componentId: 1965:12776
  componentProperties:
    description: |-
      Lorem ipsum.
    title: Termos de cancelamento de conta

COMPONENTS:
1965:12776:
  id: 1965:12776
  key: af784211ed37f6faa8f88292aa894bfd4af9954f
  name: Termos de contrato/Page
1965:8767:
  id: 1965:8767
  key: cc53fda44269fef810162eca10f7ab1cae6ec41e
  name: status=on air
  componentSetId: 1965:8686

COMPONENT_SETS:
1965:8686:
  id: 1965:8686
  key: 8f5fe1774d44cba492cc6a6041d08aa61e82a64e
  name: flowMarker
  description: ''

NODES:
[CANVAS] "✅ 1 - Desenvolvimento" #155:1283
  [FRAME] "cpf" #1997:15127 template=EL-8be6dfba
  [FRAME] "cpf" #1997:15257 template=EL-8be6dfba
  [CONNECTOR] "Connector line" #1990:13560 template=EL-55c77a47
  [INSTANCE] "flowMarker" #1965:8820 layout={"mode":"column","sizing":{"horizontal":"fixed","vertical":"hug"},"dimensions":{"width":6359}} componentId=1965:8767 componentProperties={"date":"25/10/2022","hasTag":true,"version":"02","description":"Alteração no fluxo do cancelamento de conta","title":"Cancelamento automático"}
  [INSTANCE] "Termos de contrato/Page" #1969:11336 template=EL-f67beb55
  [CONNECTOR] "Connector line" #1965:12197 layout={"mode":"none","sizing":{},"dimensions":{"width":188,"height":188}} strokes=fill_885d3464 strokeWeight=2px strokeDashes=6,6
`;

describe("parseFigmaDataResponse", () => {
  it("extracts the top-level NAME without quotes", () => {
    const parsed = parseFigmaDataResponse(REAL_SAMPLE);
    expect(parsed.name).toBe("Bari_APP_Conta-Cancelamento-conta");
  });

  it("builds real Figma ids into the node map, not synthetic EL-* ids", () => {
    const parsed = parseFigmaDataResponse(REAL_SAMPLE);
    expect(parsed.nodes.has("155:1283")).toBe(true);
    expect(parsed.nodes.has("1997:15127")).toBe(true);
    expect(parsed.nodes.has("EL-8be6dfba")).toBe(false);
  });

  it("derives parent/child relationships from indentation", () => {
    const parsed = parseFigmaDataResponse(REAL_SAMPLE);
    const root = parsed.nodes.get("155:1283")!;
    expect(root.parentId).toBeNull();
    expect(root.children).toEqual([
      "1997:15127",
      "1997:15257",
      "1990:13560",
      "1965:8820",
      "1969:11336",
      "1965:12197",
    ]);
    expect(parsed.nodes.get("1997:15127")!.parentId).toBe("155:1283");
  });

  it("resolves template=EL-x by copying ELEMENTS fields, including GLOBAL_VARS lookups", () => {
    const parsed = parseFigmaDataResponse(REAL_SAMPLE);
    const cpf = parsed.nodes.get("1997:15127")!;
    expect(cpf.type).toBe("FRAME");
    expect(cpf.name).toBe("cpf");
    // EL-8be6dfba's fills references the GLOBAL_VARS key "Light Mode/Neutral Colors/Gray 100" —
    // must be resolved to the actual hex value, not left as a dangling reference string.
    expect(cpf.fills).toEqual(["#F3F3F3"]);
    expect(cpf.layout).toMatchObject({ dimensions: { width: 360, height: 800 } });
  });

  it("parses inline JSON attributes on NODES lines without a template", () => {
    const parsed = parseFigmaDataResponse(REAL_SAMPLE);
    const flowMarker = parsed.nodes.get("1965:8820")!;
    expect(flowMarker.componentId).toBe("1965:8767");
    expect(flowMarker.componentProperties).toEqual({
      date: "25/10/2022",
      hasTag: true,
      version: "02",
      description: "Alteração no fluxo do cancelamento de conta",
      title: "Cancelamento automático",
    });
  });

  it("resolves a GLOBAL_VARS-referenced inline attribute (strokes) on a non-templated node", () => {
    const parsed = parseFigmaDataResponse(REAL_SAMPLE);
    const connector = parsed.nodes.get("1965:12197")!;
    expect(connector.strokes).toEqual(["#0090FF"]);
  });

  it("parses COMPONENTS keyed by real Figma id", () => {
    const parsed = parseFigmaDataResponse(REAL_SAMPLE);
    expect(parsed.components.get("1965:12776")).toEqual({
      id: "1965:12776",
      name: "Termos de contrato/Page",
      componentSetId: undefined,
    });
    expect(parsed.components.get("1965:8767")?.componentSetId).toBe("1965:8686");
  });

  it("handles an empty/minimal response without throwing", () => {
    const parsed = parseFigmaDataResponse('NAME: "Empty"\n\nGLOBAL_VARS:\n\nELEMENTS:\n\nCOMPONENTS:\n\nCOMPONENT_SETS:\n\nNODES:\n[CANVAS] "Empty" #0:1\n');
    expect(parsed.name).toBe("Empty");
    expect(parsed.nodes.get("0:1")?.type).toBe("CANVAS");
  });
});
