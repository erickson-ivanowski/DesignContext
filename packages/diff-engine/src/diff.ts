import type {
  ChangeKind,
  ChangeRecord,
  DesignNode,
  DiffResult,
} from "@designcontext/core";

function kindOf(prev: DesignNode, next: DesignNode): ChangeKind {
  return prev.structuralHash !== next.structuralHash ? "structural" : "content";
}

/**
 * Compute the difference between two versions of a scope (node-id → node).
 * Emits changed (with before/after), added, removed, and unchanged summaries.
 */
export function diff(
  scope: string,
  previous: Record<string, DesignNode>,
  current: Record<string, DesignNode>,
): DiffResult {
  const changed: ChangeRecord[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  const unchanged: string[] = [];

  for (const [id, next] of Object.entries(current)) {
    const prev = previous[id];
    if (!prev) {
      added.push(id);
      continue;
    }
    if (
      prev.contentHash === next.contentHash &&
      prev.structuralHash === next.structuralHash
    ) {
      unchanged.push(id);
    } else {
      changed.push({
        nodeId: id,
        name: next.name,
        before: prev.properties,
        after: next.properties,
        kind: kindOf(prev, next),
      });
    }
  }

  for (const id of Object.keys(previous)) {
    if (!current[id]) removed.push(id);
  }

  return { scope, changed, added, removed, unchanged };
}
