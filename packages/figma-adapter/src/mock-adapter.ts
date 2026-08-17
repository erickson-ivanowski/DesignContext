import type {
  FigmaAdapter,
  FigmaDesignContext,
  FigmaMetadata,
} from "@designcontext/core";

export interface MockNode {
  metadata: FigmaMetadata;
  context: FigmaDesignContext;
}

/**
 * Hermetic FigmaAdapter backed by an in-memory node map. Mutations let tests
 * simulate design changes (US2/change-detection) without a live Figma MCP.
 */
export class MockFigmaAdapter implements FigmaAdapter {
  readonly calls: { metadata: string[]; context: string[] } = {
    metadata: [],
    context: [],
  };

  constructor(private readonly nodes: Map<string, MockNode> = new Map()) {}

  setNode(nodeId: string, metadata: FigmaMetadata, context: FigmaDesignContext): void {
    this.nodes.set(nodeId, { metadata, context });
  }

  async getMetadata(nodeId: string): Promise<FigmaMetadata> {
    this.calls.metadata.push(nodeId);
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`Unknown node: ${nodeId}`);
    return node.metadata;
  }

  async getDesignContext(nodeId: string): Promise<FigmaDesignContext> {
    this.calls.context.push(nodeId);
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`Unknown node: ${nodeId}`);
    return node.context;
  }

  async getScreenshot(_nodeId: string): Promise<Buffer> {
    return Buffer.from("mock-png");
  }

  async getImage(_nodeId: string): Promise<Buffer> {
    return Buffer.from("mock-png");
  }
}
