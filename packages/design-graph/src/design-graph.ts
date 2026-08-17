import type { DesignNode } from "@designcontext/core";
import type { DesignGraph } from "@designcontext/core";
import type { DesignCache } from "@designcontext/cache";
import { searchByName } from "./search";

/**
 * In-memory node graph optionally backed by a persistent cache. Supports
 * reloading across sessions (US5 persistence).
 */
export class InMemoryDesignGraph implements DesignGraph {
  private readonly nodes = new Map<string, DesignNode>();

  constructor(private readonly cache?: DesignCache) {}

  /** Reload persisted nodes from the cache (US5: reload index on startup). */
  async load(): Promise<void> {
    if (!this.cache) return;
    const nodes = await this.cache.listNodes();
    for (const node of nodes) {
      this.nodes.set(node.id, node);
    }
  }

  async getNode(id: string): Promise<DesignNode | null> {
    return this.nodes.get(id) ?? null;
  }

  async getChildren(id: string): Promise<DesignNode[]> {
    const node = this.nodes.get(id);
    if (!node) return [];
    const children: DesignNode[] = [];
    for (const childId of node.children) {
      const child = this.nodes.get(childId);
      if (child) children.push(child);
    }
    return children;
  }

  async upsert(node: DesignNode): Promise<void> {
    this.nodes.set(node.id, node);
    if (this.cache) await this.cache.upsertNode(node);
  }

  async all(): Promise<DesignNode[]> {
    return Array.from(this.nodes.values());
  }

  async search(query: string): Promise<DesignNode[]> {
    return searchByName(Array.from(this.nodes.values()), query);
  }

  async clear(): Promise<void> {
    this.nodes.clear();
  }
}
