import type { ContextLevel } from "@designcontext/core";
import type { AppContext } from "./runtime";

/** Print context for a node at a given level (0-4), for one file. */
export async function inspect(
  ctx: AppContext,
  nodeId: string,
  level: ContextLevel,
  fileId: string,
): Promise<void> {
  const result = await ctx.engine.getContext(nodeId, level, fileId);
  process.stdout.write(JSON.stringify(result.content, null, 2) + "\n");
}
