import type { DesignNode } from "@designcontext/core";
import { graphKey } from "@designcontext/core";
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

  async clear(fileId?: string): Promise<void> {
    if (fileId) {
      for (const [key, node] of this.nodes) {
        if (node.fileId === fileId) this.nodes.delete(key);
      }
      for (const key of this.snapshots.keys()) {
        if (key.startsWith(`${fileId}:`)) this.snapshots.delete(key);
      }
      return;
    }
    this.blobs.clear();
    this.nodes.clear();
    this.snapshots.clear();
  }

  async listNodes(fileId?: string): Promise<DesignNode[]> {
    const all = Array.from(this.nodes.values());
    return fileId ? all.filter((n) => n.fileId === fileId) : all;
  }

  async upsertNode(node: DesignNode): Promise<void> {
    this.nodes.set(graphKey(node.fileId, node.id), node);
  }

  async saveSnapshot(
    scopeKey: string,
    kind: string,
    data: Record<string, DesignNode>,
  ): Promise<void> {
    this.snapshots.set(scopeKey, {
      scopeId: scopeKey,
      kind,
      data,
      createdAt: new Date().toISOString(),
    });
  }

  async getLatestSnapshot(scopeKey: string): Promise<Snapshot | null> {
    return this.snapshots.get(scopeKey) ?? null;
  }
}
