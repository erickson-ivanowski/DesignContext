import type { DesignNode } from "@designcontext/core";

export interface Snapshot {
  scopeId: string;
  kind: string;
  data: Record<string, DesignNode>;
  createdAt: string;
}

/**
 * Content-addressable cache + node store + scope snapshots. Backs the design
 * graph's persistence (US5: reload index across sessions) and the indexer's
 * incremental-scan diffing (content/structural hash comparisons, snapshots).
 */
export interface DesignCache {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
  invalidate(key: string): Promise<void>;
  clear(): Promise<void>;

  listNodes(): Promise<DesignNode[]>;
  upsertNode(node: DesignNode): Promise<void>;

  saveSnapshot(scopeId: string, kind: string, data: Record<string, DesignNode>): Promise<void>;
  getLatestSnapshot(scopeId: string): Promise<Snapshot | null>;
}
