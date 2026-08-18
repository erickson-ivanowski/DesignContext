import type { DesignNode } from "@designcontext/core";
import type { DesignGraph } from "@designcontext/core";
import { graphKey } from "@designcontext/core";
import type { DesignCache } from "@designcontext/cache";
import { searchByName } from "./search";

/**
 * In-memory node graph optionally backed by a persistent cache. Supports
 * reloading across sessions (US5 persistence). Keyed by `graphKey(fileId, nodeId)` —
 * bare Figma node ids are only unique within a single file.
 */
export class InMemoryDesignGraph implements DesignGraph {
  private readonly nodes = new Map<string, DesignNode>();

  constructor(private readonly cache?: DesignCache) {}

  /** Reload persisted nodes from the cache (US5: reload index on startup). */
  async load(): Promise<void> {
    if (!this.cache) return;
    const nodes = await this.cache.listNodes();
    for (const node of nodes) {
      this.nodes.set(graphKey(node.fileId, node.id), node);
    }
  }

  async getNode(compositeId: string): Promise<DesignNode | null> {
    return this.nodes.get(compositeId) ?? null;
  }

  async getChildren(compositeId: string): Promise<DesignNode[]> {
    const node = this.nodes.get(compositeId);
    if (!node) return [];
    const children: DesignNode[] = [];
    for (const childId of node.children) {
      // Figma nodes can't have cross-file children — always the parent's own file.
      const child = this.nodes.get(graphKey(node.fileId, childId));
      if (child) children.push(child);
    }
    return children;
  }

  async upsert(node: DesignNode): Promise<void> {
    this.nodes.set(graphKey(node.fileId, node.id), node);
    if (this.cache) await this.cache.upsertNode(node);
  }

  async all(fileId?: string): Promise<DesignNode[]> {
    const values = Array.from(this.nodes.values());
    return fileId ? values.filter((n) => n.fileId === fileId) : values;
  }

  async search(query: string, fileId?: string): Promise<DesignNode[]> {
    const values = Array.from(this.nodes.values());
    const scoped = fileId ? values.filter((n) => n.fileId === fileId) : values;
    return searchByName(scoped, query);
  }

  async clear(fileId?: string): Promise<void> {
    if (!fileId) {
      this.nodes.clear();
      return;
    }
    for (const [key, node] of this.nodes) {
      if (node.fileId === fileId) this.nodes.delete(key);
    }
  }

  async listFileIds(): Promise<string[]> {
    const ids = new Set<string>();
    for (const node of this.nodes.values()) ids.add(node.fileId);
    return Array.from(ids);
  }
}
