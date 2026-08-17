import type { ContextLevel } from "@designcontext/core";
import type { AppContext } from "./runtime";

/** Print context for a node at a given level (0-4). */
export async function inspect(
  ctx: AppContext,
  nodeId: string,
  level: ContextLevel,
): Promise<void> {
  const result = await ctx.engine.getContext(nodeId, level);
  process.stdout.write(JSON.stringify(result.content, null, 2) + "\n");
}
