import type {
  FigmaAdapter,
  FigmaDesignContext,
  FigmaMetadata,
} from "@designcontext/core";
import { parseFigmaDataResponse, type ParsedFigmaData } from "./parse-figma-data";

/** Minimal client for the Figma MCP (tool call abstraction). */
export interface FigmaMcpClient {
  callTool(name: string, args: Record<string, unknown>): Promise<{ content: unknown[] }>;
  close?(): Promise<void>;
}

function textOf(result: { content: unknown[] }): string {
  const parts: string[] = [];
  for (const item of result.content) {
    if (typeof item === "string") parts.push(item);
    else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      if (typeof obj.text === "string") parts.push(obj.text);
      else if (obj.text && typeof (obj.text as Record<string, unknown>).text === "string") {
        parts.push((obj.text as Record<string, unknown>).text as string);
      }
    }
  }
  return parts.join("\n");
}

function imageOf(result: { content: unknown[] }): Buffer | null {
  for (const item of result.content) {
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      if (obj.type === "image" && typeof obj.data === "string") {
        return Buffer.from(obj.data, "base64");
      }
    }
  }
  return null;
}

/**
 * Client of the Figma MCP, targeting `figma-developer-mcp`'s `get_figma_data` tool
 * (the current API — an older generation exposed `get_metadata`/`get_design_context`
 * returning JSON; that shape is gone). `get_figma_data` returns a whole subtree in one
 * call (a custom compact YAML-like text format, not JSON — see parse-figma-data.ts), so
 * this adapter fetches once per distinct scope root and serves every subsequent
 * getMetadata/getDesignContext call for a node already covered by that fetch from an
 * in-memory cache — DesignIndexer's per-node call pattern is unchanged, only the cost
 * of satisfying it drops after the first call.
 */
export class FigmaMcpAdapter implements FigmaAdapter {
  private readonly cache = new Map<string, ParsedFigmaData>();
  private readonly fetchDepth = 10;

  constructor(
    private readonly client: FigmaMcpClient,
    private readonly fileKey: string,
  ) {}

  async getMetadata(nodeId: string): Promise<FigmaMetadata> {
    const data = await this.ensureFetched(nodeId);
    const node = data.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Figma node "${nodeId}" not found in file "${this.fileKey}".`);
    }
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
    const data = await this.ensureFetched(nodeId);
    const node = data.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Figma node "${nodeId}" not found in file "${this.fileKey}".`);
    }
    return node as unknown as FigmaDesignContext;
  }

  async getScreenshot(nodeId: string): Promise<Buffer> {
    // figma-developer-mcp's current screenshot tool (download_figma_images) writes to
    // disk and returns file paths rather than inline bytes — a materially different
    // contract from this method's Buffer return. Try the legacy `get_screenshot` tool
    // name first (still exposed by some self-hosted/`--url` Figma MCP servers) rather
    // than silently returning nothing.
    const result = await this.client.callTool("get_screenshot", { nodeId });
    const image = imageOf(result);
    if (image) return image;
    throw new Error(
      "This Figma connection does not support inline screenshots " +
        "(figma-developer-mcp's current API writes images to disk, not to the response).",
    );
  }

  async getImage(nodeId: string): Promise<Buffer> {
    return this.getScreenshot(nodeId);
  }

  async close(): Promise<void> {
    await this.client.close?.();
    this.cache.clear();
  }

  private async ensureFetched(nodeId: string): Promise<ParsedFigmaData> {
    for (const data of this.cache.values()) {
      if (data.nodes.has(nodeId)) return data;
    }
    const result = await this.client.callTool("get_figma_data", {
      fileKey: this.fileKey,
      nodeId,
      depth: this.fetchDepth,
    });
    const parsed = parseFigmaDataResponse(textOf(result));
    this.cache.set(nodeId, parsed);
    return parsed;
  }
}
