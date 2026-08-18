import type {
  FigmaAdapter,
  FigmaDesignContext,
  FigmaMetadata,
} from "@designcontext/core";
import type { ParsedFigmaData } from "./parse-figma-data";

/**
 * FigmaAdapter backed by data an AI agent already fetched via its own Figma MCP tool
 * access (parsed by parseFigmaDataResponse), rather than a live connection this process
 * holds itself. Lets `DesignIndexer.fullScan` run completely unchanged against
 * agent-supplied data — see `design_import` in @designcontext/mcp-server.
 */
export class ImportedFigmaAdapter implements FigmaAdapter {
  constructor(private readonly data: ParsedFigmaData) {}

  async getMetadata(nodeId: string): Promise<FigmaMetadata> {
    const node = this.data.nodes.get(nodeId);
    if (!node) throw new Error(`Node "${nodeId}" not found in imported data.`);
    return {
      nodeId: node.id,
      name: node.name,
      type: node.type,
      parentId: node.parentId,
      children: node.children,
      componentId: node.componentId ?? null,
      lastModified: null,
    };
  }

  async getDesignContext(nodeId: string): Promise<FigmaDesignContext> {
    const node = this.data.nodes.get(nodeId);
    if (!node) throw new Error(`Node "${nodeId}" not found in imported data.`);
    return node as unknown as FigmaDesignContext;
  }

  async getScreenshot(_nodeId: string): Promise<Buffer> {
    throw new Error(
      "Screenshots aren't available from imported data — the agent's raw Figma MCP " +
        "output carries no image bytes. Use the agent's own screenshot tool directly if needed.",
    );
  }

  async getImage(nodeId: string): Promise<Buffer> {
    return this.getScreenshot(nodeId);
  }
}
