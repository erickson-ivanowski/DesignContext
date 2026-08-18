import type { DesignNode } from "@designcontext/core";
import type { DesignCache, Snapshot } from "./types";

/** In-memory DesignCache. Used by tests and the CLI's `--in-memory` mode. */
export class InMemoryCacheStore implements DesignCache {
  private readonly blobs = new Map<string, unknown>();
  private readonly nodes = new Map<string, DesignNode>();
  private readonly snapshots = new Map<string, Snapshot>();

  async get(key: string): Promise<unknown | null> {
    return this.blobs.has(key) ? this.blobs.get(key)! : null;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.blobs.set(key, value);
  }

  async invalidate(key: string): Promise<void> {
    this.blobs.delete(key);
  }

  async clear(): Promise<void> {
    this.blobs.clear();
    this.nodes.clear();
    this.snapshots.clear();
  }

  async listNodes(): Promise<DesignNode[]> {
    return Array.from(this.nodes.values());
  }

  async upsertNode(node: DesignNode): Promise<void> {
    this.nodes.set(node.id, node);
  }

  async saveSnapshot(
    scopeId: string,
    kind: string,
    data: Record<string, DesignNode>,
  ): Promise<void> {
    this.snapshots.set(scopeId, {
      scopeId,
      kind,
      data,
      createdAt: new Date().toISOString(),
    });
  }

  async getLatestSnapshot(scopeId: string): Promise<Snapshot | null> {
    return this.snapshots.get(scopeId) ?? null;
  }
}
