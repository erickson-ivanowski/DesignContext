import { createLogger } from "@designcontext/shared";
import type { AppContext } from "./runtime";

const logger = createLogger("designcontext:clear-cache");

/** Remove cached blobs and index data (keeps project config). */
export async function clearCache(ctx: AppContext): Promise<void> {
  await ctx.cache.clear();
  await ctx.graph.clear();
  logger.info("cache cleared");
  process.stdout.write("Cache cleared.\n");
}
