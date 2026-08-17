import type { DesignNode } from "@designcontext/core";

/** Case-insensitive name-based node search. */
export function searchByName(nodes: DesignNode[], query: string): DesignNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return nodes.filter((n) => n.name.toLowerCase().includes(q));
}

/** Find a node whose name matches exactly (case-insensitive), if any. */
export function findByName(
  nodes: DesignNode[],
  name: string,
): DesignNode | null {
  const q = name.trim().toLowerCase();
  return nodes.find((n) => n.name.toLowerCase() === q) ?? null;
}
