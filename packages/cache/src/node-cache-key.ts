/** Content-addressable key for a node's normalized IR blob. */
export function nodeCacheKey(fileId: string, nodeId: string, contentHash: string): string {
  return `node:${fileId}:${nodeId}:${contentHash}`;
}
