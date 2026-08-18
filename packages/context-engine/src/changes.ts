import type { DesignNode, DiffResult } from "@designcontext/core";
import type { DesignGraph } from "@designcontext/core";
import { graphKey } from "@designcontext/core";
import type { DesignCache } from "@designcontext/cache";
import { diff } from "@designcontext/diff-engine";

/** Collect a node and all its descendants (by child links) into a map. */
export function collectSubtree(
  rootId: string,
  nodes: Record<string, DesignNode>,
): Record<string, DesignNode> {
  const result: Record<string, DesignNode> = {};
  const queue: string[] = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (result[id]) continue;
    const node = nodes[id];
    if (!node) continue;
    result[id] = node;
    for (const childId of node.children) queue.push(childId);
  }
  return result;
}

/** Assemble the readable diff of a scope vs. its previous snapshot, scoped to one file. */
export async function assembleChanges(
  graph: DesignGraph,
  cache: DesignCache,
  scopeId: string,
  fileId: string,
): Promise<DiffResult> {
  const allCurrent = await graph.all(fileId);
  const currentMap: Record<string, DesignNode> = Object.fromEntries(
    allCurrent.map((n) => [n.id, n]),
  );
  const current = collectSubtree(scopeId, currentMap);

  const snapshot = await cache.getLatestSnapshot(graphKey(fileId, scopeId));
  const previous = snapshot?.data
    ? collectSubtree(scopeId, snapshot.data)
    : {};

  return diff(scopeId, previous, current);
}
