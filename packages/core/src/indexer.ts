import type {
  DesignNode,
  FigmaMetadata,
  ScanReport,
} from "./types";
import type { DesignGraph, FigmaAdapter } from "./interfaces";
import { graphKey } from "./keys";
import type { DesignCache } from "@designcontext/cache";
import { nodeCacheKey } from "@designcontext/cache";
import { contentHash, structuralHash } from "@designcontext/shared";
import { normalize } from "@designcontext/design-ir";

export interface IndexerDeps {
  adapter: FigmaAdapter;
  graph: DesignGraph;
  cache: DesignCache;
  fileId: string;
}

interface Discovered {
  meta: FigmaMetadata;
  parentId: string | null;
  order: number;
  hierarchy: string[];
}

function structuralOf(meta: FigmaMetadata, order: number, hierarchy: string[]): string {
  return structuralHash({
    type: meta.type,
    children: meta.children ?? [],
    order,
    componentId: meta.componentId ?? null,
    hierarchy,
  });
}

/**
 * Full-scan and incremental-scan orchestration. Metadata-first discovery:
 * recurse `getMetadata`, then fetch `getDesignContext` only for nodes that need
 * (re)indexing.
 */
export class DesignIndexer {
  constructor(private readonly deps: IndexerDeps) {}

  private async discover(scopeNodeId: string): Promise<Discovered[]> {
    const result: Discovered[] = [];
    const visited = new Set<string>();
    const queue: Array<{ id: string; parentId: string | null; order: number; hierarchy: string[] }> = [
      { id: scopeNodeId, parentId: null, order: 0, hierarchy: [] },
    ];
    while (queue.length > 0) {
      const { id, parentId, order, hierarchy } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const meta = await this.deps.adapter.getMetadata(id);
      result.push({ meta, parentId, order, hierarchy });
      const children = meta.children ?? [];
      const childHierarchy = [...hierarchy, id];
      for (let i = 0; i < children.length; i++) {
        queue.push({ id: children[i], parentId, order: i, hierarchy: childHierarchy });
      }
    }
    return result;
  }

  private buildNode(
    discovered: Discovered,
    raw: Record<string, unknown>,
  ): DesignNode {
    const ir = normalize(discovered.meta.nodeId, raw, this.deps.fileId);
    const structural = structuralOf(
      discovered.meta,
      discovered.order,
      discovered.hierarchy,
    );
    const hash = contentHash(ir);
    const now = new Date().toISOString();
    return {
      id: discovered.meta.nodeId,
      fileId: this.deps.fileId,
      parentId: discovered.parentId,
      name: discovered.meta.name,
      type: discovered.meta.type,
      bounds: ir.bounds,
      children: ir.children,
      componentId: ir.componentId,
      componentName: ir.componentName,
      properties: ir.properties,
      tokens: ir.tokens,
      contentHash: hash,
      structuralHash: structural,
      irJson: ir,
      rawContext: raw,
      lastSeenAt: now,
    };
  }

  async fullScan(scopeNodeId: string): Promise<ScanReport> {
    const discovered = await this.discover(scopeNodeId);
    const nodeMap: Record<string, DesignNode> = {};
    let indexed = 0;
    let cached = 0;
    let changed = 0;

    for (const item of discovered) {
      const raw = (await this.deps.adapter.getDesignContext(
        item.meta.nodeId,
      )) as Record<string, unknown>;
      const node = this.buildNode(item, raw);
      const prev = await this.deps.graph.getNode(graphKey(this.deps.fileId, node.id));
      if (!prev) indexed++;
      else if (prev.contentHash === node.contentHash && prev.structuralHash === node.structuralHash) cached++;
      else changed++;

      await this.deps.graph.upsert(node);
      await this.deps.cache.set(nodeCacheKey(this.deps.fileId, node.id, node.contentHash), node.irJson);
      await this.deps.cache.set(`lastModified:${this.deps.fileId}:${node.id}`, item.meta.lastModified ?? null);
      nodeMap[node.id] = node;
    }

    await this.deps.cache.saveSnapshot(graphKey(this.deps.fileId, scopeNodeId), "scan", nodeMap);
    return {
      discovered: discovered.length,
      cached,
      changed,
      indexed,
      fullScan: true,
    };
  }

  async incrementalScan(scopeNodeId: string): Promise<ScanReport> {
    const discovered = await this.discover(scopeNodeId);
    const nodeMap: Record<string, DesignNode> = {};
    let indexed = 0;
    let cached = 0;
    let changed = 0;

    for (const item of discovered) {
      const structural = structuralOf(item.meta, item.order, item.hierarchy);
      const prev = await this.deps.graph.getNode(graphKey(this.deps.fileId, item.meta.nodeId));
      const prevLastModified = (await this.deps.cache.get(
        `lastModified:${this.deps.fileId}:${item.meta.nodeId}`,
      )) as string | null;
      const lastModified = item.meta.lastModified ?? null;

      const needsFetch =
        !prev ||
        prev.structuralHash !== structural ||
        (lastModified !== null && prevLastModified !== null && prevLastModified !== lastModified);

      if (!needsFetch) {
        cached++;
        await this.deps.cache.recordScanActivity(true);
        nodeMap[item.meta.nodeId] = prev!;
        continue;
      }

      const raw = (await this.deps.adapter.getDesignContext(
        item.meta.nodeId,
      )) as Record<string, unknown>;
      await this.deps.cache.recordScanActivity(false);
      const node = this.buildNode(item, raw);
      if (!prev) indexed++;
      else changed++;

      await this.deps.graph.upsert(node);
      await this.deps.cache.set(nodeCacheKey(this.deps.fileId, node.id, node.contentHash), node.irJson);
      await this.deps.cache.set(`lastModified:${this.deps.fileId}:${node.id}`, lastModified);
      nodeMap[node.id] = node;
    }

    await this.deps.cache.saveSnapshot(graphKey(this.deps.fileId, scopeNodeId), "scan", nodeMap);
    return {
      discovered: discovered.length,
      cached,
      changed,
      indexed,
      fullScan: false,
    };
  }
}
