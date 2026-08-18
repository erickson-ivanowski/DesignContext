/**
 * Composite key for a node scoped to its Figma file. Figma node ids (e.g. "0:1")
 * are only unique within a single file, so every graph/cache key that stores or
 * looks up a node must use this instead of the bare node id.
 */
export function graphKey(fileId: string, nodeId: string): string {
  return `${fileId}:${nodeId}`;
}
