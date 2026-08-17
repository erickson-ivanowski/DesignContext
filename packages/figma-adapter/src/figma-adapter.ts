import type {
  FigmaAdapter,
  FigmaDesignContext,
  FigmaMetadata,
} from "@designcontext/core";

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

function parseJson(text: string): unknown {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractChildIds(children: unknown): string[] | undefined {
  if (!Array.isArray(children)) return undefined;
  const ids: string[] = [];
  for (const child of children) {
    if (typeof child === "string") {
      if (child.length > 0) ids.push(child);
      continue;
    }
    if (child && typeof child === "object") {
      const obj = child as Record<string, unknown>;
      const id = obj.id ?? obj.nodeId;
      if (typeof id === "string" && id.length > 0) ids.push(id);
    }
  }
  return ids;
}

/**
 * Client of the Figma MCP (source document §11). Metadata-first: try a
 * lightweight `get_metadata` tool when the Figma server exposes one, falling
 * back to `get_design_context` (cached) otherwise. Unknown tool names fail
 * gracefully and fall through to the next candidate.
 */
export class FigmaMcpAdapter implements FigmaAdapter {
  private readonly contextCache = new Map<string, FigmaDesignContext>();
  private readonly metadataTools = ["get_metadata", "get_meta", "get_node"];

  constructor(private readonly client: FigmaMcpClient) {}

  async getMetadata(nodeId: string): Promise<FigmaMetadata> {
    for (const tool of this.metadataTools) {
      try {
        const result = await this.client.callTool(tool, { nodeId });
        const parsed = parseJson(textOf(result));
        if (parsed && typeof parsed === "object") {
          return this.metadataFrom(parsed as Record<string, unknown>, nodeId);
        }
      } catch {
        // Tool not available or failed — try the next candidate.
      }
    }
    const context = await this.fetchContext(nodeId);
    return this.metadataFromContext(context, nodeId);
  }

  async getDesignContext(nodeId: string): Promise<FigmaDesignContext> {
    return this.fetchContext(nodeId);
  }

  async getScreenshot(nodeId: string): Promise<Buffer> {
    const result = await this.client.callTool("get_screenshot", { nodeId });
    const image = imageOf(result);
    if (image) return image;
    const parsed = parseJson(textOf(result)) as Record<string, unknown>;
    const data = parsed.image ?? parsed.data ?? "";
    return Buffer.from(String(data), "base64");
  }

  async getImage(nodeId: string): Promise<Buffer> {
    return this.getScreenshot(nodeId);
  }

  async close(): Promise<void> {
    await this.client.close?.();
    this.contextCache.clear();
  }

  private async fetchContext(nodeId: string): Promise<FigmaDesignContext> {
    const cached = this.contextCache.get(nodeId);
    if (cached) return cached;
    const result = await this.client.callTool("get_design_context", { nodeId });
    const parsed = parseJson(textOf(result));
    const context = (parsed ?? {}) as FigmaDesignContext;
    this.contextCache.set(nodeId, context);
    return context;
  }

  private metadataFrom(
    raw: Record<string, unknown>,
    nodeId: string,
  ): FigmaMetadata {
    return {
      nodeId,
      name: String(raw.name ?? raw.nodeName ?? nodeId),
      type: String(raw.type ?? raw.nodeType ?? "FRAME"),
      parentId: (raw.parentId ?? raw.parent_id ?? null) as string | null,
      children: extractChildIds(raw.children),
      componentId: (raw.componentId ?? raw.component_id ?? null) as string | null,
      lastModified: (raw.lastModified ?? raw.last_modified ?? null) as string | null,
    };
  }

  private metadataFromContext(
    context: FigmaDesignContext,
    nodeId: string,
  ): FigmaMetadata {
    const node = (context.node ?? context.root ?? context) as Record<string, unknown>;
    return this.metadataFrom(node, nodeId);
  }
}
