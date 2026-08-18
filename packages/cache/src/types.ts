import type { DesignNode } from "@designcontext/core";

export interface Snapshot {
  scopeId: string;
  kind: string;
  data: Record<string, DesignNode>;
  createdAt: string;
}

export interface SavingsTotals {
  tokensWithoutContext: number;
  tokensWithContext: number;
  calls: number;
  cacheHits: number;
  cacheMisses: number;
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
  clear(fileId?: string): Promise<void>;

  listNodes(fileId?: string): Promise<DesignNode[]>;
  upsertNode(node: DesignNode): Promise<void>;

  /** `scopeKey` is a composite `graphKey(fileId, scopeNodeId)` string — see @designcontext/core. */
  saveSnapshot(scopeKey: string, kind: string, data: Record<string, DesignNode>): Promise<void>;
  getLatestSnapshot(scopeKey: string): Promise<Snapshot | null>;

  /**
   * Record one optimize()-backed context call's token cost, project-wide (not
   * fileId-scoped) and never reset by clear() — this is a running "how much has this
   * tool saved you" total, not cache data.
   */
  recordSavings(fullTokens: number, optimizedTokens: number): Promise<void>;
  /** Record one scan step's outcome: a cache hit (no Figma call) or a miss (one Figma call). */
  recordScanActivity(hit: boolean): Promise<void>;
  getSavings(): Promise<SavingsTotals>;
}
