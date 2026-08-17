import { DesignIndexer, type IndexerDeps } from "./indexer";
import type { ScanReport } from "./types";

/**
 * Incremental scan (US2): re-index only nodes whose metadata-derived structural
 * hash or lastModified changed; unchanged nodes are served from cache.
 */
export async function incrementalScan(
  deps: IndexerDeps,
  scopeNodeId: string,
): Promise<ScanReport> {
  return new DesignIndexer(deps).incrementalScan(scopeNodeId);
}

export { DesignIndexer };
export type { IndexerDeps };
